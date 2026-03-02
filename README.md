# SchemeSetu AI 🇮🇳

**Privacy-First Trust Wallet & Scheme Discovery for India's Informal Workers**

> AI for Bharat Hackathon (Amazon) — Team 0NLY FL4G$

---

## What is SchemeSetu?

SchemeSetu AI is a privacy-first digital trust wallet that helps India's 450M+ informal workers:

- **Upload & verify** income documents (wage slips, Aadhaar, bank statements) with AI-powered OCR
- **Discover** eligible government schemes through a multilingual AI chatbot (Hindi + English)
- **Generate tamper-proof** income verification reports with blockchain-style hash chains
- **Maintain full control** over their data with transparent consent management

## Live Deployment

- **API Gateway**: `https://wlkixykhq3.execute-api.ap-south-1.amazonaws.com/prod/`
- **Region**: ap-south-1 (Mumbai)
- **Frontend**: Local dev at `http://localhost:3000` (mock mode works without AWS)
- **Demo OTP**: `123456`

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────────┐
│  Next.js     │────▶│ API Gateway  │────▶│  Lambda Functions  │
│  Frontend    │     │ + Authorizer │     │  (11 handlers)     │
└─────────────┘     └──────────────┘     └────────┬───────────┘
                                                   │
                    ┌──────────────────────────────┤
                    ▼              ▼                ▼
             ┌──────────┐  ┌──────────┐     ┌──────────┐
             │ DynamoDB  │  │   S3     │     │ Bedrock  │
             │ (6 tables)│  │ + KMS    │     │ Claude 3 │
             └──────────┘  └──────────┘     └──────────┘
                    │              │
                    ▼              ▼
             ┌──────────┐  ┌──────────┐
             │ Textract  │  │ Polly +  │
             │ OCR       │  │Transcribe│
             └──────────┘  └──────────┘
```

## AWS Services Used (12 services)

| Service | Purpose |
|---------|---------|
| **Lambda** | 11 serverless functions (auth, authorizer, documents, OCR, chatbot, schemes, reports, verify, consent, CSC, deletion) |
| **DynamoDB** | 6 tables — users, documents, ledger (immutable hash chain), consent, sessions, schemes |
| **S3 + KMS** | Encrypted document storage with server-side encryption, versioning, lifecycle rules |
| **API Gateway** | REST API with custom token authorizer, throttling (100 req/s), CORS, CloudWatch logging |
| **SQS** | Async OCR processing queue with dead-letter queue (3 retries) |
| **Textract** | AI document OCR with key-value pair extraction |
| **Bedrock (Claude 3 Haiku)** | Multilingual AI chatbot for scheme discovery & guidance |
| **Transcribe** | Hindi (hi-IN) / English (en-IN) voice-to-text for chatbot |
| **Polly** | Neural voice (Kajal) for Hindi/English text-to-speech responses |
| **CloudWatch** | Centralized logging with 1-week retention |
| **X-Ray** | Distributed tracing across all Lambda functions |
| **CDK** | Infrastructure as Code — entire backend defined in a single TypeScript stack |

## Tech Stack

- **Frontend**: Next.js 16.1.6 (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui (21 components), Zustand
- **Backend**: AWS CDK v2 (TypeScript), Lambda (Node.js 20.x), DynamoDB
- **AI/ML**: Amazon Bedrock (Claude 3 Haiku), Amazon Textract, Amazon Transcribe, Amazon Polly
- **Security**: KMS encryption at rest, DynamoDB immutable ledger with SHA-256 hash chain, token-based auth
- **i18n**: Hindi + English (150+ translation keys)

## Project Structure

```
schemesetu-ai/
├── frontend/                   # Next.js web application
│   ├── src/
│   │   ├── app/               # App Router pages (13 routes)
│   │   │   ├── page.tsx       # Landing page (hero, features, team)
│   │   │   ├── login/         # Phone + OTP login
│   │   │   ├── consent/       # Data usage consent form
│   │   │   ├── verify/        # Public verification portal (no auth)
│   │   │   └── (protected)/   # Auth-required routes
│   │   │       ├── dashboard/ # Overview + trust score + quick actions
│   │   │       ├── documents/ # Drag-drop upload + OCR results
│   │   │       ├── chatbot/   # AI chatbot + voice input/output
│   │   │       ├── schemes/   # Scheme discovery + eligibility
│   │   │       ├── reports/   # Income reports + QR codes
│   │   │       ├── profile/   # User profile + danger zone
│   │   │       ├── settings/  # Language, accessibility, offline
│   │   │       └── csc/       # CSC operator verification queue
│   │   ├── components/        # Sidebar, AppLayout
│   │   └── lib/               # api.ts, store.ts, i18n.ts, types.ts
│   ├── .env.local             # API URL config (gitignored)
│   └── .env.local.example     # Template for env vars
├── backend/                    # AWS CDK infrastructure
│   ├── lib/backend-stack.ts   # Complete CDK stack (435 lines, 166 resources)
│   ├── lambda/                # Lambda function handlers
│   │   ├── shared/utils.js    # DynamoDB helpers, response builder, ledger hash chain
│   │   ├── auth/auth.js       # OTP request/verify, profile CRUD
│   │   ├── auth/authorizer.js # API Gateway custom token authorizer
│   │   ├── documents/         # Document CRUD, S3 presigned URLs, SQS
│   │   ├── ocr/               # SQS-triggered Textract processing
│   │   ├── chatbot/           # Bedrock + Transcribe + Polly integration
│   │   ├── schemes/           # 8 schemes, eligibility scoring engine
│   │   ├── reports/           # Income report generation + trust score
│   │   ├── verify/            # Public report verification + hash check
│   │   ├── consent/           # Consent CRUD + ledger audit trail
│   │   ├── csc/               # CSC verification queue management
│   │   └── deletion/          # Account deletion (Right to be Forgotten)
│   └── scripts/seed-data.js   # Seeds 8 government schemes into DynamoDB
├── shared/types/index.ts      # Shared TypeScript interfaces
├── PROGRESS.md                # Current status & what's left for teammates
└── README.md                  # This file
```

## Quick Start

### Frontend (Local Development — Mock Mode)

```bash
cd schemesetu-ai/frontend
npm install
npm run dev
# Opens at http://localhost:3000
# Uses mock data — no AWS needed
# Demo OTP: 123456
```

### Backend (AWS Deployment)

```bash
cd schemesetu-ai/backend
npm install

# Configure AWS CLI (one-time)
aws configure
# Access Key ID: <your-key>
# Secret Access Key: <your-secret>
# Region: ap-south-1
# Output: json

# Bootstrap CDK (one-time per account/region)
npx cdk bootstrap

# Deploy all infrastructure
npx cdk deploy --require-approval never

# Seed demo schemes into DynamoDB
$env:SCHEMES_TABLE="schemesetu-schemes"; node scripts/seed-data.js
```

### Connect Frontend to Live Backend

```bash
# Copy env template
copy frontend\.env.local.example frontend\.env.local

# Edit frontend\.env.local and set:
# NEXT_PUBLIC_API_URL=https://wlkixykhq3.execute-api.ap-south-1.amazonaws.com/prod

# Restart dev server
cd frontend && npm run dev
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/otp` | No | Request OTP for phone number |
| POST | `/auth/otp/verify` | No | Verify OTP and get session token |
| GET | `/profile` | Yes | Get user profile |
| PUT | `/profile` | Yes | Update user profile |
| GET | `/documents` | Yes | List all documents |
| POST | `/documents` | Yes | Upload document (presigned URL) |
| GET | `/documents/{docId}` | Yes | Get document details |
| POST | `/chat` | Yes | Send chat message |
| POST | `/chat/voice` | Yes | Send voice message |
| GET | `/schemes/eligible` | Yes | Get eligible schemes |
| GET | `/reports` | Yes | List reports |
| POST | `/reports` | Yes | Generate income report |
| GET | `/verify/{reportId}` | No | Public report verification |
| GET | `/consent` | Yes | Get consent status |
| POST | `/consent` | Yes | Grant consent |
| GET | `/csc/queue` | Yes | Get CSC verification queue |
| PUT | `/csc/queue/{docId}` | Yes | Submit verification decision |
| DELETE | `/account` | Yes | Delete account (RTBF) |

## Key Features

### 1. Privacy-First Design
- All documents encrypted at rest (AWS KMS)
- Immutable audit ledger with SHA-256 hash chain (replaces deprecated QLDB)
- Transparent consent management with versioning
- Right to be Forgotten — complete account deletion across all tables + S3
- No data shared without explicit consent

### 2. AI-Powered Document Processing
- Drag-and-drop document upload with preview
- Amazon Textract OCR with key-value pair extraction
- Auto-verification for high-confidence extractions (>80%)
- CSC operator review queue for low-confidence documents

### 3. Multilingual AI Chatbot
- Hindi + English natural language understanding
- Voice input via Amazon Transcribe (hi-IN, en-IN)
- Voice output via Amazon Polly (Kajal neural voice)
- Context-aware scheme recommendations based on user profile & documents

### 4. Scheme Discovery
- 8 real government schemes pre-loaded (PMAY, PM-KISAN, MUDRA, PM-JAY, PM-SYM, e-Shram, Ujjwala, PMSBY)
- Multi-factor eligibility scoring (income, occupation, documents, age, location)
- Direct links to official application portals

### 5. Tamper-Proof Income Reports
- Income verification reports with blockchain-style hash chain
- QR codes for instant verification by third parties
- Public verification portal (no login required)
- Trust score: document quality (30%) + verification rate (30%) + recency (20%) + diversity (20%)

## Team

**0NLY FL4G$** — AI for Bharat Hackathon (Amazon)

## License

Built for the AI for Bharat Hackathon. All rights reserved.
