// Re-export shared types for frontend use
// In production, this would import from the shared package
// For now, we define them inline to avoid monorepo complexity

export type Language = 'hi' | 'en';

export interface UserProfile {
  name?: string;
  occupation?: string;
  location?: string;
  district?: string;
  state?: string;
  pincode?: string;
  phone?: string;
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

export type DocumentType = 'invoice' | 'receipt' | 'bank_statement' | 'aadhaar' | 'pan' | 'other';
export type VerificationStatus = 'unverified' | 'verified' | 'pending_review';

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
  schemes?: SchemeMatch[];
  suggestedActions?: string[];
}

export interface SchemeMatch {
  schemeId: string;
  schemeName: string;
  description: string;
  eligibilityScore: number;
  matchReasons: string[];
  missingRequirements?: string[];
}

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

export interface VerificationResult {
  valid: boolean;
  isValid: boolean;
  reportId: string;
  trustScore: number;
  generatedAt: string;
  verifiedAt: string;
  blockchainTxId: string;
  blockchainHash: string;
  totalIncome: number;
  period: string;
  verifiedDocuments: number;
  totalDocuments: number;
  incomeData: {
    totalIncome: number;
    averageMonthlyIncome: number;
    documentCount: number;
    period: { start: number; end: number };
  };
}

export interface ConsentRecord {
  userId: string;
  consentType: string;
  version: string;
  granted: boolean;
  timestamp: number;
}

export interface VerificationQueueItem {
  documentId: string;
  userId: string;
  addedAt: number;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected';
  ocrConfidence: number;
  extractedData: ExtractedDocumentData;
  fileName: string;
  fileType: string;
  documentUrl?: string;
  documentType: string;
  userName: string;
  submittedAt: string;
  verifiedAt?: string;
  verifierNotes?: string;
}

export interface DraftDocument {
  localId: string;
  fileName: string;
  docType: DocumentType;
  declaredPeriodStart?: string;
  declaredPeriodEnd?: string;
  addedAt: number;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
}
