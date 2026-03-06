# SchemeSetu AI 🇮🇳

**Privacy-First Trust Wallet & Scheme Discovery for India's Informal Workers**

> AI for Bharat Hackathon (Amazon) — Team **0NLY FL4G$**

---

## What is SchemeSetu?

SchemeSetu AI is a privacy-first digital trust wallet that helps India's 450M+ informal workers:

- **Upload & verify** income documents (wage slips, Aadhaar, bank statements) with AI-powered OCR
- **Discover** eligible government schemes — **1,476 real schemes** from [myScheme.gov.in](https://www.myscheme.gov.in/) with personalized eligibility scoring & document match %
- **AI Chatbot** — multilingual (Hindi + English) AI assistant powered by Amazon Nova Micro with voice input (Sarvam AI) and voice output (Amazon Polly)
- **Generate tamper-proof** income verification reports with blockchain-style SHA-256 hash chains, PDF export & QR codes
- **Trust Score** — weighted formula: 40% Document Quality + 30% Income Stability + 15% Recency + 15% Source Reliability
- **Maintain full control** over data with transparent consent management & Right to be Forgotten (account deletion)

## Live Deployment

| | |
|---|---|
| **API Gateway** | `https://wlkixykhq3.execute-api.ap-south-1.amazonaws.com/prod/` |
| **Region** | ap-south-1 (Mumbai) |
| **Frontend** | Local dev at `http://localhost:3000` (mock mode works without AWS) |
| **Demo OTP** | `123456` |
| **Schemes Database** | 1,476 real government schemes from myScheme.gov.in |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────────┐
│  Next.js 16  │────▶│ API Gateway  │────▶│  Lambda Functions  │
│  Frontend    │     │ + Authorizer │     │  (11 handlers)     │
│  (16 routes) │     │  (100 rps)   │     │  Node.js 20.x      │
└─────────────┘     └──────────────┘     └────────┬───────────┘
                                                   │
          ┌────────────────────────────────────────┤
          ▼              ▼           ▼             ▼
   ┌──────────┐   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ DynamoDB  │   │   S3     │  │ Bedrock  │  │ Sarvam   │
   │ (6 tables)│   │ + KMS    │  │Nova Micro│  │ AI STT   │
   │ 1476      │   │ encrypted│  │ chatbot  │  │ saarika  │
   │ schemes   │   │ docs     │  │ Hindi/En │  │ v2.5     │
   └──────────┘   └──────────┘  └──────────┘  └──────────┘
          │              │           │
          ▼              ▼           ▼
   ┌──────────┐   ┌──────────┐  ┌──────────┐
   │ Textract  │   │ Polly    │  │   SQS    │
   │ OCR       │   │ Neural   │  │ OCR Queue│
   │ key-value │   │ Kajal    │  │ + DLQ    │
   └──────────┘   └──────────┘  └──────────┘
```

## AWS Services Used (14 services)

| Service | Purpose |
|---------|---------|
| **Lambda** | 11 serverless functions (auth, authorizer, documents, OCR, chatbot, schemes, reports, verify, consent, CSC, deletion) |
| **DynamoDB** | 6 tables — users, documents, ledger (immutable hash chain), consent, sessions, schemes (1,476 real government schemes) |
| **S3 + KMS** | Encrypted document storage with server-side encryption, versioning, lifecycle rules (IA after 90 days) |
| **API Gateway** | REST API with custom token authorizer, throttling (100 req/s), CORS, CloudWatch logging, X-Ray tracing |
| **SQS** | Async OCR processing queue with dead-letter queue (3 retries, 7-day retention) |
| **Textract** | AI document OCR with key-value pair extraction for income documents |
| **Bedrock (Amazon Nova Micro)** | Multilingual AI chatbot via `apac.amazon.nova-micro-v1:0` — scheme discovery, document guidance, trust score explanation |
| **Polly** | Neural voice (Kajal) for Hindi/English text-to-speech responses |
| **SNS** | OTP delivery via SMS for phone-based authentication |
| **CloudWatch** | Centralized logging with 1-week retention across all functions |
| **X-Ray** | Distributed tracing across all Lambda functions |
| **KMS** | Customer-managed encryption keys with automatic rotation |
| **IAM** | Fine-grained least-privilege access policies per Lambda |
| **CDK** | Infrastructure as Code — entire backend defined in a single TypeScript stack (438 lines, 166+ CloudFormation resources) |

**External Service:**
| **Sarvam AI** | Hindi/English speech-to-text transcription (`saarika:v2.5` model) — superior Indic language support |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 16.1.6 (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui (21 components), Zustand, jsPDF, QRCode |
| **Backend** | AWS CDK v2 (TypeScript), Lambda (Node.js 20.x), DynamoDB |
| **AI/ML** | Amazon Bedrock (Nova Micro), Amazon Textract, Sarvam AI STT, Amazon Polly TTS |
| **Security** | KMS encryption at rest, DynamoDB immutable ledger with SHA-256 hash chain, token-based auth, PITR on all tables |
| **Data Pipeline** | 1,476 schemes extracted from HuggingFace dataset `shrijayan/gov_myscheme` → PyPDF2 → DynamoDB |
| **i18n** | Hindi + English (150+ translation keys, auto-detection via Devanagari script) |

## Key Features

### 1. Real Government Scheme Discovery (1,476 Schemes)
- **1,476 real government schemes** scraped from [myScheme.gov.in](https://www.myscheme.gov.in/) via HuggingFace dataset
- Multi-factor eligibility scoring: income, occupation, age, state, **document match %**
- **Document Match Percentage** — compares user's uploaded documents against each scheme's required documents, showing exactly what's ready and what's missing
- Covers Central + State schemes across all 28 states and 8 UTs
- Filterable by state, occupation, and keyword search

### 2. AI-Powered Multilingual Chatbot
- Amazon Bedrock (Nova Micro) for intelligent conversational AI
- **Context-aware** — AI receives user's uploaded documents AND top 10 relevant schemes
- Voice input via **Sarvam AI** (`saarika:v2.5`) for superior Hindi transcription
- Voice output via Amazon Polly (Kajal neural voice)
- Auto-detects Hindi (Devanagari) vs English and responds in the same language

### 3. AI-Powered Document Processing
- Drag-and-drop document upload with real-time preview
- Amazon Textract OCR with key-value pair extraction
- Auto-verification for high-confidence extractions (>80%)
- CSC operator review queue for low-confidence documents
- Blockchain-style SHA-256 hash anchoring on upload

### 4. Tamper-Proof Income Reports
- Income verification reports with blockchain-style SHA-256 hash chain
- **PDF export** with branded header, income summary, trust score, and QR code
- QR codes link to public verification portal
- **Trust Score formula**: `round(40×DocQuality + 30×IncomeStability + 15×Recency + 15×SourceReliability)`
- Public verification portal at `/verify/{reportId}` (no login required)

### 5. Privacy-First Design
- All documents encrypted at rest (AWS KMS with automatic rotation)
- Immutable audit ledger with SHA-256 hash chain
- Transparent consent management with versioning & ledger audit trail
- **Right to be Forgotten** — complete account deletion across all 6 DynamoDB tables + S3
- No data shared without explicit, versioned consent

## Project Structure

```
schemesetu-ai/
├── .kiro/                       # Kiro AI spec files
│   └── specs/schemesetu-ai/
│       ├── design.md            # Architecture & component interfaces
│       └── requirements.md      # 16 formal requirements + acceptance criteria
├── frontend/                    # Next.js 16 web application
│   ├── src/
│   │   ├── app/                # App Router pages (16 routes)
│   │   │   ├── page.tsx        # Landing page (hero, features, team)
│   │   │   ├── login/          # Phone + OTP login
│   │   │   ├── consent/        # Data usage consent form
│   │   │   ├── verify/         # Public verification portal (no auth)
│   │   │   ├── api/transcribe/ # Sarvam AI voice proxy
│   │   │   └── (protected)/    # Auth-required routes
│   │   │       ├── dashboard/  # Overview + trust score + quick actions
│   │   │       ├── documents/  # Drag-drop upload + OCR results
│   │   │       ├── chatbot/    # AI chatbot + voice input/output
│   │   │       ├── schemes/    # 1476 schemes + eligibility + doc match %
│   │   │       ├── reports/    # Income reports + PDF + QR codes
│   │   │       ├── profile/    # User profile + danger zone
│   │   │       ├── settings/   # Language, accessibility, offline
│   │   │       └── csc/        # CSC operator verification queue
│   │   ├── components/         # Sidebar, AppLayout
│   │   └── lib/                # api.ts, store.ts, i18n.ts, types.ts
│   └── .env.local.example      # Template for env vars
├── backend/                     # AWS CDK infrastructure
│   ├── lib/backend-stack.ts    # CDK stack (438 lines, 166+ resources)
│   ├── lambda/                 # Lambda function handlers
│   │   ├── shared/utils.js     # DynamoDB helpers, ledger hash chain, auth utils
│   │   ├── auth/               # OTP (SNS), profile CRUD, token authorizer
│   │   ├── documents/          # Document CRUD, S3 presigned URLs, SQS enqueue
│   │   ├── ocr/                # SQS-triggered Textract OCR processing
│   │   ├── chatbot/            # Bedrock Nova Micro + Polly + scheme context
│   │   ├── schemes/            # 1476 schemes from DynamoDB, eligibility + doc matching
│   │   ├── reports/            # Income reports + trust score formula
│   │   ├── verify/             # Public report verification + hash recomputation
│   │   ├── consent/            # Consent CRUD + ledger audit trail
│   │   ├── csc/                # CSC verification queue + correction merging
│   │   └── deletion/           # Account deletion (Right to be Forgotten)
│   └── scripts/
│       ├── seed-data.js        # Seeds 1476 schemes from schemes_clean.json
│       ├── clean_schemes_v2.py # Parses myScheme PDFs into structured JSON
│       └── schemes_clean.json  # 1476 parsed government schemes (8.9 MB)
├── shared/types/index.ts       # Shared TypeScript interfaces
├── PROGRESS.md                  # Development progress tracker
└── README.md                   # This file
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
aws configure  # Region: ap-south-1

# Bootstrap CDK (one-time per account/region)
npx cdk bootstrap

# Deploy all infrastructure
npx cdk deploy --require-approval never

# Seed 1,476 government schemes into DynamoDB
node scripts/seed-data.js
```

### Verify Phone Number for SMS OTP (SNS Sandbox)

```bash
# Register your phone number
aws sns create-sms-sandbox-phone-number --phone-number "+91XXXXXXXXXX" --region ap-south-1

# Verify with the 6-digit code received via SMS
aws sns verify-sms-sandbox-phone-number --phone-number "+91XXXXXXXXXX" --one-time-password "XXXXXX" --region ap-south-1
```

### Connect Frontend to Live Backend

```bash
copy frontend\.env.local.example frontend\.env.local
# Set NEXT_PUBLIC_API_URL=https://wlkixykhq3.execute-api.ap-south-1.amazonaws.com/prod
cd frontend && npm run dev
```

## API Endpoints (18 routes)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/otp` | No | Request OTP for phone number |
| POST | `/auth/otp/verify` | No | Verify OTP and get session token |
| GET | `/profile` | Yes | Get user profile |
| PUT | `/profile` | Yes | Update user profile |
| GET | `/documents` | Yes | List all documents |
| POST | `/documents` | Yes | Upload document (presigned URL) |
| GET | `/documents/{docId}` | Yes | Get document details |
| POST | `/chat` | Yes | Send chat message (Bedrock AI) |
| POST | `/chat/voice` | Yes | Send voice message (STT + AI + TTS) |
| GET | `/schemes` | Yes | List all 1,476 schemes (filterable) |
| GET | `/schemes/eligible` | Yes | Get personalized eligible schemes with doc match % |
| GET | `/reports` | Yes | List income reports |
| POST | `/reports` | Yes | Generate income report with trust score |
| GET | `/verify/{reportId}` | No | Public report verification + hash check |
| GET | `/consent` | Yes | Get consent status |
| POST | `/consent` | Yes | Grant/update consent |
| GET | `/csc/queue` | Yes | Get CSC verification queue |
| PUT | `/csc/queue/{docId}` | Yes | Submit verification decision |
| DELETE | `/account` | Yes | Delete account (Right to be Forgotten) |

## Scheme Data Pipeline

```
HuggingFace (shrijayan/gov_myscheme)
    │  2,153 PDF files from myScheme.gov.in
    ▼
PyPDF2 Text Extraction
    │  1,547 PDFs successfully extracted
    ▼
clean_schemes_v2.py
    │  Section parsing: Details → Benefits → Eligibility → Docs Required
    │  Web artifact removal, income/age extraction, occupation tagging
    ▼
schemes_clean.json (8.9 MB)
    │  1,476 unique structured schemes
    ▼
seed-data.js → DynamoDB (BatchWrite, 25/batch)
    │  PK='SCHEME', SK=schemeId
    ▼
Schemes Lambda (GET /schemes/eligible)
    │  Multi-factor scoring + document match %
    ▼
Frontend (schemes page + chatbot context)
```

## Team

**0NLY FL4G$** — AI for Bharat Hackathon (Amazon)

## License

Built for the AI for Bharat Hackathon. All rights reserved.
