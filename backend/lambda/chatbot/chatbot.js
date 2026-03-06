// SchemeSetu AI — Chatbot Lambda (Bedrock + Transcribe + Polly)
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { ddb, QueryCommand, response, getUserId, parseBody } = require('../shared/utils');

const bedrock = new BedrockRuntimeClient({ region: process.env.REGION });
const polly = new PollyClient({ region: process.env.REGION });
const s3 = new S3Client({ region: process.env.REGION });

const SCHEMES_TABLE = process.env.SCHEMES_TABLE;
const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;
const DOCUMENT_BUCKET = process.env.DOCUMENT_BUCKET;
const MODEL_ID = 'apac.amazon.nova-micro-v1:0';

// System prompt for the chatbot
const SYSTEM_PROMPT = `You are SchemeSetu AI, a helpful assistant for India's informal workers.
You help users with:
1. Discovering eligible government schemes from 1400+ real schemes on myScheme.gov.in
2. Understanding document requirements and which documents they need to upload
3. Matching their uploaded documents to scheme requirements (showing % match)
4. Generating income verification reports
5. Understanding their trust score
6. Managing their digital trust wallet

Guidelines:
- Be concise and helpful
- If the user speaks Hindi, respond in Hindi. If English, respond in English.
- When recommending schemes, explain eligibility criteria and document requirements clearly
- Tell users which documents they already have and which they still need
- Always be encouraging and supportive
- If asked about something outside your scope, politely redirect to relevant features
- Use simple language that informal workers can understand
- When listing schemes, mention the document match percentage`;

exports.handler = async (event) => {
  const method = event.httpMethod;
  const userId = getUserId(event);
  const path = event.resource || event.path;

  try {
    // POST /chat — Text chat
    if (method === 'POST' && !path.includes('voice')) {
      const body = parseBody(event);
      const { sessionId, text, language, inputType } = body;

      if (!text) {
        return response(400, { error: 'text is required' });
      }

      // Fetch user context for personalized responses
      const userContext = await getUserContext(userId);

      // Build conversation with context
      const userMessage = text;
      const lang = language || 'en';

      // Call Bedrock
      const aiResponse = await callBedrock(userMessage, lang, userContext);

      // Check if the message is about schemes
      const schemes = await findRelevantSchemes(text, lang);

      // Generate suggested follow-up actions
      const suggestedActions = getSuggestedActions(text, lang);

      return response(200, {
        sessionId: sessionId || 'session_' + Date.now(),
        message: aiResponse,
        intent: detectIntent(text),
        language: lang,
        suggestedActions,
        eligibleSchemes: schemes.length > 0 ? schemes : undefined,
      });
    }

    // POST /chat/voice — Voice chat (accepts transcript from client-side speech recognition)
    if (method === 'POST' && path.includes('voice')) {
      const body = parseBody(event);
      const { sessionId, language, transcript: clientTranscript } = body;
      const lang = language || 'en';

      // Use client-provided transcript from Web Speech API
      const transcript = clientTranscript || (lang === 'hi'
        ? 'मुझे पात्र योजनाएं बताएं'
        : 'Show me eligible schemes');

      const userContext = await getUserContext(userId);
      const aiResponse = await callBedrock(transcript, lang, userContext);
      const schemes = await findRelevantSchemes(transcript, lang);

      // Generate speech with Polly
      let audioUrl = '';
      try {
        const pollyResult = await polly.send(new SynthesizeSpeechCommand({
          Text: aiResponse,
          OutputFormat: 'mp3',
          VoiceId: 'Kajal',
          Engine: 'neural',
          LanguageCode: lang === 'hi' ? 'hi-IN' : 'en-IN',
        }));

        // Store audio in S3 and get presigned URL
        const audioKey = `voice/${userId}/${Date.now()}.mp3`;
        const audioBytes = await pollyResult.AudioStream.transformToByteArray();
        await s3.send(new PutObjectCommand({
          Bucket: DOCUMENT_BUCKET,
          Key: audioKey,
          Body: audioBytes,
          ContentType: 'audio/mpeg',
        }));

        audioUrl = await getSignedUrl(s3, new GetObjectCommand({
          Bucket: DOCUMENT_BUCKET,
          Key: audioKey,
        }), { expiresIn: 3600 });
      } catch (pollyErr) {
        console.error('Polly error:', pollyErr);
      }

      return response(200, {
        sessionId: sessionId || 'session_' + Date.now(),
        message: aiResponse,
        intent: detectIntent(transcript),
        language: lang,
        transcript,
        confidence: 0.95,
        audioUrl,
        suggestedActions: getSuggestedActions(transcript, lang),
        eligibleSchemes: schemes.length > 0 ? schemes : undefined,
      });
    }

    return response(404, { error: 'Route not found' });
  } catch (err) {
    console.error('Chatbot error:', err);

    // Fallback response if Bedrock fails (e.g., model not enabled)
    const body = parseBody(event);
    const lang = body.language || 'en';

    const fallbackMessage = lang === 'hi'
      ? 'क्षमा करें, AI सेवा अभी उपलब्ध नहीं है। कृपया बाद में प्रयास करें। आप इस बीच योजनाएं ब्राउज़ कर सकते हैं।'
      : 'Sorry, the AI service is currently unavailable. Please try again later. You can browse schemes in the meantime.';

    return response(200, {
      sessionId: body.sessionId || 'session_' + Date.now(),
      message: fallbackMessage,
      intent: 'error',
      language: lang,
      suggestedActions: lang === 'hi'
        ? ['योजनाएं देखें', 'दस्तावेज़ अपलोड करें', 'रिपोर्ट बनाएं']
        : ['Browse schemes', 'Upload documents', 'Generate report'],
    });
  }
};

async function callBedrock(userMessage, language, userContext) {
  const contextInfo = userContext
    ? `\n\nUser context: ${JSON.stringify(userContext)}`
    : '';

  // Detect language from the user's message text
  const hasDevanagari = /[\u0900-\u097F]/.test(userMessage);
  const effectiveLang = hasDevanagari ? 'hi' : language;

  const langInstruction = effectiveLang === 'hi'
    ? '\n\nIMPORTANT: Respond entirely in Hindi (Devanagari script). The user is speaking Hindi.'
    : '\n\nRespond in English.';

  try {
    const bedrockResponse = await bedrock.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inferenceConfig: { maxTokens: 1024 },
        system: [{ text: SYSTEM_PROMPT + contextInfo + langInstruction }],
        messages: [
          { role: 'user', content: [{ text: userMessage }] },
        ],
      }),
    }));

    const result = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    return result.output.message.content[0].text;
  } catch (err) {
    console.error('Bedrock invocation error:', err);
    // If Bedrock is not available, return a helpful fallback
    if (language === 'hi') {
      return `मैं समझता हूं कि आप "${userMessage}" के बारे में जानना चाहते हैं।\n\nयहां कुछ सुझाव हैं:\n• योजनाएं पृष्ठ पर जाएं सरकारी योजनाओं की जानकारी के लिए\n• दस्तावेज़ अपलोड करें अपनी पात्रता जांचने के लिए\n• रिपोर्ट बनाएं आय सत्यापन के लिए`;
    }
    return `I understand you'd like to know about "${userMessage}".\n\nHere are some suggestions:\n• Visit the Schemes page to discover eligible government schemes\n• Upload documents to check your eligibility\n• Generate income reports for verification`;
  }
}

async function getUserContext(userId) {
  try {
    // Get user profile and documents in parallel
    const [userResult, docsDetailResult] = await Promise.all([
      ddb.send(new QueryCommand({
        TableName: USERS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `USER#${userId}` },
        Limit: 1,
      })),
      ddb.send(new QueryCommand({
        TableName: DOCUMENTS_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': 'DOC#',
        },
      })),
    ]);

    const user = userResult.Items?.[0];
    const documents = (docsDetailResult.Items || []).map(doc => ({
      fileName: doc.fileName,
      docType: doc.docType,
      verificationStatus: doc.verificationStatus,
      extractedData: doc.extractedData,
      blockchainHash: doc.blockchainHash,
      uploadDate: doc.uploadTimestamp ? new Date(doc.uploadTimestamp).toISOString().split('T')[0] : undefined,
    }));

    // Fetch top relevant schemes for context (limit to keep prompt size manageable)
    let topSchemes = [];
    try {
      const schemesResult = await ddb.send(new QueryCommand({
        TableName: SCHEMES_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': 'SCHEME' },
        Limit: 100,
      }));
      const allSchemes = schemesResult.Items || [];

      // Score schemes based on user's state/occupation and pick top 10
      const profile = user?.profile || {};
      const scored = allSchemes.map(s => {
        let score = 0;
        const states = s.targetStates || [];
        if (profile.state && (states.includes('All India') || states.some(st => st.toLowerCase() === (profile.state || '').toLowerCase()))) score += 3;
        if (states.includes('All India')) score += 1;
        const occ = (profile.occupation || '').toLowerCase();
        const tOcc = s.targetOccupations || [];
        if (tOcc.includes('all') || tOcc.some(t => occ.includes(t))) score += 2;
        if (s.maxIncome && profile.monthlyIncome && profile.monthlyIncome * 12 <= s.maxIncome) score += 2;
        return { ...s, _score: score };
      });
      scored.sort((a, b) => b._score - a._score);

      topSchemes = scored.slice(0, 10).map(s => ({
        name: s.name,
        benefits: (s.benefits || '').substring(0, 200),
        eligibility: (s.eligibility || '').substring(0, 200),
        documentsRequired: (s.documentsRequired || '').substring(0, 150),
        ministry: s.ministry,
        targetStates: s.targetStates,
      }));
    } catch (e) {
      console.error('Error fetching schemes for context:', e);
    }

    return {
      documentCount: documents.length,
      hasProfile: !!user?.profile,
      name: user?.profile?.name,
      occupation: user?.profile?.occupation,
      income: user?.profile?.monthlyIncome || user?.profile?.income,
      location: user?.profile?.district ? `${user?.profile?.district}, ${user?.profile?.state}` : user?.profile?.location,
      state: user?.profile?.state,
      age: user?.profile?.age,
      documents: documents.length > 0 ? documents : undefined,
      relevantSchemes: topSchemes.length > 0 ? topSchemes : undefined,
      totalSchemesAvailable: '1400+',
    };
  } catch {
    return null;
  }
}

async function findRelevantSchemes(text, language) {
  const lowerText = text.toLowerCase();
  const schemeKeywords = [
    'scheme', 'yojana', 'योजना', 'eligible', 'पात्र',
    'pmay', 'kisan', 'mudra', 'ujjwala', 'ayushman', 'shram',
    'housing', 'loan', 'insurance', 'pension', 'gas', 'subsidy',
    'scholarship', 'farmer', 'health', 'education',
    'आवास', 'ऋण', 'बीमा', 'पेंशन', 'गैस', 'किसान',
  ];

  const isSchemeQuery = schemeKeywords.some(kw => lowerText.includes(kw));
  if (!isSchemeQuery) return [];

  try {
    const result = await ddb.send(new QueryCommand({
      TableName: SCHEMES_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': 'SCHEME' },
      Limit: 50,
    }));

    const schemes = result.Items || [];
    // Score relevance based on text match
    const scored = schemes.map(s => {
      let score = 0;
      const sText = `${s.name} ${s.description} ${s.benefits}`.toLowerCase();
      for (const word of lowerText.split(/\s+/)) {
        if (word.length > 3 && sText.includes(word)) score += 1;
      }
      return { ...s, _score: score };
    });
    scored.sort((a, b) => b._score - a._score);

    return scored.slice(0, 5).map(s => ({
      schemeId: s.schemeId,
      schemeName: s.name,
      description: (s.description || '').substring(0, 200),
      benefits: (s.benefits || '').substring(0, 200),
    }));
  } catch {
    return [];
  }
}

function detectIntent(text) {
  const lower = text.toLowerCase();
  if (lower.match(/scheme|yojana|योजना|eligible|पात्र/)) return 'scheme_discovery';
  if (lower.match(/document|upload|दस्तावेज़|अपलोड/)) return 'document_help';
  if (lower.match(/report|income|रिपोर्ट|आय/)) return 'report_help';
  if (lower.match(/trust|score|ट्रस्ट|स्कोर/)) return 'trust_score';
  if (lower.match(/hello|hi|namaste|नमस्ते|हेलो/)) return 'greeting';
  return 'general';
}

function getSuggestedActions(text, language) {
  const intent = detectIntent(text);
  if (language === 'hi') {
    switch (intent) {
      case 'scheme_discovery': return ['सभी योजनाएं दिखाएं', 'मेरी पात्रता जांचें', 'दस्तावेज़ अपलोड करें'];
      case 'document_help': return ['दस्तावेज़ अपलोड करें', 'OCR स्थिति देखें', 'योजनाएं खोजें'];
      case 'report_help': return ['रिपोर्ट बनाएं', 'ट्रस्ट स्कोर देखें', 'दस्तावेज़ देखें'];
      case 'trust_score': return ['स्कोर कैसे बढ़ाएं?', 'दस्तावेज़ अपलोड करें', 'रिपोर्ट बनाएं'];
      default: return ['योजनाएं खोजें', 'दस्तावेज़ अपलोड करें', 'रिपोर्ट बनाएं'];
    }
  }
  switch (intent) {
    case 'scheme_discovery': return ['Show all schemes', 'Check my eligibility', 'Upload documents'];
    case 'document_help': return ['Upload document', 'Check OCR status', 'Find schemes'];
    case 'report_help': return ['Generate report', 'View trust score', 'View documents'];
    case 'trust_score': return ['How to improve?', 'Upload documents', 'Generate report'];
    default: return ['Find schemes', 'Upload documents', 'Generate report'];
  }
}
