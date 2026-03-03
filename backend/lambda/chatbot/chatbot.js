"use strict";

/**
 * SchemeSetu AI — Chatbot Lambda
 *
 * POST /chat        → text in  → text out + optional voice out
 * POST /chat/voice  → base64 audio in → text out + voice out
 *
 * AWS: Bedrock (Claude 3 Haiku) | Transcribe | Polly | DynamoDB | S3
 */

const { BedrockRuntimeClient, InvokeModelCommand }           = require("@aws-sdk/client-bedrock-runtime");
const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require("@aws-sdk/client-transcribe");
const { PollyClient, SynthesizeSpeechCommand }               = require("@aws-sdk/client-polly");
const { DynamoDBClient, GetItemCommand, QueryCommand, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, PutObjectCommand, GetObjectCommand }       = require("@aws-sdk/client-s3");
const { getSignedUrl }         = require("@aws-sdk/s3-request-presigner");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

// ── AWS Clients ────────────────────────────────────────────────────────────────
const bedrock    = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const transcribe = new TranscribeClient({ region: process.env.AWS_REGION });
const polly      = new PollyClient({ region: process.env.AWS_REGION });
const dynamo     = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3         = new S3Client({ region: process.env.AWS_REGION });

// ── Env Vars (injected by CDK — see cdk-snippet.ts below) ─────────────────────
const USERS_TABLE   = process.env.USERS_TABLE;
const DOCS_TABLE    = process.env.DOCUMENTS_TABLE;
const SCHEMES_TABLE = process.env.SCHEMES_TABLE;
const AUDIO_BUCKET = process.env.DOCUMENT_BUCKET;  // ← this is what CDK injects

// ─────────────────────────────────────────────────────────────────────────────
//  Language Config
//  Hindi  → Amazon Transcribe hi-IN | Polly Kajal (neural)
//  English → Amazon Transcribe en-IN | Polly Raveena (standard)
// ─────────────────────────────────────────────────────────────────────────────
const LANG = {
  hi: {
    transcribeCode: "hi-IN",
    pollyVoice    : "Kajal",
    pollyEngine   : "neural",
    systemHint    : `आप SchemeSetu AI हैं — भारत के असंगठित मजदूरों के लिए सरकारी योजना सहायक।
हमेशा सरल हिंदी में उत्तर दें। ग्रामीण उपयोगकर्ताओं के लिए आसान भाषा इस्तेमाल करें।`,
  },
  en: {
    transcribeCode: "en-IN",
    pollyVoice    : "Raveena",
    pollyEngine   : "standard",
    systemHint    : `You are SchemeSetu AI — a government scheme assistant for India's informal workers.
Always respond in simple, clear Indian English. Be warm and easy to understand.`,
  },
};

// ── HTTP helper ────────────────────────────────────────────────────────────────
const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type"                : "application/json",
    "Access-Control-Allow-Origin" : "*",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
  },
  body: JSON.stringify(body),
});

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  console.log("Chatbot:", JSON.stringify({ path: event.path }));

  try {
    // Auth: userId injected by your existing API Gateway custom authorizer
    const userId = event.requestContext?.authorizer?.userId;
    if (!userId) return respond(401, { error: "Unauthorized" });

    const isVoiceRoute = event.path?.endsWith("/voice") || event.resource?.endsWith("/voice");
    const body         = JSON.parse(event.body || "{}");

    // 1. Pick language
    const lang    = LANG[body.language] ? body.language : "hi";
    const langCfg = LANG[lang];

    // 2. Load user context in parallel
    const [userProfile, userDocs, allSchemes] = await Promise.all([
      fetchUserProfile(userId),
      fetchUserDocuments(userId),
      fetchAllSchemes(),
    ]);

    // 3. Resolve text query
    let userText, transcribedText;

    if (isVoiceRoute) {
      // { audio: "<base64 mp3>", language: "hi"|"en", voiceOutput: true }
      if (!body.audio) return respond(400, { error: "audio (base64) required for /chat/voice" });
      userText        = await transcribeAudio(body.audio, langCfg.transcribeCode, userId);
      transcribedText = userText;
      console.log("Transcribed:", userText);
    } else {
      // { message: "...", language: "hi"|"en", voiceOutput?: boolean }
      if (!body.message?.trim()) return respond(400, { error: "message required for /chat" });
      userText = body.message.trim();
    }

    // 4. Build prompt & call Bedrock
    const systemPrompt = buildSystemPrompt(userProfile, userDocs, allSchemes, langCfg);
    const aiText       = await invokeBedrock(systemPrompt, userText);

    // 5. Optionally synthesize voice via Polly
    let audioUrl = null;
    if (body.voiceOutput === true || isVoiceRoute) {
      audioUrl = await synthesizeAndUpload(aiText, langCfg, userId);
    }

    // 6. Return
    return respond(200, { message: aiText, audioUrl, language: lang, transcribedText });

  } catch (err) {
    console.error("Error:", err);
    return respond(500, { error: "Unable to process. Please try again.", detail: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DynamoDB helpers
// ─────────────────────────────────────────────────────────────────────────────
async function fetchUserProfile(userId) {
  try {
    const res = await dynamo.send(new GetItemCommand({
      TableName: USERS_TABLE,
      Key      : marshall({ PK: `USER#${userId}`, SK: 'PROFILE' }),
    }));
    return res.Item ? unmarshall(res.Item) : null;
  } catch (e) { console.warn("fetchUserProfile:", e.message); return null; }
}

async function fetchUserDocuments(userId) {
  try {
    const res = await dynamo.send(new QueryCommand({
      TableName                 : DOCS_TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": `USER#${userId}` }),
    }));
    return (res.Items || []).map(i => unmarshall(i));
  } catch (e) { console.warn("fetchUserDocs:", e.message); return []; }
}

async function fetchAllSchemes() {
  try {
    const res = await dynamo.send(new ScanCommand({ TableName: SCHEMES_TABLE }));
    return (res.Items || []).map(i => unmarshall(i));
  } catch (e) { console.warn("fetchAllSchemes:", e.message); return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Transcribe: base64 audio → text
//  Upload audio to S3 → start job → poll → fetch result
// ─────────────────────────────────────────────────────────────────────────────
async function transcribeAudio(base64Audio, languageCode, userId) {
  const jobId = `setu-${userId}-${Date.now()}`;
  const inputKey = `transcribe-input/${jobId}.mp3`;

  await s3.send(new PutObjectCommand({
    Bucket     : AUDIO_BUCKET,
    Key        : inputKey,
    Body       : Buffer.from(base64Audio, "base64"),
    ContentType: "audio/mpeg",
  }));

  await transcribe.send(new StartTranscriptionJobCommand({
    TranscriptionJobName: jobId,
    LanguageCode        : languageCode,
    MediaFormat         : "mp3",
    Media               : { MediaFileUri: `s3://${AUDIO_BUCKET}/${inputKey}` },
    OutputBucketName    : AUDIO_BUCKET,
    OutputKey           : `transcribe-output/${jobId}.json`,
  }));

  return await pollTranscription(jobId);
}

async function pollTranscription(jobId) {
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    const res    = await transcribe.send(new GetTranscriptionJobCommand({ TranscriptionJobName: jobId }));
    const status = res.TranscriptionJob?.TranscriptionJobStatus;
    console.log(`Transcribe poll ${i + 1}: ${status}`);

    if (status === "COMPLETED") {
      const s3Res = await s3.send(new GetObjectCommand({
        Bucket: AUDIO_BUCKET,
        Key   : `transcribe-output/${jobId}.json`,
      }));
      const json = JSON.parse(await s3Res.Body.transformToString());
      const text = json.results?.transcripts?.[0]?.transcript || "";
      if (!text) throw new Error("Empty transcription");
      return text;
    }
    if (status === "FAILED") throw new Error(`Transcription failed: ${res.TranscriptionJob?.FailureReason}`);
  }
  throw new Error("Transcription timed out");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Prompt builder — injects real user income + docs + scheme eligibility context
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(userProfile, userDocs, allSchemes, langCfg) {

  // User profile block
  let profileBlock = "USER PROFILE: Not available. Ask user to complete their profile at /profile.";
  if (userProfile) {
    profileBlock = [
      `USER PROFILE:`,
      `- Name            : ${userProfile.name || "Unknown"}`,
      `- Age             : ${userProfile.age || "Unknown"}`,
      `- Gender          : ${userProfile.gender || "Unknown"}`,
      `- State           : ${userProfile.state || userProfile.location?.state || "Unknown"}`,
      `- Occupation      : ${userProfile.occupation || userProfile.employmentType || "Informal worker"}`,
      `- Monthly Income  : ₹${userProfile.monthlyIncome || (userProfile.annualIncome ? userProfile.annualIncome / 12 : "Unknown")}`,
      `- Has Aadhaar     : ${userProfile.hasAadhaar ? "Yes" : "Unknown"}`,
      `- Has Bank Account: ${userProfile.hasBankAccount ? "Yes" : "Unknown"}`,
    ].join("\n");
  }

  // Income documents block (extracted by teammate's OCR Lambda from uploaded proofs)
  let docsBlock = "INCOME DOCUMENTS: None uploaded yet.";
  const verified = (userDocs || []).filter(d =>
    d.status === "verified" || d.status === "processed" || (d.ocrConfidence >= 0.8)
  );
  if (verified.length > 0) {
    const lines = verified.map(d => {
      const income  = d.extractedData?.income || d.extractedData?.monthlyIncome || d.extractedData?.annualIncome;
      const docType = d.documentType || d.type || "Document";
      const conf    = d.ocrConfidence ? `${Math.round(d.ocrConfidence * 100)}% confidence` : "verified";
      return `- ${docType}: ${income ? `income = ₹${income}, ` : ""}${conf}`;
    });
    docsBlock = `VERIFIED INCOME DOCUMENTS:\n${lines.join("\n")}`;
  } else if ((userDocs || []).length > 0) {
    docsBlock = "INCOME DOCUMENTS: Uploaded but OCR verification still in progress.";
  }

  // Schemes block (all from DynamoDB — seeded with 8 real schemes)
  let schemesBlock = "GOVERNMENT SCHEMES: Data unavailable.";
  if ((allSchemes || []).length > 0) {
    const lines = allSchemes.map(s => {
      const parts = [
        `NAME: ${s.schemeName}`,
        s.description        ? `DESC: ${s.description}`                         : null,
        s.maxAnnualIncome    ? `MAX ANNUAL INCOME: ₹${s.maxAnnualIncome}`        : null,
        s.maxMonthlyIncome   ? `MAX MONTHLY INCOME: ₹${s.maxMonthlyIncome}`      : null,
        s.minAge             ? `MIN AGE: ${s.minAge}`                            : null,
        s.maxAge             ? `MAX AGE: ${s.maxAge}`                            : null,
        s.targetGroup        ? `FOR: ${s.targetGroup}`                           : null,
        s.requiredDocuments  ? `DOCS NEEDED: ${s.requiredDocuments.join(", ")}`  : null,
        s.benefits           ? `BENEFITS: ${s.benefits}`                         : null,
        s.applyUrl           ? `APPLY AT: ${s.applyUrl}`                         : null,
      ].filter(Boolean);
      return `[${s.schemeId}]\n  ${parts.join("\n  ")}`;
    });
    schemesBlock = `OFFICIAL GOVERNMENT SCHEMES (verified list — 8 schemes):\n${lines.join("\n\n")}`;
  }

  return `
${langCfg.systemHint}

YOUR ROLE: Help users understand which government schemes they qualify for,
how to apply, what benefits they receive, and whether a scheme is real or fraudulent.

STRICT RULES:
1. ONLY recommend schemes from the OFFICIAL GOVERNMENT SCHEMES list below.
2. Compare the user's ACTUAL income, age, occupation, and state to determine eligibility.
3. If asked "is [scheme name] real?" — check the list. If NOT found, warn the user it may be a scam.
4. If profile/income data is missing, give general guidance and prompt user to upload documents.
5. ALWAYS include the official APPLY AT link when recommending a scheme.
6. Keep responses under 150 words. Be concise, warm, and encouraging.
7. Do NOT discuss topics unrelated to government welfare schemes.

════════════════════════════════════
${profileBlock}

${docsBlock}

${schemesBlock}
════════════════════════════════════
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bedrock: Invoke Claude 3 Haiku
// ─────────────────────────────────────────────────────────────────────────────
async function invokeBedrock(systemPrompt, userMessage) {
  const res = await bedrock.send(new InvokeModelCommand({
    modelId    : "anthropic.claude-3-haiku-20240307-v1:0",
    body       : JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens       : 512,
      system           : systemPrompt,
      messages         : [{ role: "user", content: userMessage }],
    }),
    contentType: "application/json",
    accept     : "application/json",
  }));

  const json = JSON.parse(Buffer.from(res.body).toString("utf-8"));
  return json.content?.[0]?.text || "Sorry, I could not generate a response right now.";
}

// ─────────────────────────────────────────────────────────────────────────────
//  Polly: text → mp3 → S3 → presigned URL (5 min TTL)
// ─────────────────────────────────────────────────────────────────────────────
async function synthesizeAndUpload(text, langCfg, userId) {
  const truncated = text.length > 2900 ? text.substring(0, 2900) + "…" : text;

  const pollyRes = await polly.send(new SynthesizeSpeechCommand({
    Text        : truncated,
    VoiceId     : langCfg.pollyVoice,   // Kajal (hi) | Raveena (en)
    Engine      : langCfg.pollyEngine,  // neural | standard
    OutputFormat: "mp3",
    TextType    : "text",
  }));

  const chunks = [];
  for await (const chunk of pollyRes.AudioStream) chunks.push(chunk);
  const audioBuffer = Buffer.concat(chunks);

  const s3Key = `polly-output/${userId}/${Date.now()}.mp3`;
  await s3.send(new PutObjectCommand({
    Bucket     : AUDIO_BUCKET,
    Key        : s3Key,
    Body       : audioBuffer,
    ContentType: "audio/mpeg",
  }));

  return await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: AUDIO_BUCKET, Key: s3Key }),
    { expiresIn: 300 }
  );
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));