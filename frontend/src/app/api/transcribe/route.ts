import { NextRequest, NextResponse } from 'next/server';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';

export async function POST(req: NextRequest) {
  if (!SARVAM_API_KEY) {
    console.error('SARVAM_API_KEY is not set');
    return NextResponse.json(
      { error: 'Sarvam API key not configured' },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File | null;
    const languageCode = formData.get('language_code') as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Read the audio file into a buffer and create a proper Blob
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBlob = new Blob([arrayBuffer], { type: audioFile.type || 'audio/webm' });

    // Forward to Sarvam API
    const sarvamForm = new FormData();
    sarvamForm.append('file', audioBlob, audioFile.name || 'recording.webm');
    if (languageCode) {
      sarvamForm.append('language_code', languageCode);
    }
    sarvamForm.append('model', 'saarika:v2.5');

    console.log('Calling Sarvam STT:', {
      fileSize: arrayBuffer.byteLength,
      mimeType: audioFile.type,
      language: languageCode,
    });

    const sarvamRes = await fetch(SARVAM_STT_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: sarvamForm,
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text();
      console.error('Sarvam API error:', sarvamRes.status, errText);
      return NextResponse.json(
        { error: 'Transcription failed', details: errText },
        { status: sarvamRes.status }
      );
    }

    const result = await sarvamRes.json();
    console.log('Sarvam STT result:', result.transcript);
    return NextResponse.json({
      transcript: result.transcript,
      language_code: result.language_code,
      confidence: result.language_probability,
    });
  } catch (err) {
    console.error('Transcribe route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
