'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Settings, Globe, Bell, Shield, Moon, Volume2,
  Smartphone, Wifi, WifiOff, Info
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { language, setLanguage } = useAppStore();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoOffline, setAutoOffline] = useState(true);
  const [dataUsage, setDataUsage] = useState<'low' | 'normal' | 'high'>('normal');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="h-6 w-6 text-orange-600" />
        {t('settings', language)}
      </h1>

      {/* Language */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            {t('language', language)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{language === 'hi' ? 'ऐप भाषा' : 'App Language'}</p>
              <p className="text-xs text-gray-400">
                {language === 'hi'
                  ? 'हिंदी और अंग्रेज़ी के बीच स्विच करें'
                  : 'Switch between Hindi and English'}
              </p>
            </div>
            <Select value={language} onValueChange={(v: 'hi' | 'en') => {
              setLanguage(v);
              toast.success(v === 'hi' ? 'भाषा हिंदी में बदली' : 'Language changed to English');
            }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिंदी</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-purple-500" />
            {language === 'hi' ? 'सुलभता' : 'Accessibility'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{language === 'hi' ? 'वॉइस इनपुट/आउटपुट' : 'Voice Input/Output'}</p>
              <p className="text-xs text-gray-400">
                {language === 'hi'
                  ? 'चैटबॉट में वॉइस सुविधाएं सक्षम करें'
                  : 'Enable voice features in chatbot'}
              </p>
            </div>
            <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{language === 'hi' ? 'डार्क मोड' : 'Dark Mode'}</p>
              <p className="text-xs text-gray-400">
                {language === 'hi'
                  ? 'गहरे रंग की थीम (जल्द आ रहा है)'
                  : 'Dark color theme (coming soon)'}
              </p>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} disabled />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-yellow-500" />
            {language === 'hi' ? 'सूचनाएं' : 'Notifications'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{language === 'hi' ? 'पुश सूचनाएं' : 'Push Notifications'}</p>
              <p className="text-xs text-gray-400">
                {language === 'hi'
                  ? 'नई योजनाओं और दस्तावेज़ सत्यापन की सूचनाएं'
                  : 'Get notified about new schemes and document verification'}
              </p>
            </div>
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </div>
        </CardContent>
      </Card>

      {/* Offline & Data */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wifi className="h-5 w-5 text-green-500" />
            {language === 'hi' ? 'ऑफलाइन और डेटा' : 'Offline & Data'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{language === 'hi' ? 'ऑफलाइन मोड' : 'Offline Mode'}</p>
              <p className="text-xs text-gray-400">
                {language === 'hi'
                  ? 'ऑफलाइन होने पर स्वचालित रूप से ड्राफ्ट सहेजें'
                  : 'Automatically save drafts when offline'}
              </p>
            </div>
            <Switch checked={autoOffline} onCheckedChange={setAutoOffline} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{language === 'hi' ? 'डेटा उपयोग' : 'Data Usage'}</p>
              <p className="text-xs text-gray-400">
                {language === 'hi'
                  ? 'छवि गुणवत्ता और डेटा उपयोग नियंत्रित करें'
                  : 'Control image quality and data consumption'}
              </p>
            </div>
            <Select value={dataUsage} onValueChange={(v: 'low' | 'normal' | 'high') => setDataUsage(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{language === 'hi' ? 'कम' : 'Low'}</SelectItem>
                <SelectItem value="normal">{language === 'hi' ? 'सामान्य' : 'Normal'}</SelectItem>
                <SelectItem value="high">{language === 'hi' ? 'उच्च' : 'High'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-gray-500" />
            {language === 'hi' ? 'ऐप जानकारी' : 'App Info'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-500">
          <div className="flex justify-between">
            <span>{language === 'hi' ? 'संस्करण' : 'Version'}</span>
            <span>1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>{language === 'hi' ? 'टीम' : 'Team'}</span>
            <span>0NLY FL4G$</span>
          </div>
          <div className="flex justify-between">
            <span>{language === 'hi' ? 'हैकथॉन' : 'Hackathon'}</span>
            <span>AI for Bharat</span>
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2 pt-1">
            {['Bedrock', 'Textract', 'Transcribe', 'Polly', 'DynamoDB', 'S3', 'Lambda', 'Cognito', 'CloudWatch', 'KMS', 'API Gateway', 'SQS'].map(s => (
              <Badge key={s} variant="outline" className="text-xs">
                <span className="text-orange-500 mr-1">AWS</span>{s}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
