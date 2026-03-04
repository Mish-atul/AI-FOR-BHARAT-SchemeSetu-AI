"use strict";

/**
 * SchemeSetu AI — Reports Lambda
 *
 * GET  /reports      → list all reports for user
 * POST /reports      → generate new income verification report
 *
 * AWS Services: DynamoDB only
 * Node.js built-in: crypto (SHA-256 hash chain)
 */

const {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  PutItemCommand,
  ScanCommand,
} = require("@aws-sdk/client-dynamodb");

const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const dynamo = new DynamoDBClient({ region: process.env.REGION });

const USERS_TABLE   = process.env.USERS_TABLE;
const DOCS_TABLE    = process.env.DOCUMENTS_TABLE;
const LEDGER_TABLE  = process.env.LEDGER_TABLE;

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
  console.log("Reports:", JSON.stringify({ path: event.path, method: event.httpMethod }));

  try {
    const userId = event.requestContext?.authorizer?.userId;
    if (!userId) return respond(401, { error: "Unauthorized" });

    const method = event.httpMethod;

    if (method === "GET")  return await listReports(userId);
    if (method === "POST") return await generateReport(userId, event);

    return respond(405, { error: "Method not allowed" });

  } catch (err) {
    console.error("Reports error:", err);
    return respond(500, { error: "Unable to process report.", detail: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /reports — List all past reports for user
// ─────────────────────────────────────────────────────────────────────────────
async function listReports(userId) {
  const res = await dynamo.send(new QueryCommand({
    TableName                 : LEDGER_TABLE,
    KeyConditionExpression    : "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues : marshall({
      ":pk": `USER#${userId}`,
      ":sk": "REPORT#",
    }),
    ScanIndexForward: false,   // newest first
  }));

  const reports = (res.Items || []).map(i => unmarshall(i));
  return respond(200, { reports, total: reports.length });
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /reports — Generate new income verification report
// ─────────────────────────────────────────────────────────────────────────────
async function generateReport(userId, event) {
  const body      = JSON.parse(event.body || "{}");
  const startDate = body.startDate;
  const endDate   = body.endDate || new Date().toISOString().split("T")[0];

  if (!startDate) return respond(400, { error: "startDate is required" });

  // 1. Load user profile + documents in parallel
  const [userProfile, userDocs] = await Promise.all([
    fetchUserProfile(userId),
    fetchUserDocuments(userId),
  ]);

  if (!userProfile) return respond(404, { error: "User profile not found" });

  // 2. Filter documents within date range
  const docsInRange = filterDocsByDateRange(userDocs, startDate, endDate);
  const verifiedDocs = docsInRange.filter(d =>
    d.status === "verified" || d.status === "processed" || d.ocrConfidence >= 0.8
  );

  // 3. Calculate income metrics
  const incomeMetrics = calculateIncomeMetrics(verifiedDocs, userProfile, startDate, endDate);

  // 4. Calculate trust score
  const trustScore = calculateTrustScore(verifiedDocs, userDocs, incomeMetrics);

  // 5. Get previous report hash for chain
  const previousHash = await getLatestReportHash(userId);

  // 6. Build report object
  const reportId  = `RPT-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const timestamp = new Date().toISOString();

  const reportData = {
    reportId,
    userId,
    generatedAt    : timestamp,
    period         : { startDate, endDate },
    totalIncome    : incomeMetrics.totalIncome,
    avgMonthlyIncome: incomeMetrics.avgMonthlyIncome,
    verifiedDocuments: {
      count : verifiedDocs.length,
      total : userDocs.length,
      types : verifiedDocs.map(d => d.documentType || d.type || "Document"),
    },
    trustScore,
    trustBreakdown : incomeMetrics.trustBreakdown,
    userName       : userProfile.name || "User",
    userPhone      : userProfile.phone || "",
    status         : "verified",
  };

  // 7. Generate SHA-256 hash chain
  const hashInput  = JSON.stringify({
    reportId,
    userId,
    totalIncome    : reportData.totalIncome,
    avgMonthlyIncome: reportData.avgMonthlyIncome,
    trustScore,
    generatedAt    : timestamp,
    previousHash,
  });
  const currentHash = `sha256:${crypto.createHash("sha256").update(hashInput).digest("hex")}`;

  reportData.hash         = currentHash;
  reportData.previousHash = previousHash;

  // 8. Save to ledger table (immutable)
  await dynamo.send(new PutItemCommand({
    TableName           : LEDGER_TABLE,
    Item                : marshall({
      PK           : `USER#${userId}`,
      SK           : `REPORT#${timestamp}#${reportId}`,
      ...reportData,
      createdAt    : timestamp,
    }, { removeUndefinedValues: true }),
    // Prevent overwrite — reports are immutable
    ConditionExpression : "attribute_not_exists(PK)",
  }));

  console.log(`Report generated: ${reportId}, trust score: ${trustScore}`);

  return respond(201, {
    message: "Report generated successfully",
    report : reportData,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  INCOME METRICS CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────
function calculateIncomeMetrics(verifiedDocs, userProfile, startDate, endDate) {
  // Try to extract income from verified documents (set by teammate's OCR lambda)
  let totalIncome      = 0;
  let monthCount       = 0;
  const trustBreakdown = {};

  if (verifiedDocs.length > 0) {
    verifiedDocs.forEach(doc => {
      const monthly = doc.extractedData?.monthlyIncome ||
                      doc.extractedData?.income        || 0;
      const annual  = doc.extractedData?.annualIncome  || 0;

      if (monthly > 0) {
        totalIncome += monthly;
        monthCount  += 1;
      } else if (annual > 0) {
        totalIncome += annual / 12;
        monthCount  += 1;
      }
    });
  }

  // Fallback to profile income if no docs
  if (totalIncome === 0 && userProfile.monthlyIncome) {
    totalIncome = userProfile.monthlyIncome;
    monthCount  = 1;
  }

  // Calculate months in range for total
  const start    = new Date(startDate);
  const end      = new Date(endDate);
  const months   = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30)));
  const avgMonthly = monthCount > 0 ? Math.round(totalIncome / monthCount) : 0;
  const total      = avgMonthly * months;

  // Trust breakdown (matches frontend display)
  trustBreakdown.documentQuality  = verifiedDocs.length > 0
    ? Math.round(verifiedDocs.reduce((sum, d) => sum + (d.ocrConfidence || 0.8), 0) / verifiedDocs.length * 100)
    : 0;
  trustBreakdown.verificationRate  = userProfile.phone ? 100 : 0;
  trustBreakdown.recency           = verifiedDocs.length > 0 ? 100 : 0;
  trustBreakdown.diversity         = Math.min(verifiedDocs.length * 33, 100);

  return {
    totalIncome    : total,
    avgMonthlyIncome: avgMonthly,
    months,
    trustBreakdown,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRUST SCORE CALCULATOR
//  Formula from README:
//  Document quality (30%) + Verification rate (30%) + Recency (20%) + Diversity (20%)
// ─────────────────────────────────────────────────────────────────────────────
function calculateTrustScore(verifiedDocs, allDocs, metrics) {
  // Document quality (30%) — avg OCR confidence of verified docs
  const qualityScore = verifiedDocs.length > 0
    ? verifiedDocs.reduce((sum, d) => sum + (d.ocrConfidence || 0.8), 0) / verifiedDocs.length
    : 0;
  const quality = Math.round(qualityScore * 30);

  // Verification rate (30%) — % of docs that are verified
  const verificationRate = allDocs.length > 0
    ? verifiedDocs.length / allDocs.length
    : 0;
  const verification = Math.round(verificationRate * 30);

  // Recency (20%) — has any doc been updated in last 90 days?
  const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
  const hasRecentDoc  = verifiedDocs.some(d => {
    const updatedAt = d.updatedAt || d.createdAt;
    return updatedAt && new Date(updatedAt).getTime() > ninetyDaysAgo;
  });
  const recency = hasRecentDoc ? 20 : verifiedDocs.length > 0 ? 10 : 0;

  // Diversity (20%) — variety of document types
  const uniqueTypes = new Set(verifiedDocs.map(d => d.documentType || d.type)).size;
  const diversity   = Math.min(uniqueTypes * 7, 20);

  const total = quality + verification + recency + diversity;
  return Math.min(Math.max(total, 0), 100);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Get latest report hash for hash chain
// ─────────────────────────────────────────────────────────────────────────────
async function getLatestReportHash(userId) {
  try {
    const res = await dynamo.send(new QueryCommand({
      TableName                 : LEDGER_TABLE,
      KeyConditionExpression    : "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues : marshall({
        ":pk": `USER#${userId}`,
        ":sk": "REPORT#",
      }),
      ScanIndexForward : false,
      Limit            : 1,
    }));

    if (res.Items?.length > 0) {
      const latest = unmarshall(res.Items[0]);
      return latest.hash || "GENESIS";
    }
    return "GENESIS";   // first report in chain
  } catch (e) {
    return "GENESIS";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Filter docs by date range
// ─────────────────────────────────────────────────────────────────────────────
function filterDocsByDateRange(docs, startDate, endDate) {
  const start = new Date(startDate).getTime();
  const end   = new Date(endDate).getTime();

  return docs.filter(doc => {
    const docDate = doc.createdAt || doc.uploadedAt;
    if (!docDate) return true;   // include if no date
    const t = new Date(docDate).getTime();
    return t >= start && t <= end;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  DynamoDB helpers
// ─────────────────────────────────────────────────────────────────────────────
async function fetchUserProfile(userId) {
  try {
    const res = await dynamo.send(new GetItemCommand({
      TableName: USERS_TABLE,
      Key      : marshall({ PK: `USER#${userId}`, SK: "PROFILE" }),
    }));
    return res.Item ? unmarshall(res.Item) : null;
  } catch (e) { console.warn("fetchUserProfile:", e.message); return null; }
}

async function fetchUserDocuments(userId) {
  try {
    const res = await dynamo.send(new QueryCommand({
      TableName                 : DOCS_TABLE,
      KeyConditionExpression    : "PK = :pk",
      ExpressionAttributeValues : marshall({ ":pk": `USER#${userId}` }),
    }));
    return (res.Items || []).map(i => unmarshall(i));
  } catch (e) { console.warn("fetchUserDocs:", e.message); return []; }
}
