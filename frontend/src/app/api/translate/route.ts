import { NextRequest, NextResponse } from 'next/server';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
const SARVAM_TRANSLATE_URL = 'https://api.sarvam.ai/translate';

// Map our language codes to Sarvam language codes
const LANG_MAP: Record<string, string> = {
  hi: 'hi-IN',
  kn: 'kn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  mr: 'mr-IN',
  pa: 'pa-IN',
  od: 'od-IN',
  en: 'en-IN',
};

export async function POST(req: NextRequest) {
  if (!SARVAM_API_KEY) {
    return NextResponse.json({ error: 'Sarvam API key not configured' }, { status: 500 });
  }

  try {
    const { text, targetLanguage, sourceLanguage } = await req.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: 'text and targetLanguage are required' }, { status: 400 });
    }

    const srcLang = LANG_MAP[sourceLanguage || 'en'] || 'en-IN';
    const tgtLang = LANG_MAP[targetLanguage];

    if (!tgtLang) {
      return NextResponse.json({ error: 'Unsupported target language' }, { status: 400 });
    }

    // Don't translate if source and target are the same
    if (srcLang === tgtLang) {
      return NextResponse.json({ translatedText: text });
    }

    const sarvamRes = await fetch(SARVAM_TRANSLATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: JSON.stringify({
        input: text,
        source_language_code: srcLang,
        target_language_code: tgtLang,
      }),
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text();
      console.error('Sarvam Translate error:', sarvamRes.status, errText);
      return NextResponse.json(
        { error: 'Translation failed', details: errText },
        { status: sarvamRes.status }
      );
    }

    const result = await sarvamRes.json();
    return NextResponse.json({
      translatedText: result.translated_text,
      sourceLanguage: srcLang,
      targetLanguage: tgtLang,
    });
  } catch (err) {
    console.error('Translate route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
