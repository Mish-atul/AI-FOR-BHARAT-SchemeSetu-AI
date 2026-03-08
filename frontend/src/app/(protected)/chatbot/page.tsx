'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send, Mic, MicOff, Globe, Bot, User, Volume2, Search,
  Loader2, Sparkles, MessageSquare
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { sendChatMessage } from '@/lib/api';
import type { ChatMessage, Language, SchemeMatch } from '@/lib/types';
import { toast } from 'sonner';

export default function ChatbotPage() {
  const { language, setLanguage, chatMessages, addChatMessage, chatSessionId, clearChat } = useAppStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const welcomeSentRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Send welcome message on first load
  useEffect(() => {
    if (chatMessages.length === 0 && !welcomeSentRef.current) {
      welcomeSentRef.current = true;
      addChatMessage({
        id: 'welcome',
        timestamp: Date.now(),
        role: 'assistant',
        content: language === 'hi'
          ? 'नमस्ते! 🙏 मैं SchemeSetu AI आपका सहायक हूं। मैं आपकी मदद कर सकता हूं:\n\n• सरकारी योजनाओं की खोज\n• दस्तावेज़ प्रबंधन\n• आय रिपोर्ट बनाना\n• ट्रस्ट स्कोर समझना\n\nआप क्या जानना चाहते हैं?'
          : "Hello! 🙏 I'm SchemeSetu AI, your assistant. I can help you with:\n\n• Discovering government schemes\n• Managing documents\n• Generating income reports\n• Understanding your trust score\n\nWhat would you like to know?",
        language,
        suggestedActions: language === 'hi'
          ? ['योजनाएं खोजें', 'दस्तावेज़ अपलोड कैसे करें?', 'मेरा ट्रस्ट स्कोर', 'रिपोर्ट बनाएं']
          : ['Find schemes for me', 'How to upload documents?', 'My trust score', 'Generate report'],
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (text?: string) => {
    const message = text || input.trim();
    if (!message || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'user_' + Date.now(),
      timestamp: Date.now(),
      role: 'user',
      content: message,
      language,
    };
    addChatMessage(userMsg);
    setInput('');
    setIsLoading(true);

    try {
      const res = await sendChatMessage(chatSessionId, message, language);
      let finalMessage = res.message;

      // If user selected a non-English language but AI responded in English, translate
      if (language !== 'en' && res.message) {
        const looksEnglish = /^[A-Za-z0-9\s.,!?'"()\-:;#@%&*\/\n]+$/.test(res.message.trim());
        if (looksEnglish) {
          try {
            const tRes = await fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: res.message, targetLanguage: language, sourceLanguage: 'en' }),
            });
            if (tRes.ok) {
              const { translatedText } = await tRes.json();
              if (translatedText) finalMessage = translatedText;
            }
          } catch { /* keep original if translation fails */ }
        }
      }

      const botMsg: ChatMessage = {
        id: 'bot_' + Date.now(),
        timestamp: Date.now(),
        role: 'assistant',
        content: finalMessage,
        language: language !== 'en' ? language : res.language,
        schemes: res.eligibleSchemes,
        suggestedActions: res.suggestedActions,
      };
      addChatMessage(botMsg);
    } catch (err: any) {
      toast.error(err.message || 'Failed to get response');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (audioBlob.size < 1000) {
          toast.info(language === 'hi' ? 'कोई आवाज़ नहीं मिली। दोबारा बोलें।' : 'No speech detected. Please try again.');
          return;
        }

        // Send to Sarvam AI for transcription
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'recording.webm');
          // Map language to Sarvam language code for better transcription
          const SARVAM_LANG_MAP: Record<string, string> = {
            hi: 'hi-IN', en: 'en-IN', kn: 'kn-IN', ta: 'ta-IN',
            te: 'te-IN', ml: 'ml-IN', bn: 'bn-IN', gu: 'gu-IN',
            mr: 'mr-IN', pa: 'pa-IN', od: 'od-IN',
          };
          formData.append('language_code', SARVAM_LANG_MAP[language] || 'en-IN');

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Transcription failed' }));
            throw new Error(err.details || err.error || 'Transcription failed');
          }

          const { transcript, language_code } = await res.json();
          if (transcript && transcript.trim()) {
            // Use detected language from Sarvam to set UI language
            const SARVAM_TO_LANG: Record<string, any> = {
              'hi-IN': 'hi', 'en-IN': 'en', 'kn-IN': 'kn', 'ta-IN': 'ta',
              'te-IN': 'te', 'ml-IN': 'ml', 'bn-IN': 'bn', 'gu-IN': 'gu',
              'mr-IN': 'mr', 'pa-IN': 'pa', 'od-IN': 'od',
            };
            if (language_code && SARVAM_TO_LANG[language_code]) {
              setLanguage(SARVAM_TO_LANG[language_code]);
            } else if (language_code && language_code.startsWith('hi')) {
              setLanguage('hi');
            } else if (language_code && language_code.startsWith('kn')) {
              setLanguage('kn');
            }
            toast.info(language === 'hi' ? `"${transcript}" — आवाज़ पहचानी गई` : `"${transcript}" — Voice recognized`);
            handleSend(transcript.trim());
          } else {
            toast.info(language === 'hi' ? 'कोई आवाज़ नहीं पहचानी गई। दोबारा बोलें।' : 'No speech recognized. Please try again.');
          }
        } catch (err: any) {
          console.error('Transcription error:', err);
          toast.error(language === 'hi' ? 'आवाज़ पहचानने में त्रुटि' : `Voice recognition error: ${err.message}`);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      toast.info(language === 'hi' ? '🎙️ सुन रहे हैं... बोलें और बटन फिर दबाएं' : '🎙️ Listening... speak and tap mic again to stop');
    } catch {
      toast.error(language === 'hi' ? 'माइक्रोफ़ोन की अनुमति चाहिए' : 'Microphone permission required');
    }
  };

  const renderSchemeCards = (schemes: SchemeMatch[]) => (
    <div className="space-y-2 mt-3">
      {schemes.map((scheme, idx) => (
        <div key={scheme.schemeId || idx} className="p-3 rounded-lg border bg-white">
          <div className="flex justify-between items-start mb-1">
            <h4 className="font-medium text-sm">{scheme.schemeName}</h4>
            {scheme.eligibilityScore != null && (
              <Badge className={scheme.eligibilityScore >= 70 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                {scheme.eligibilityScore}%
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-2">{scheme.description}</p>
          {scheme.matchReasons && scheme.matchReasons.length > 0 && (
            <div className="space-y-0.5">
              {scheme.matchReasons.map((reason, i) => (
                <p key={i} className="text-xs text-green-600">✓ {reason}</p>
              ))}
            </div>
          )}
          {scheme.missingRequirements && scheme.missingRequirements.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {scheme.missingRequirements.map((req, i) => (
                <p key={i} className="text-xs text-orange-500">⚠ {req}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{t('chatTitle', language)}</h1>
            <p className="text-xs text-gray-400">
              {language === 'hi' ? 'Amazon Bedrock द्वारा संचालित' : 'Powered by Amazon Bedrock'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const langCycle: Record<string, Language> = { en: 'hi', hi: 'kn', kn: 'ta', ta: 'te', te: 'en', ml: 'en', bn: 'en', gu: 'en', mr: 'en', pa: 'en', od: 'en' };
              setLanguage(langCycle[language] || 'en');
            }}
            className="gap-1 text-xs"
          >
            <Globe className="h-3 w-3" />
            {({ en: 'हिंदी', hi: 'ಕನ್ನಡ', kn: 'தமிழ்', ta: 'తెలుగు', te: 'English', ml: 'English', bn: 'English', gu: 'English', mr: 'English', pa: 'English', od: 'English' } as Record<string, string>)[language] || 'हिंदी'}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearChat} className="text-xs">
            {language === 'hi' ? 'नया चैट' : 'New Chat'}
          </Button>
        </div>
      </div>

      {/* Chat Messages */}
      <Card className="flex-1 border-0 shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
          <div className="space-y-4 max-w-3xl mx-auto">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                  <div className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-orange-500 to-green-600 text-white rounded-tr-md'
                      : 'bg-gray-100 text-gray-800 rounded-tl-md'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {/* Scheme cards */}
                  {msg.schemes && msg.schemes.length > 0 && renderSchemeCards(msg.schemes)}

                  {/* Suggested actions */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.suggestedActions.map((action, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 rounded-full"
                          onClick={() => handleSend(action)}
                        >
                          {action}
                        </Button>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-gray-400 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                    <span className="text-sm text-gray-500">
                      {language === 'hi' ? 'सोच रहा हूं...' : 'Thinking...'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t p-4 bg-white">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <Button
              variant={isRecording ? 'destructive' : 'outline'}
              size="icon"
              onClick={toggleRecording}
              className="shrink-0"
              disabled={isTranscribing}
            >
              {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={t('chatPlaceholder', language)}
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="shrink-0 bg-gradient-to-r from-orange-500 to-green-600 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {(isRecording || isTranscribing) && (
            <div className="text-center mt-2">
              <p className={`text-xs ${isRecording ? 'text-red-500 animate-pulse' : 'text-purple-500'}`}>
                {isRecording
                  ? `🔴 ${t('listening', language)}`
                  : (language === 'hi' ? '🔄 आवाज़ पहचान रहे हैं...' : '🔄 Transcribing...')}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
