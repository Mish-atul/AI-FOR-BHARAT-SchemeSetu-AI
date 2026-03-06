# Requirements Document: SchemeSetu AI

## Introduction

SchemeSetu AI is a privacy-first trust wallet and scheme discovery platform designed for informal workers in India who lack formal proof of income and identity. The system enables users to securely store documents, generate verifiable income reports, discover eligible government schemes, and build trust scores for micro-loan facilitation. The platform uses blockchain-anchored document hashing, multilingual voice/text chatbot interfaces, and encrypted storage to provide accessible, secure, and privacy-preserving services.

## Problem Statement

**Note (placeholder):** Replace the following placeholder statistics with a verified citation before final submission:
- "Approximately 90% of India's workforce is in the informal sector (placeholder)." ← Replace with an authoritative source (e.g., Govt. labour report or World Bank stat).
- "X% of workers in the target region are informal." ← Replace with an authoritative source.

Informal workers face significant barriers in accessing government schemes and financial services due to lack of formal income proof and identity documentation. This creates a trust gap that prevents them from accessing benefits they are entitled to and obtaining micro-loans for business growth.

## Glossary

- **Trust_Wallet**: The core system component that manages user documents, generates verifiable reports, and maintains trust scores
- **Document_Hash**: SHA-256 cryptographic hash of uploaded documents stored on blockchain ledger
- **Blockchain_Ledger**: AWS QLDB or Managed Blockchain service storing immutable document hashes
- **Chatbot**: Multilingual conversational interface powered by Amazon Lex/Bedrock
- **Voice_Interface**: Speech-to-text and text-to-speech system using Amazon Transcribe and Polly
- **OCR_Engine**: Amazon Textract service for extracting text from document images
- **Trust_Score**: Computed metric based on document completeness, verification status, and consistency
- **Verifiable_Report**: Income report with QR code containing blockchain-anchored proof
- **CSC_Operator**: Common Service Center operator who assists users with document upload
- **Verifier**: Bank or institution validating trust reports for loan decisions
- **Informal_Worker**: Primary user persona requiring income proof and scheme discovery
- **Scheme_Matcher**: Rule-based engine matching user profiles to eligible government schemes
- **Consent_Manager**: System tracking user consent with versioning for data usage
- **Verification_Queue**: Manual review queue for low-confidence OCR results
- **KMS**: AWS Key Management Service for encryption key management
- **S3_Bucket**: Encrypted document storage location
- **Auth_Service**: AWS Cognito-based phone/OTP authentication system

## Requirements

### Requirement 1: Document Upload and Storage

**User Story:** As an informal worker, I want to upload my income documents (invoices, receipts, bank statements), so that I can build a verifiable record of my earnings.

#### Acceptance Criteria

1. WHEN a user uploads a document (PDF, image, or CSV), THE Trust_Wallet SHALL accept files up to 10MB in size
2. WHEN a document is uploaded, THE Trust_Wallet SHALL compute a SHA-256 hash of the document content
3. WHEN a document hash is computed, THE Trust_Wallet SHALL store the hash in the Blockchain_Ledger with timestamp and user identifier
4. WHEN a document is uploaded, THE Trust_Wallet SHALL encrypt the document using KMS and store it in the S3_Bucket
5. WHEN document storage completes, THE Trust_Wallet SHALL return a unique document identifier to the user
6. IF a document upload fails, THEN THE Trust_Wallet SHALL return a descriptive error message and maintain system state

### Requirement 2: Document OCR and Extraction

**User Story:** As an informal worker, I want the system to automatically extract information from my documents, so that I don't have to manually enter all details.

#### Acceptance Criteria

1. WHEN a document image or PDF is uploaded, THE OCR_Engine SHALL extract text content from the document
2. WHEN text extraction completes, THE OCR_Engine SHALL identify key fields (date, amount, vendor, description)
3. WHEN OCR confidence is below 80%, THE Trust_Wallet SHALL add the document to the Verification_Queue
4. WHEN OCR confidence is 80% or above, THE Trust_Wallet SHALL automatically accept the extracted data
5. WHEN extracted data is available, THE Trust_Wallet SHALL present it to the user for confirmation

### Requirement 3: Manual Verification Queue

**User Story:** As a CSC operator, I want to review documents with low OCR confidence, so that users can still benefit from the system even with poor quality documents.

#### Acceptance Criteria

1. WHEN a document enters the Verification_Queue, THE Trust_Wallet SHALL notify assigned CSC operators
2. WHEN a CSC operator reviews a document, THE Trust_Wallet SHALL display the original document and extracted data side-by-side
3. WHEN a CSC operator corrects extracted data, THE Trust_Wallet SHALL update the document record with verified information
4. WHEN verification is complete, THE Trust_Wallet SHALL remove the document from the Verification_Queue
5. WHEN a document is verified, THE Trust_Wallet SHALL update the user's Trust_Score accordingly

### Requirement 4: Blockchain Hash Anchoring

**User Story:** As an informal worker, I want my documents to be cryptographically verified, so that verifiers can trust my income reports without accessing my private documents.

#### Acceptance Criteria

1. WHEN a document hash is stored, THE Blockchain_Ledger SHALL create an immutable record with timestamp
2. WHEN a hash is queried, THE Blockchain_Ledger SHALL return the original hash, timestamp, and user identifier
3. THE Blockchain_Ledger SHALL prevent modification or deletion of stored hashes
4. WHEN a verification request is made, THE Trust_Wallet SHALL recompute the document hash and compare it to the ledger entry
5. FOR ALL stored hashes, querying then storing then querying SHALL return consistent results (idempotence)

### Requirement 5: Multilingual Chatbot Interface

**User Story:** As an informal worker who speaks Hindi, I want to interact with the system in my native language, so that I can easily discover schemes and navigate the platform.

#### Acceptance Criteria

1. WHEN a user initiates a chat session, THE Chatbot SHALL detect or prompt for language preference (Hindi or English initially)
2. WHEN a user sends a text message, THE Chatbot SHALL process the message in the selected language
3. WHEN the Chatbot responds, THE Chatbot SHALL format responses in the user's selected language
4. WHEN a user switches language mid-conversation, THE Chatbot SHALL continue the conversation in the new language
5. THE Chatbot SHALL maintain conversation context across multiple turns

### Requirement 6: Voice Interface

**User Story:** As an informal worker with limited literacy, I want to speak to the system instead of typing, so that I can access services without reading or writing.

#### Acceptance Criteria

1. WHEN a user initiates voice input, THE Voice_Interface SHALL record audio and convert it to text using Amazon Transcribe
2. WHEN voice-to-text conversion completes, THE Voice_Interface SHALL pass the text to the Chatbot for processing
3. WHEN the Chatbot generates a response, THE Voice_Interface SHALL convert the text response to speech using Amazon Polly
4. WHEN audio playback completes, THE Voice_Interface SHALL be ready for the next voice input
5. IF voice recognition confidence is below 70%, THEN THE Voice_Interface SHALL ask the user to repeat their input

### Requirement 7: Scheme Discovery and Matching

**User Story:** As an informal worker, I want to discover government schemes I'm eligible for, so that I can access benefits and support programs.

#### Acceptance Criteria

1. WHEN a user requests scheme discovery, THE Scheme_Matcher SHALL analyze the user's profile (income, occupation, location, documents)
2. WHEN profile analysis completes, THE Scheme_Matcher SHALL evaluate eligibility against configured scheme rules
3. WHEN eligible schemes are identified, THE Scheme_Matcher SHALL return a ranked list of schemes with eligibility explanations
4. THE Scheme_Matcher SHALL support at least 2 government schemes in the MVP
5. WHEN no eligible schemes are found, THE Scheme_Matcher SHALL suggest actions to improve eligibility

#### Example Scheme Rules (MVP)

**Scheme 1: Affordable Housing Subsidy (Mock)**
```json
{
  "schemeId": "PMAY-mock-001",
  "name": "Affordable Housing Subsidy (Mock)",
  "rules": [
    {"field":"averageMonthlyIncome","operator":"lte","value":15000,"description":"Household average monthly income <= ₹15,000"},
    {"field":"houseOwnershipStatus","operator":"eq","value":"no","description":"Does not own a pucca house"},
    {"field":"age","operator":"gte","value":18,"description":"Applicant is adult"}
  ],
  "documentsRequired": ["Aadhaar","IncomeProof"],
  "priority": 10
}
```

**Scheme 2: State Senior Citizen Pension (Mock)**
```json
{
  "schemeId": "StatePension-mock-002",
  "name": "State Senior Citizen Pension (Mock)",
  "rules": [
    {"field":"age","operator":"gte","value":60,"description":"Applicant age >= 60"},
    {"field":"averageMonthlyIncome","operator":"lte","value":10000,"description":"Monthly income <= ₹10,000"},
    {"field":"residenceState","operator":"eq","value":"StateX","description":"Resident of StateX"}
  ],
  "documentsRequired": ["Aadhaar","AgeProof","ResidenceProof"],
  "priority": 8
}
```

### Requirement 8: Verifiable Income Report Generation

**User Story:** As an informal worker, I want to generate a verifiable income report, so that I can prove my earnings to banks and lenders.

#### Acceptance Criteria

1. WHEN a user requests an income report, THE Trust_Wallet SHALL aggregate all verified documents within a specified time period
2. WHEN aggregation completes, THE Trust_Wallet SHALL compute total income, average monthly income, and document count
3. WHEN report data is ready, THE Trust_Wallet SHALL generate a PDF report with user details, income summary, and document list
4. WHEN the PDF is generated, THE Trust_Wallet SHALL create a QR code containing the report hash and blockchain verification URL
5. WHEN the report is complete, THE Trust_Wallet SHALL return the PDF with embedded QR code to the user

### Requirement 9: Trust Score Computation

**User Story:** As a bank verifier, I want to see a trust score for each user, so that I can quickly assess the reliability of their income claims.

#### Acceptance Criteria

1. WHEN a user's profile is updated, THE Trust_Wallet SHALL recompute the Trust_Score based on document completeness, verification status, and consistency
2. THE Trust_Wallet SHALL assign higher scores to users with more verified documents
3. THE Trust_Wallet SHALL assign higher scores to users with consistent income patterns over time
4. THE Trust_Wallet SHALL assign lower scores to users with unverified or low-confidence documents
5. WHEN the Trust_Score is computed, THE Trust_Wallet SHALL store it with the user profile and include it in verifiable reports

### Requirement 10: Verification API for External Verifiers

**User Story:** As a bank verifier, I want to validate a user's income report using the QR code, so that I can confirm the authenticity of their claims.

#### Acceptance Criteria

1. WHEN a verifier scans a QR code, THE Trust_Wallet SHALL extract the report hash and verification token
2. WHEN a verification request is received, THE Trust_Wallet SHALL authenticate the verifier using API credentials
3. WHEN authentication succeeds, THE Trust_Wallet SHALL retrieve the report hash from the Blockchain_Ledger
4. WHEN the hash is retrieved, THE Trust_Wallet SHALL compare it to the provided report hash
5. WHEN verification completes, THE Trust_Wallet SHALL return verification status (valid/invalid), timestamp, and trust score
6. THE Trust_Wallet SHALL NOT expose raw document content to verifiers

### Requirement 11: User Authentication

**User Story:** As an informal worker, I want to securely access my trust wallet using my phone number, so that my documents remain private.

#### Acceptance Criteria

1. WHEN a user registers, THE Auth_Service SHALL send an OTP to the provided phone number
2. WHEN the user enters the OTP, THE Auth_Service SHALL validate it within a 5-minute expiration window
3. WHEN OTP validation succeeds, THE Auth_Service SHALL create a user session with JWT token
4. WHEN a user logs in, THE Auth_Service SHALL send a new OTP and repeat the validation process
5. WHEN a session expires, THE Auth_Service SHALL require re-authentication before allowing access

### Requirement 12: Consent Management

**User Story:** As an informal worker, I want explicit control over who can access my data, so that my privacy is protected.

#### Acceptance Criteria

1. WHEN a user first registers, THE Consent_Manager SHALL present a consent form explaining data usage
2. WHEN a user grants consent, THE Consent_Manager SHALL store the consent record with version number and timestamp
3. WHEN a user revokes consent, THE Consent_Manager SHALL update the consent record and prevent further data access
4. WHEN consent terms are updated, THE Consent_Manager SHALL prompt users to review and re-consent
5. THE Consent_Manager SHALL maintain a complete audit log of all consent changes

### Requirement 13: Data Deletion Workflow

**User Story:** As an informal worker, I want to delete my data from the system, so that I can exercise my right to be forgotten.

#### Acceptance Criteria

1. WHEN a user requests data deletion, THE Trust_Wallet SHALL verify the user's identity through OTP
2. WHEN identity is verified, THE Trust_Wallet SHALL delete all documents from the S3_Bucket
3. WHEN documents are deleted, THE Trust_Wallet SHALL delete all user profile data from DynamoDB
4. WHEN profile data is deleted, THE Trust_Wallet SHALL invalidate all active user sessions
5. THE Trust_Wallet SHALL NOT delete blockchain hashes (immutable ledger), but SHALL mark the user account as deleted
6. WHEN deletion completes, THE Trust_Wallet SHALL send a confirmation message to the user

### Requirement 14: Offline and Draft Support

**User Story:** As an informal worker in a rural area with poor connectivity, I want to work on my documents offline, so that I can use the system even without internet access.

#### Acceptance Criteria

1. WHEN a user is offline, THE Trust_Wallet SHALL allow document uploads to a local draft queue
2. WHEN a user is offline, THE Trust_Wallet SHALL allow chatbot interactions using cached responses
3. WHEN connectivity is restored, THE Trust_Wallet SHALL automatically sync draft documents to the server
4. WHEN sync completes, THE Trust_Wallet SHALL process uploaded documents and update the user's profile
5. WHEN sync fails, THE Trust_Wallet SHALL retry with exponential backoff up to 3 attempts

### Requirement 15: Security and Encryption

**User Story:** As an informal worker, I want my documents to be encrypted, so that unauthorized parties cannot access my private information.

#### Acceptance Criteria

1. WHEN a document is stored in S3, THE Trust_Wallet SHALL encrypt it using KMS with AES-256 encryption
2. WHEN a document is retrieved, THE Trust_Wallet SHALL decrypt it using the same KMS key
3. WHEN data is transmitted, THE Trust_Wallet SHALL use TLS 1.2 or higher for all API communications
4. THE Trust_Wallet SHALL rotate KMS keys annually
5. THE Trust_Wallet SHALL log all encryption and decryption operations to CloudWatch

### Requirement 16: Monitoring and Logging

**User Story:** As a system administrator, I want to monitor system health and user activity, so that I can identify and resolve issues quickly.

#### Acceptance Criteria

1. WHEN any API request is processed, THE Trust_Wallet SHALL log request details to CloudWatch
2. WHEN an error occurs, THE Trust_Wallet SHALL log error details with stack trace to CloudWatch
3. WHEN system metrics exceed thresholds, THE Trust_Wallet SHALL trigger CloudWatch alarms
4. THE Trust_Wallet SHALL track key metrics: API latency, error rates, document upload success rates, OCR confidence scores
5. THE Trust_Wallet SHALL provide a dashboard displaying real-time system health metrics


## API Endpoints (Examples)

### POST /documents/upload (multipart)

**Example Request:**
```http
POST /documents/upload
Authorization: Bearer <JWT>
Content-Type: multipart/form-data

Form:
- file: (binary) bank_statement.pdf
- docType: "bank_statement"
- declaredPeriodStart: "2024-01-01"
- declaredPeriodEnd: "2024-12-31"
```

**Example Response (200):**
```json
{
  "documentId":"doc_abc123",
  "hash":"sha256:abcd1234...",
  "blockchainTxId":"tx_0x789",
  "ocrStatus":"pending"
}
```

### POST /chat/query

**Example Request:**
```http
POST /chat/query
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "sessionId":"sess_123",
  "language":"hi",
  "inputType":"text",
  "text":"Which schemes am I eligible for?"
}
```

**Example Response (200):**
```json
{
  "sessionId":"sess_123",
  "intent":"scheme_discovery",
  "eligibleSchemes":[
    {"schemeId":"PMAY-mock-001","score":88,"reasons":["income<=15000","no_house"]}
  ],
  "explanation":"Eligible for Affordable Housing - income <= ₹15,000 and no pucca house"
}
```

### POST /verifier/verify

**Example Request:**
```http
POST /verifier/verify
Authorization: ApiKey <verifier-key>
Content-Type: application/json

{
  "qrCodeData":"report:hash:sha256:abcd1234..."
}
```

**Example Response (200):**
```json
{
  "valid": true,
  "reportId": "rep_123",
  "trustScore": 78,
  "blockchainTxId": "tx_0x789",
  "generatedAt": 1690000000
}
```

## Non-Functional Requirements (NFRs)

### Performance Targets

- **Hash anchoring**: target ≤ 5s (99% of attempts)
- **PDF generation**: target ≤ 3s
- **Chatbot response latency**: median ≤ 800ms
- **System availability (pilot)**: 99.5%

### Risks and Mitigation

**Bank adoption & pilot plan:** Start pilots with local NBFCs or microfinance institutions (MFIs) and CSC centers. Provide static PDF trust reports and a human-in-the-loop verification channel initially; collect feedback and iterate toward API-based verification.

## Appendix

### Demo Script (2–3 minutes)

1. **Login & Consent**: Show OTP sign in and language selection (phone).
2. **Upload Income Proof**: Upload a sample bank statement PDF. Show returned hash and "anchored" tx-id.
3. **View Income Profile**: Open profile to show estimated monthly income, stability, and TrustScore.
4. **Chatbot Query**: Ask by voice "Which schemes can I apply for?" — show bot response with scheme and reason.
5. **Generate Report**: Click "Generate Report"; download PDF with QR.
6. **Verifier**: Use verifier UI (or mock API) to scan QR and display verification + trust score.

### Judge Q&A (Anticipated Questions)

**Q1: How do you prevent forged documents?**
A: We use multi-layer verification: (1) OCR confidence scoring routes low-quality docs to manual review, (2) Cross-document consistency checks flag anomalies, (3) Blockchain anchoring creates immutable audit trail, (4) CSC operators provide human verification for suspicious cases.

**Q2: How is the trust score calculated?**
A: Trust score uses a deterministic weighted formula based on document quality (40%), income stability (30%), recency (15%), and source reliability (15%). See design.md for complete formula and worked example.

**Q3: What if users don't have smartphones?**
A: CSC operators can assist users with document upload and verification. The system supports both self-service (mobile/web) and assisted modes (CSC kiosks).

**Q4: How do you ensure privacy?**
A: Only document hashes are stored on blockchain, never raw content. Documents are encrypted with KMS in S3. Verifiers only see aggregated income data and trust scores, not individual documents. Users have explicit consent control and right to deletion.

**Q5: What's your go-to-market strategy?**
A: Phase 1: Pilot with 2-3 MFIs and 10-20 CSC centers in one state. Phase 2: Expand to more states and add more schemes. Phase 3: Partner with banks and government portals for direct integration.

**Q6: How scalable is this architecture?**
A: Fully serverless AWS architecture (Lambda, DynamoDB, S3) scales automatically. QLDB handles 100+ TPS. We can support millions of users with horizontal scaling. Cost per user is ~₹2-5/month at scale.
