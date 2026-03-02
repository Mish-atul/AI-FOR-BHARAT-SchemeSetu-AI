# SchemeSetu AI — Project Progress & Status

> **Last Updated**: March 2, 2026, 7:30 PM IST
> **Deadline**: March 4, 2026, Midnight IST
> **Team**: 0NLY FL4G$

---

## What's Done (Completed)

### Frontend — 100% Scaffolded
All 13 pages are built and the frontend compiles successfully.

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| Landing | `/` | ✅ Done | Hero, features, how-it-works, team section |
| Login | `/login` | ✅ Done | Phone +91 input + OTP, demo OTP 123456 |
| Consent | `/consent` | ✅ Done | Data usage consent form with toggles |
| Dashboard | `/dashboard` | ✅ Done | Stats cards, trust score, quick actions |
| Documents | `/documents` | ✅ Done | Drag-drop upload, OCR results display, blockchain hash |
| Chatbot | `/chatbot` | ✅ Done | Chat UI, voice recording button, scheme cards |
| Schemes | `/schemes` | ✅ Done | Scheme discovery with eligibility % scoring |
| Reports | `/reports` | ✅ Done | Report generation, QR codes, date range picker |
| Profile | `/profile` | ✅ Done | Profile editing, consent display, account deletion |
| Settings | `/settings` | ✅ Done | Language, accessibility, notifications, offline |
| Verify | `/verify` | ✅ Done | Public verification portal with QR scanner |
| CSC Portal | `/csc` | ✅ Done | CSC operator queue, review dialog |

**Key libraries installed**: shadcn/ui (21 components), Zustand, lucide-react, react-dropzone, html5-qrcode, qrcode, axios

**Frontend features**:
- Hindi/English i18n (150+ keys)
- Mock API layer — works without backend
- Zustand state management
- Protected routes with auth check
- Responsive sidebar navigation with Indian tricolor branding

### Backend — Deployed to AWS ✅
All infrastructure is live in **ap-south-1 (Mumbai)**.

| Resource | Status | Details |
|----------|--------|---------|
| CDK Stack | ✅ Deployed | 166 CloudFormation resources |
| API Gateway | ✅ Live | `https://wlkixykhq3.execute-api.ap-south-1.amazonaws.com/prod/` |
| 11 Lambda Functions | ✅ Deployed | auth, authorizer, documents, ocr, chatbot, schemes, reports, verify, consent, csc, deletion |
| 6 DynamoDB Tables | ✅ Created | users, documents, ledger, consent, sessions, schemes |
| S3 Bucket | ✅ Created | KMS encrypted, versioned, lifecycle rules |
| SQS Queue | ✅ Created | OCR processing queue with DLQ |
| KMS Key | ✅ Created | For document encryption at rest |
| CloudWatch Logs | ✅ Active | 1-week retention per Lambda |
| X-Ray Tracing | ✅ Active | All Lambdas traced |
| CORS | ✅ Working | Tested from localhost:3000 |

**Seed data**: 8 government schemes seeded (PMAY, PM-KISAN, MUDRA, PM-JAY, PM-SYM, e-Shram, Ujjwala, PMSBY)

### API Endpoints — All Working
- ✅ `POST /auth/otp` — Tested, returns OTP
- ✅ `POST /auth/otp/verify` — Returns session token
- ✅ All other endpoints deployed (need end-to-end testing)

---

## What's Left (For Teammates)

### HIGH PRIORITY — Must Do Before Deadline

#### 1. End-to-End Testing with Real Backend
The frontend-to-backend integration is connected but needs real flow testing:
- [ ] Login flow (OTP request → verify → get token → redirect to dashboard)
- [ ] Document upload flow (upload → S3 presigned URL → OCR triggers via SQS → results appear)
- [ ] Chat with Bedrock (needs Bedrock model access enabled in AWS console)
- [ ] Scheme eligibility (after profile is set up)
- [ ] Report generation with real documents
- [ ] Verification portal with real QR code

#### 2. Enable Bedrock Model Access
**IMPORTANT**: The chatbot Lambda calls `bedrock:InvokeModel` for Claude 3 Haiku. You must:
1. Go to AWS Console → Amazon Bedrock → Model access
2. Request access to **Claude 3 Haiku** (anthropic.claude-3-haiku-20240307-v1:0)
3. Wait for approval (usually instant)

Without this, the chatbot will return 500 errors.

#### 3. Frontend Polish & Bug Fixes
- [ ] Fix any UI bugs found during testing
- [ ] Add loading skeletons on pages that fetch data
- [ ] Error handling — show toast messages on API failures
- [ ] Mobile responsiveness tweaks (sidebar collapse on mobile)

#### 4. Demo Video / Presentation
- [ ] Record demo walkthrough (2-3 minutes)
- [ ] Prepare slides explaining architecture & AWS services
- [ ] Highlight privacy-first design and India context

### MEDIUM PRIORITY — Nice to Have

#### 5. Service Worker / PWA Support
- [ ] Add `next-pwa` or manual service worker for offline caching
- [ ] Cache scheme data and translations offline
- [ ] Show offline indicator in UI

#### 6. Real SMS OTP (Optional)
Currently uses demo OTP `123456`. To add real SMS:
- [ ] Add Amazon SNS integration in auth Lambda
- [ ] Send OTP via SNS SMS to +91 numbers
- [ ] Costs: ~₹0.20 per SMS

#### 7. Document Type Detection
- [ ] Add smart document type auto-detection in OCR Lambda
- [ ] Classify documents as Aadhaar, PAN, wage slip, etc. using Textract output patterns

#### 8. Hosting Frontend on AWS
Currently runs locally. To host:
- [ ] Build with `npm run build` → export to S3 + CloudFront
- [ ] Or use AWS Amplify for quick deployment
- [ ] Add custom domain if available

### LOW PRIORITY — Stretch Goals

- [ ] Push notifications via SNS
- [ ] Data export (download all my data as ZIP)
- [ ] Admin analytics dashboard
- [ ] Rate limiting per user
- [ ] Automated integration tests

---

## How to Set Up Locally

### Prerequisites
- Node.js 20+ (we used 22.12.0)
- npm 10+
- AWS CLI v2 configured with access keys
- Git

### Steps

```bash
# Clone the repo
git clone https://github.com/Mish-atul/AI-FOR-BHARAT-SchemeSetu-AI.git
cd AI-FOR-BHARAT-SchemeSetu-AI/schemesetu-ai

# Frontend (works immediately with mock data)
cd frontend
npm install
npm run dev
# → http://localhost:3000, OTP: 123456

# Backend (only if you need to redeploy)
cd ../backend
npm install
npx cdk deploy --require-approval never

# To connect frontend to AWS backend:
copy frontend\.env.local.example frontend\.env.local
# Edit .env.local → set NEXT_PUBLIC_API_URL to the API Gateway URL
```

### AWS Account Info
- **Account ID**: 852981122117
- **Region**: ap-south-1 (Mumbai)
- **CDK Stack**: BackendStack
- **Budget**: $300 AWS credits

---

## File Map — Where to Find Things

| What | Where |
|------|-------|
| All TypeScript types | `shared/types/index.ts` |
| Frontend API layer (mock + real) | `frontend/src/lib/api.ts` |
| Zustand store (auth, language, chat) | `frontend/src/lib/store.ts` |
| Hindi/English translations | `frontend/src/lib/i18n.ts` |
| CDK infrastructure (all AWS resources) | `backend/lib/backend-stack.ts` |
| Shared Lambda utilities | `backend/lambda/shared/utils.js` |
| Auth Lambda (OTP + profile) | `backend/lambda/auth/auth.js` |
| Chatbot Lambda (Bedrock + voice) | `backend/lambda/chatbot/chatbot.js` |
| OCR Lambda (Textract) | `backend/lambda/ocr/ocr.js` |
| Seed data (government schemes) | `backend/scripts/seed-data.js` |

---

## Known Issues

1. **Bedrock access**: Must be manually enabled in AWS Console before chatbot works
2. **Mock vs Real mode**: Frontend defaults to mock when `NEXT_PUBLIC_API_URL` is empty — this is intentional for local dev
3. **Document upload**: The real upload uses S3 presigned URLs — the mock just simulates it
4. **Turbopack warning**: Next.js shows a workspace root warning due to multiple lockfiles — harmless

---

*Updated by: Atul — March 2, 2026*
