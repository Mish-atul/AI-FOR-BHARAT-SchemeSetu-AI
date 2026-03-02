// ============================================================
// SchemeSetu AI — Shared Type Definitions
// ============================================================

// ---- User & Auth ----
export type Language = 'hi' | 'en';

export interface UserProfile {
  name?: string;
  occupation?: string;
  location?: string;
  age?: number;
  monthlyIncome?: number;
  houseOwnershipStatus?: 'yes' | 'no';
  residenceState?: string;
}

export interface UserRecord {
  userId: string;
  phoneNumber: string;
  createdAt: number;
  lastLoginAt: number;
  language: Language;
  profile: UserProfile;
  trustScore: number;
  consentVersion: string;
  deleted: boolean;
}

export interface AuthResponse {
  token: string;
  userId: string;
  isNewUser: boolean;
  requiresConsent: boolean;
}

export interface OTPRequest {
  phoneNumber: string;
}

export interface OTPVerifyRequest {
  phoneNumber: string;
  otp: string;
}

// ---- Documents ----
export type DocumentType = 'invoice' | 'receipt' | 'bank_statement' | 'aadhaar' | 'pan' | 'other';
export type VerificationStatus = 'unverified' | 'verified' | 'pending_review';
export type FileType = 'pdf' | 'png' | 'jpg' | 'jpeg' | 'csv';

export interface ExtractedDocumentData {
  date?: string;
  amount?: number;
  vendor?: string;
  description?: string;
  category?: string;
}

export interface DocumentUploadResult {
  documentId: string;
  hash: string;
  blockchainTxId: string;
  ocrStatus: 'pending' | 'completed' | 'queued_for_review';
  extractedData?: ExtractedDocumentData;
}

export interface DocumentMetadata {
  documentId: string;
  userId: string;
  fileName: string;
  fileType: string;
  uploadTimestamp: number;
  hash: string;
  blockchainTxId: string;
  verificationStatus: VerificationStatus;
  ocrConfidence: number;
  extractedData: ExtractedDocumentData;
  docType: DocumentType;
  declaredPeriodStart?: string;
  declaredPeriodEnd?: string;
}

// ---- Blockchain / Ledger ----
export interface LedgerRecord {
  hash: string;
  prevHash: string;
  userId: string;
  documentId: string;
  timestamp: number;
  txId: string;
  metadata: {
    documentType: string;
    fileName: string;
  };
}

// ---- Chatbot ----
export interface ChatRequest {
  sessionId: string;
  language: Language;
  inputType: 'text' | 'voice';
  text?: string;
  audioBase64?: string;
}

export interface ChatResponse {
  sessionId: string;
  message: string;
  intent: string;
  language: Language;
  suggestedActions?: string[];
  eligibleSchemes?: SchemeMatch[];
}

export interface VoiceResponse extends ChatResponse {
  audioUrl: string;
  transcript: string;
  confidence: number;
}

export interface ChatMessage {
  id: string;
  timestamp: number;
  role: 'user' | 'assistant';
  content: string;
  language: Language;
  audioUrl?: string;
}

// ---- Scheme Matching ----
export type RuleOperator = 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';

export interface SchemeRule {
  field: string;
  operator: RuleOperator;
  value: any;
  description: string;
}

export interface SchemeDefinition {
  schemeId: string;
  name: string;
  nameHi: string;
  description: string;
  descriptionHi: string;
  benefits: string[];
  benefitsHi: string[];
  rules: SchemeRule[];
  documentsRequired: string[];
  priority: number;
  applicationProcess: string;
  applicationProcessHi: string;
}

export interface SchemeMatch {
  schemeId: string;
  schemeName: string;
  description: string;
  eligibilityScore: number;
  matchReasons: string[];
  missingRequirements?: string[];
}

export interface EligibilityResult {
  eligible: boolean;
  score: number;
  matchedCriteria: string[];
  unmatchedCriteria: string[];
  suggestions: string[];
}

// ---- Reports ----
export interface IncomeReport {
  reportId: string;
  userId: string;
  generatedAt: number;
  period: { start: number; end: number };
  totalIncome: number;
  averageMonthlyIncome: number;
  documentCount: number;
  verifiedDocumentCount: number;
  trustScore: number;
  pdfUrl: string;
  qrCodeData: string;
  reportHash: string;
}

export interface TrustScore {
  score: number;
  factors: TrustScoreFactor[];
  lastUpdated: number;
}

export interface TrustScoreFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

// ---- Verification ----
export interface VerificationRequest {
  qrCodeData: string;
}

export interface VerificationResult {
  valid: boolean;
  reportId: string;
  trustScore: number;
  generatedAt: number;
  verifiedAt: number;
  blockchainTxId: string;
  incomeData: {
    totalIncome: number;
    averageMonthlyIncome: number;
    documentCount: number;
    period: { start: number; end: number };
  };
}

export interface VerificationAttempt {
  verifierId: string;
  timestamp: number;
  result: 'valid' | 'invalid' | 'error';
}

// ---- Consent ----
export interface ConsentRecord {
  userId: string;
  consentType: string;
  version: string;
  granted: boolean;
  timestamp: number;
}

// ---- Verification Queue (CSC) ----
export interface VerificationQueueItem {
  documentId: string;
  userId: string;
  addedAt: number;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed';
  ocrConfidence: number;
  extractedData: ExtractedDocumentData;
  fileName: string;
  fileType: string;
  documentUrl?: string;
}

// ---- Error ----
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    retryable: boolean;
  };
  requestId: string;
  timestamp: number;
}

// ---- Offline / Draft ----
export interface DraftDocument {
  localId: string;
  file: File;
  docType: DocumentType;
  declaredPeriodStart?: string;
  declaredPeriodEnd?: string;
  addedAt: number;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
}
