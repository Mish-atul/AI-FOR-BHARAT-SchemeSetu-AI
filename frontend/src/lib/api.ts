// SchemeSetu AI — Frontend API Service Layer
// Handles all API calls with mock fallback for local development

import {
  AuthResponse, ChatMessage, ChatResponse, ConsentRecord, DocumentMetadata,
  DocumentUploadResult, IncomeReport, Language, SchemeMatch, TrustScore,
  UserRecord, VerificationQueueItem, VerificationResult, VoiceResponse
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const USE_MOCK = !process.env.NEXT_PUBLIC_API_URL;

// ---- Helpers ----
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('schemesetu_token');
}

function setToken(token: string) {
  localStorage.setItem('schemesetu_token', token);
}

function clearToken() {
  localStorage.removeItem('schemesetu_token');
}

function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('schemesetu_userId');
}

function setUserId(id: string) {
  localStorage.setItem('schemesetu_userId', id);
}

async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || 'API Error');
  }
  return res.json();
}

// ============================================================
// AUTH
// ============================================================
export async function requestOTP(phoneNumber: string): Promise<{ success: boolean }> {
  if (USE_MOCK) return mockRequestOTP(phoneNumber);
  return apiCall('/auth/otp', { method: 'POST', body: JSON.stringify({ phoneNumber }) });
}

export async function verifyOTP(phoneNumber: string, otp: string): Promise<AuthResponse> {
  if (USE_MOCK) return mockVerifyOTP(phoneNumber, otp);
  const res = await apiCall<AuthResponse>('/auth/otp/verify', {
    method: 'POST', body: JSON.stringify({ phoneNumber, otp })
  });
  setToken(res.token);
  setUserId(res.userId);
  return res;
}

export async function logout() {
  clearToken();
  localStorage.removeItem('schemesetu_userId');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getCurrentUserId(): string | null {
  return getUserId();
}

// ============================================================
// USER PROFILE
// ============================================================
export async function getProfile(): Promise<UserRecord> {
  if (USE_MOCK) return mockGetProfile();
  return apiCall('/profile');
}

export async function updateProfile(profile: Partial<UserRecord['profile']>): Promise<UserRecord> {
  if (USE_MOCK) return mockUpdateProfile(profile);
  return apiCall('/profile', { method: 'PUT', body: JSON.stringify({ profile }) });
}

// ============================================================
// DOCUMENTS
// ============================================================
export async function uploadDocument(
  file: File, docType: string, periodStart?: string, periodEnd?: string
): Promise<DocumentUploadResult> {
  if (USE_MOCK) return mockUploadDocument(file, docType);

  // Convert file to base64 for the Lambda handler
  const fileBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>" — strip the prefix
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const userId = getUserId() || 'anonymous';

  return apiCall('/documents', {
    method: 'POST',
    body: JSON.stringify({ fileBase64, fileName: file.name, userId, docType, periodStart, periodEnd }),
  });
}

export async function getDocuments(): Promise<DocumentMetadata[]> {
  if (USE_MOCK) return mockGetDocuments();
  return apiCall('/documents');
}

export async function getDocument(docId: string): Promise<DocumentMetadata> {
  if (USE_MOCK) return mockGetDocument(docId);
  return apiCall(`/documents/${docId}`);
}

export async function deleteDocument(docId: string): Promise<void> {
  if (USE_MOCK) return mockDeleteDocument(docId);
  return apiCall(`/documents/${docId}`, { method: 'DELETE' });
}

// ============================================================
// CHATBOT
// ============================================================
export async function sendChatMessage(
  sessionId: string, text: string, language: Language
): Promise<ChatResponse> {
  if (USE_MOCK) return mockSendChat(sessionId, text, language);
  return apiCall('/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId, language, inputType: 'text', text })
  });
}

export async function sendVoiceMessage(
  sessionId: string, audioBlob: Blob, language: Language
): Promise<VoiceResponse> {
  if (USE_MOCK) return mockSendVoice(sessionId, language);
  const formData = new FormData();
  formData.append('audio', audioBlob);
  formData.append('sessionId', sessionId);
  formData.append('language', language);
  return apiCall('/chat/voice', { method: 'POST', body: formData });
}

// ============================================================
// SCHEMES
// ============================================================
export async function getEligibleSchemes(): Promise<SchemeMatch[]> {
  if (USE_MOCK) return mockGetSchemes();
  return apiCall('/schemes/eligible');
}

// ============================================================
// REPORTS
// ============================================================
export async function generateReport(startDate: string, endDate: string): Promise<IncomeReport> {
  if (USE_MOCK) return mockGenerateReport(startDate, endDate);
  return apiCall('/reports', {
    method: 'POST', body: JSON.stringify({ startDate, endDate })
  });
}

export async function getReports(): Promise<IncomeReport[]> {
  if (USE_MOCK) return mockGetReports();
  return apiCall('/reports');
}

// ============================================================
// TRUST SCORE
// ============================================================
export async function getTrustScore(): Promise<TrustScore> {
  if (USE_MOCK) return mockGetTrustScore();
  // Trust score is computed from reports endpoint
  const reports = await apiCall<IncomeReport[]>('/reports');
  if (reports.length > 0) {
    return {
      score: reports[0].trustScore,
      factors: [
        { name: 'Document Quality', weight: 0.3, value: reports[0].trustScore, description: 'Quality of uploaded documents' },
        { name: 'Verification Rate', weight: 0.3, value: reports[0].verifiedDocumentCount / Math.max(reports[0].documentCount, 1), description: 'Proportion of verified documents' },
        { name: 'Recency', weight: 0.2, value: 0.8, description: 'How recent your documents are' },
        { name: 'Diversity', weight: 0.2, value: 0.7, description: 'Variety of document types' },
      ],
      lastUpdated: reports[0].generatedAt,
    };
  }
  return { score: 0, factors: [], lastUpdated: Date.now() };
}

// ============================================================
// VERIFICATION
// ============================================================
export async function verifyReport(qrCodeData: string): Promise<VerificationResult> {
  if (USE_MOCK) return mockVerifyReport(qrCodeData);
  // Extract reportId from QR data and call GET /verify/{reportId}
  const reportId = qrCodeData.startsWith('{') ? JSON.parse(qrCodeData).reportId : qrCodeData;
  return apiCall(`/verify/${reportId}`);
}

// ============================================================
// CONSENT
// ============================================================
export async function grantConsent(consentType: string, version: string): Promise<ConsentRecord> {
  if (USE_MOCK) return mockGrantConsent(consentType, version);
  return apiCall('/consent', {
    method: 'POST', body: JSON.stringify({ consentType, version })
  });
}

export async function getConsentStatus(): Promise<ConsentRecord[]> {
  if (USE_MOCK) return mockGetConsent();
  return apiCall('/consent');
}

export async function revokeConsent(consentType: string): Promise<void> {
  if (USE_MOCK) return;
  return apiCall('/consent', { method: 'DELETE', body: JSON.stringify({ consentType }) });
}

// ============================================================
// CSC OPERATOR
// ============================================================
export async function getVerificationQueue(): Promise<VerificationQueueItem[]> {
  if (USE_MOCK) return mockGetQueue();
  return apiCall('/csc/queue');
}

export async function submitVerification(
  docId: string, corrections: Record<string, any>, approved: boolean
): Promise<void> {
  if (USE_MOCK) return;
  return apiCall(`/csc/queue/${docId}`, {
    method: 'PUT', body: JSON.stringify({ corrections, approved })
  });
}

// ============================================================
// ACCOUNT DELETION
// ============================================================
export async function deleteAccount(otp: string): Promise<void> {
  if (USE_MOCK) { clearToken(); return; }
  return apiCall('/account', { method: 'DELETE', body: JSON.stringify({ confirmation: 'DELETE_MY_ACCOUNT' }) });
}

// ============================================================
// MOCK IMPLEMENTATIONS (for local dev without AWS backend)
// ============================================================

const MOCK_DELAY = 500;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Mock data store 
let mockDocuments: DocumentMetadata[] = [
  {
    documentId: 'doc_001', userId: 'user_demo', fileName: 'bank_statement_jan.pdf',
    fileType: 'pdf', uploadTimestamp: Date.now() - 86400000 * 30, hash: 'sha256:a1b2c3d4e5f6...',
    blockchainTxId: 'tx_0x001', verificationStatus: 'verified', ocrConfidence: 92,
    extractedData: { date: '2026-01-15', amount: 12000, vendor: 'SBI Bank', description: 'Monthly salary credit' },
    docType: 'bank_statement', declaredPeriodStart: '2026-01-01', declaredPeriodEnd: '2026-01-31'
  },
  {
    documentId: 'doc_002', userId: 'user_demo', fileName: 'invoice_feb.png',
    fileType: 'png', uploadTimestamp: Date.now() - 86400000 * 15, hash: 'sha256:f7e8d9c0b1a2...',
    blockchainTxId: 'tx_0x002', verificationStatus: 'verified', ocrConfidence: 87,
    extractedData: { date: '2026-02-10', amount: 8500, vendor: 'Ganesh Traders', description: 'Vegetable supply invoice' },
    docType: 'invoice', declaredPeriodStart: '2026-02-01', declaredPeriodEnd: '2026-02-28'
  },
  {
    documentId: 'doc_003', userId: 'user_demo', fileName: 'receipt_march.jpg',
    fileType: 'jpg', uploadTimestamp: Date.now() - 86400000 * 5, hash: 'sha256:1a2b3c4d5e6f...',
    blockchainTxId: 'tx_0x003', verificationStatus: 'pending_review', ocrConfidence: 65,
    extractedData: { date: '2026-02-25', amount: 5200, vendor: 'Local Market', description: 'Goods sold' },
    docType: 'receipt'
  },
  {
    documentId: 'doc_004', userId: 'user_demo', fileName: 'aadhaar_card.pdf',
    fileType: 'pdf', uploadTimestamp: Date.now() - 86400000 * 60, hash: 'sha256:9z8y7x6w5v4u...',
    blockchainTxId: 'tx_0x004', verificationStatus: 'verified', ocrConfidence: 95,
    extractedData: { date: '2020-05-15', description: 'Aadhaar Card - XXXX XXXX 1234' },
    docType: 'aadhaar'
  },
];

let mockUser: UserRecord = {
  userId: 'user_demo', phoneNumber: '+919876543210', createdAt: Date.now() - 86400000 * 90,
  lastLoginAt: Date.now(), language: 'en',
  profile: {
    name: 'Ramesh Kumar', occupation: 'Street Vendor', location: 'Lucknow, UP',
    age: 35, monthlyIncome: 12000, houseOwnershipStatus: 'no', residenceState: 'Uttar Pradesh'
  },
  trustScore: 78, consentVersion: 'v1.0', deleted: false
};

async function mockRequestOTP(phone: string) {
  await delay(MOCK_DELAY);
  console.log(`[MOCK] OTP sent to ${phone}: 123456`);
  return { success: true };
}

async function mockVerifyOTP(phone: string, otp: string): Promise<AuthResponse> {
  await delay(MOCK_DELAY);
  if (otp !== '123456') throw new Error('Invalid OTP');
  const token = 'mock_jwt_' + Date.now();
  setToken(token);
  setUserId('user_demo');
  return { token, userId: 'user_demo', isNewUser: false, requiresConsent: false };
}

async function mockGetProfile(): Promise<UserRecord> {
  await delay(MOCK_DELAY);
  return { ...mockUser };
}

async function mockUpdateProfile(profile: Partial<UserRecord['profile']>): Promise<UserRecord> {
  await delay(MOCK_DELAY);
  mockUser = { ...mockUser, profile: { ...mockUser.profile, ...profile } };
  return { ...mockUser };
}

async function mockUploadDocument(file: File, docType: string): Promise<DocumentUploadResult> {
  await delay(1500);
  const docId = 'doc_' + Math.random().toString(36).substring(2, 8);
  const hash = 'sha256:' + Math.random().toString(36).substring(2, 18);
  const txId = 'tx_0x' + Math.random().toString(36).substring(2, 8);
  const confidence = Math.random() * 40 + 60; // 60-100
  const newDoc: DocumentMetadata = {
    documentId: docId, userId: 'user_demo', fileName: file.name,
    fileType: file.name.split('.').pop() || 'pdf', uploadTimestamp: Date.now(),
    hash, blockchainTxId: txId,
    verificationStatus: confidence >= 80 ? 'verified' : 'pending_review',
    ocrConfidence: Math.round(confidence),
    extractedData: {
      date: new Date().toISOString().split('T')[0],
      amount: Math.round(Math.random() * 15000 + 3000),
      vendor: 'Extracted Vendor',
      description: 'Extracted from ' + file.name
    },
    docType: docType as any,
  };
  mockDocuments.push(newDoc);
  return {
    documentId: docId, hash, blockchainTxId: txId,
    ocrStatus: confidence >= 80 ? 'completed' : 'queued_for_review',
    extractedData: newDoc.extractedData
  };
}

async function mockGetDocuments(): Promise<DocumentMetadata[]> {
  await delay(MOCK_DELAY);
  return [...mockDocuments];
}

async function mockGetDocument(docId: string): Promise<DocumentMetadata> {
  await delay(MOCK_DELAY);
  const doc = mockDocuments.find(d => d.documentId === docId);
  if (!doc) throw new Error('Document not found');
  return { ...doc };
}

async function mockDeleteDocument(docId: string): Promise<void> {
  await delay(MOCK_DELAY);
  mockDocuments = mockDocuments.filter(d => d.documentId !== docId);
}

async function mockSendChat(sessionId: string, text: string, language: Language): Promise<ChatResponse> {
  await delay(1000);
  const lowerText = text.toLowerCase();

  // Scheme discovery intent
  if (lowerText.includes('scheme') || lowerText.includes('eligible') || lowerText.includes('योजना') || lowerText.includes('पात्र')) {
    const schemes = await mockGetSchemes();
    return {
      sessionId, intent: 'scheme_discovery', language,
      message: language === 'hi'
        ? `आपकी प्रोफ़ाइल के आधार पर, मुझे ${schemes.length} योजनाएं मिलीं जिनके लिए आप पात्र हो सकते हैं। यहां विवरण हैं:`
        : `Based on your profile, I found ${schemes.length} schemes you may be eligible for. Here are the details:`,
      eligibleSchemes: schemes,
      suggestedActions: language === 'hi'
        ? ['आवेदन कैसे करें?', 'अधिक योजनाएं दिखाएं', 'रिपोर्ट बनाएं']
        : ['How to apply?', 'Show more schemes', 'Generate report']
    };
  }

  // Trust score intent
  if (lowerText.includes('trust') || lowerText.includes('score') || lowerText.includes('विश्वास')) {
    return {
      sessionId, intent: 'trust_score', language,
      message: language === 'hi'
        ? 'आपका वर्तमान ट्रस्ट स्कोर 78/100 है। इसे बेहतर बनाने के लिए अधिक सत्यापित दस्तावेज़ अपलोड करें।'
        : 'Your current Trust Score is 78/100. To improve it, upload more verified documents and maintain consistent income records.',
      suggestedActions: language === 'hi'
        ? ['दस्तावेज़ अपलोड करें', 'स्कोर विवरण देखें']
        : ['Upload documents', 'View score breakdown']
    };
  }

  // Document help
  if (lowerText.includes('document') || lowerText.includes('upload') || lowerText.includes('दस्तावेज़')) {
    return {
      sessionId, intent: 'document_help', language,
      message: language === 'hi'
        ? 'आप बैंक स्टेटमेंट, रसीदें, चालान, और पहचान पत्र अपलोड कर सकते हैं। PDF, PNG, JPG और CSV प्रारूप स्वीकार किए जाते हैं (10MB तक)।'
        : 'You can upload bank statements, receipts, invoices, and identity documents. We accept PDF, PNG, JPG, and CSV formats (up to 10MB). Each document is encrypted and stored securely.',
      suggestedActions: language === 'hi'
        ? ['दस्तावेज़ अपलोड करें', 'मेरे दस्तावेज़ देखें']
        : ['Upload a document', 'View my documents']
    };
  }

  // Report intent
  if (lowerText.includes('report') || lowerText.includes('income') || lowerText.includes('रिपोर्ट') || lowerText.includes('आय')) {
    return {
      sessionId, intent: 'report_generation', language,
      message: language === 'hi'
        ? 'मैं आपकी आय रिपोर्ट बना सकता हूं। यह रिपोर्ट QR कोड के साथ आएगी जिसे बैंक सत्यापित कर सकते हैं।'
        : 'I can generate your income report. It will include a QR code that banks and verifiers can use to validate your income claims on the blockchain.',
      suggestedActions: language === 'hi'
        ? ['रिपोर्ट बनाएं', 'पिछली रिपोर्ट देखें']
        : ['Generate report', 'View past reports']
    };
  }

  // Default response
  return {
    sessionId, intent: 'general', language,
    message: language === 'hi'
      ? 'नमस्ते! मैं SchemeSetu AI हूं। मैं आपकी मदद कर सकता हूं: योजनाओं की खोज, दस्तावेज़ प्रबंधन, आय रिपोर्ट बनाना, और ट्रस्ट स्कोर समझना। आप क्या जानना चाहते हैं?'
      : 'Hello! I\'m SchemeSetu AI. I can help you with: discovering eligible government schemes, managing documents, generating income reports, and understanding your trust score. What would you like to know?',
    suggestedActions: language === 'hi'
      ? ['योजनाएं खोजें', 'दस्तावेज़ अपलोड करें', 'रिपोर्ट बनाएं', 'ट्रस्ट स्कोर देखें']
      : ['Find schemes', 'Upload documents', 'Generate report', 'View trust score']
  };
}

async function mockSendVoice(sessionId: string, language: Language): Promise<VoiceResponse> {
  await delay(2000);
  const chatRes = await mockSendChat(sessionId, 'schemes', language);
  return {
    ...chatRes,
    audioUrl: '',
    transcript: language === 'hi' ? 'कौन सी योजनाएं मेरे लिए हैं?' : 'Which schemes am I eligible for?',
    confidence: 0.89
  };
}

async function mockGetSchemes(): Promise<SchemeMatch[]> {
  await delay(MOCK_DELAY);
  return [
    {
      schemeId: 'PMAY-mock-001', schemeName: 'Pradhan Mantri Awas Yojana (PMAY)',
      description: 'Affordable Housing Subsidy — Get financial assistance for building or buying a house.',
      eligibilityScore: 92,
      matchReasons: ['Monthly income ≤ ₹15,000 ✓', 'Does not own a pucca house ✓', 'Age ≥ 18 ✓'],
      missingRequirements: []
    },
    {
      schemeId: 'PMKISAN-mock-003', schemeName: 'PM-KISAN Samman Nidhi',
      description: 'Direct income support of ₹6,000/year for small and marginal farmers.',
      eligibilityScore: 75,
      matchReasons: ['Income within eligible range ✓', 'Valid Aadhaar on file ✓'],
      missingRequirements: ['Land ownership proof required']
    },
    {
      schemeId: 'MUDRA-mock-004', schemeName: 'Pradhan Mantri Mudra Yojana',
      description: 'Micro-loans up to ₹10 lakh for small business owners and street vendors.',
      eligibilityScore: 88,
      matchReasons: ['Occupation: Street Vendor ✓', 'Income records available ✓', 'Trust Score ≥ 50 ✓'],
      missingRequirements: ['Business registration (optional)']
    },
    {
      schemeId: 'AYUSH-mock-005', schemeName: 'Ayushman Bharat (PM-JAY)',
      description: 'Free health insurance coverage of ₹5 lakh per family per year for secondary and tertiary care.',
      eligibilityScore: 85,
      matchReasons: ['Annual income in eligible bracket ✓', 'Aadhaar verified ✓'],
      missingRequirements: []
    },
    {
      schemeId: 'StatePension-mock-002', schemeName: 'State Senior Citizen Pension',
      description: 'Monthly pension for senior citizens aged 60+ with low income.',
      eligibilityScore: 0,
      matchReasons: [],
      missingRequirements: ['Age must be ≥ 60 (current: 35)', 'Must be resident of eligible state']
    }
  ];
}

async function mockGenerateReport(startDate: string, endDate: string): Promise<IncomeReport> {
  await delay(2000);
  return {
    reportId: 'rep_' + Math.random().toString(36).substring(2, 8),
    userId: 'user_demo',
    generatedAt: Date.now(),
    period: { start: new Date(startDate).getTime(), end: new Date(endDate).getTime() },
    totalIncome: 25700,
    averageMonthlyIncome: 12850,
    documentCount: 4,
    verifiedDocumentCount: 3,
    trustScore: 78,
    pdfUrl: '#',
    qrCodeData: `schemesetu:verify:sha256:${Math.random().toString(36).substring(2, 18)}:rep_demo`,
    reportHash: 'sha256:' + Math.random().toString(36).substring(2, 18)
  };
}

async function mockGetReports(): Promise<IncomeReport[]> {
  await delay(MOCK_DELAY);
  return [
    {
      reportId: 'rep_demo_001', userId: 'user_demo', generatedAt: Date.now() - 86400000 * 7,
      period: { start: Date.now() - 86400000 * 90, end: Date.now() - 86400000 * 7 },
      totalIncome: 36000, averageMonthlyIncome: 12000, documentCount: 3, verifiedDocumentCount: 3,
      trustScore: 78, pdfUrl: '#', qrCodeData: 'schemesetu:verify:sha256:abc123:rep_demo_001',
      reportHash: 'sha256:abc123def456'
    }
  ];
}

async function mockGetTrustScore(): Promise<TrustScore> {
  await delay(MOCK_DELAY);
  return {
    score: 78,
    factors: [
      { name: 'Document Quality', weight: 40, value: 0.85, description: 'Average OCR confidence × verification status across all documents' },
      { name: 'Income Stability', weight: 30, value: 0.72, description: 'Consistency of monthly income (lower variance = higher score)' },
      { name: 'Recency', weight: 15, value: 0.67, description: 'Proportion of last 12 months with verified documents' },
      { name: 'Source Reliability', weight: 15, value: 0.80, description: 'Weighted reliability of document sources (bank=1.0, UPI=0.9, self=0.4)' }
    ],
    lastUpdated: Date.now() - 86400000
  };
}

async function mockVerifyReport(qrCodeData: string): Promise<VerificationResult> {
  await delay(1500);
  return {
    valid: true,
    isValid: true,
    reportId: 'rep_demo_001',
    trustScore: 78,
    generatedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    verifiedAt: new Date().toISOString(),
    blockchainTxId: 'tx_0x789abc',
    blockchainHash: 'sha256:7d4e3f2a1b9c8d5e6f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
    totalIncome: 36000,
    period: 'Jan 2025 — Mar 2025',
    verifiedDocuments: 3,
    totalDocuments: 4,
    incomeData: {
      totalIncome: 36000, averageMonthlyIncome: 12000,
      documentCount: 3, period: { start: Date.now() - 86400000 * 90, end: Date.now() - 86400000 * 7 }
    }
  };
}

async function mockGrantConsent(consentType: string, version: string): Promise<ConsentRecord> {
  await delay(MOCK_DELAY);
  return { userId: 'user_demo', consentType, version, granted: true, timestamp: Date.now() };
}

async function mockGetConsent(): Promise<ConsentRecord[]> {
  await delay(MOCK_DELAY);
  return [
    { userId: 'user_demo', consentType: 'data_processing', version: 'v1.0', granted: true, timestamp: Date.now() - 86400000 * 90 },
    { userId: 'user_demo', consentType: 'scheme_matching', version: 'v1.0', granted: true, timestamp: Date.now() - 86400000 * 90 }
  ];
}

async function mockGetQueue(): Promise<VerificationQueueItem[]> {
  await delay(MOCK_DELAY);
  return mockDocuments
    .filter(d => d.verificationStatus === 'pending_review')
    .map(d => ({
      documentId: d.documentId, userId: d.userId, addedAt: d.uploadTimestamp,
      status: 'pending' as const, ocrConfidence: d.ocrConfidence,
      extractedData: d.extractedData, fileName: d.fileName, fileType: d.fileType,
      documentType: d.docType, userName: 'Ramesh Kumar',
      submittedAt: new Date(d.uploadTimestamp).toISOString(),
    }));
}
