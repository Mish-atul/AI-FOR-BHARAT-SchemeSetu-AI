// SchemeSetu AI — Reports Lambda (Income Report Generation)
const crypto = require('crypto');
const { ddb, GetCommand, PutCommand, QueryCommand, UpdateCommand, response, getUserId, getPhoneNumber, parseBody, writeLedgerEntry, generateLedgerHash } = require('../shared/utils');

const USERS_TABLE = process.env.USERS_TABLE;
const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE;
const LEDGER_TABLE = process.env.LEDGER_TABLE;

exports.handler = async (event) => {
  const method = event.httpMethod;
  const userId = getUserId(event);
  const phone = getPhoneNumber(event);

  try {
    // GET /reports — List user reports
    if (method === 'GET') {
      const result = await ddb.send(new QueryCommand({
        TableName: LEDGER_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': 'REPORT#',
        },
        ScanIndexForward: false,
      }));
      return response(200, (result.Items || []).map(formatReport));
    }

    // POST /reports — Generate new report
    if (method === 'POST') {
      const body = parseBody(event);
      const { startDate, endDate } = body;
      
      if (!startDate || !endDate) {
        return response(400, { error: 'startDate and endDate are required' });
      }

      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();

      // Get user documents in period
      const docsResult = await ddb.send(new QueryCommand({
        TableName: DOCUMENTS_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': 'DOC#',
        },
      }));

      const docs = (docsResult.Items || []).filter(d => {
        const ts = d.uploadTimestamp;
        return ts >= start && ts <= end;
      });

      // Calculate income from documents
      let totalIncome = 0;
      const verifiedDocs = docs.filter(d => d.verificationStatus === 'verified');
      
      docs.forEach(doc => {
        const amount = doc.extractedData?.amount || doc.extractedData?.total || 0;
        if (typeof amount === 'number') totalIncome += amount;
      });

      // Get trust score
      const userResult = await ddb.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { PK: `USER#${phone}`, SK: 'PROFILE' },
      }));
      
      const trustResult = calculateTrustScore(docs, verifiedDocs);
      const trustScore = trustResult.score;
      const trustFactors = trustResult.factors;
      const months = Math.max(1, Math.ceil((end - start) / (30 * 86400000)));
      const avgMonthlyIncome = Math.round(totalIncome / months);

      // Create report
      const reportId = `rep_${crypto.randomUUID().substring(0, 12)}`;
      const reportData = {
        reportId,
        userId,
        totalIncome,
        averageMonthlyIncome: avgMonthlyIncome,
        documentCount: docs.length,
        verifiedDocumentCount: verifiedDocs.length,
        trustScore,
        trustFactors,
        period: { start, end },
        generatedAt: new Date().toISOString(),
      };

      // Write report to ledger (immutable)
      const reportHash = generateLedgerHash(reportData, null);
      const qrCodeData = JSON.stringify({
        reportId,
        hash: reportHash,
        verifyUrl: `https://schemesetu.ai/verify?id=${reportId}`,
      });

      const item = {
        PK: `USER#${userId}`,
        SK: `REPORT#${reportId}`,
        ...reportData,
        reportHash,
        qrCodeData,
      };

      await ddb.send(new PutCommand({
        TableName: LEDGER_TABLE,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }));

      // Also write to ledger chain
      await writeLedgerEntry(LEDGER_TABLE, {
        pk: `USER#${userId}`,
        action: 'REPORT_GENERATED',
        data: { reportId, totalIncome, trustScore },
        userId,
      });

      // Update user trust score
      await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { PK: `USER#${phone}`, SK: 'PROFILE' },
        UpdateExpression: 'SET trustScore = :ts, trustFactors = :tf',
        ExpressionAttributeValues: { ':ts': trustScore, ':tf': trustFactors },
      })).catch(() => {}); // Non-critical

      return response(201, formatReport(item));
    }

    return response(404, { error: 'Route not found' });
  } catch (err) {
    console.error('Reports error:', err);
    return response(500, { error: 'Internal server error' });
  }
};

// Trust Score per design.md:
// TrustScore = round(40*DocQualityScore + 30*IncomeStabilityScore + 15*RecencyScore + 15*SourceReliabilityScore)
function calculateTrustScore(allDocs, verifiedDocs) {
  if (allDocs.length === 0) return { score: 0, factors: {} };

  // 1. DocQualityScore (weight: 40) = average(confidence * verification_flag)
  const docQualityScore = allDocs.reduce((sum, d) => {
    const confidence = d.ocrConfidence || 0.5;
    const verified = d.verificationStatus === 'verified' ? 1 : 0.5;
    return sum + (confidence * verified);
  }, 0) / allDocs.length;

  // 2. IncomeStabilityScore (weight: 30) = clamp(1 - stddev/mean, 0, 1)
  const monthlyAmounts = {};
  allDocs.forEach(d => {
    const amount = d.extractedData?.amount || d.extractedData?.total || 0;
    if (typeof amount === 'number' && amount > 0) {
      const month = new Date(d.uploadTimestamp).toISOString().slice(0, 7); // YYYY-MM
      monthlyAmounts[month] = (monthlyAmounts[month] || 0) + amount;
    }
  });
  const monthlyValues = Object.values(monthlyAmounts);
  let incomeStabilityScore = 0.5; // default if not enough data
  if (monthlyValues.length >= 2) {
    const mean = monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length;
    const variance = monthlyValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / monthlyValues.length;
    const stddev = Math.sqrt(variance);
    incomeStabilityScore = mean > 0 ? Math.max(0, Math.min(1, 1 - (stddev / mean))) : 0;
  } else if (monthlyValues.length === 1) {
    incomeStabilityScore = 0.7; // single month — moderate stability
  }

  // 3. RecencyScore (weight: 15) = min(1, months_with_verified_docs / 12)
  const verifiedMonths = new Set();
  verifiedDocs.forEach(d => {
    const month = new Date(d.uploadTimestamp).toISOString().slice(0, 7);
    verifiedMonths.add(month);
  });
  const recencyScore = Math.min(1, verifiedMonths.size / 12);

  // 4. SourceReliabilityScore (weight: 15) = weighted avg of source types
  const SOURCE_WEIGHTS = {
    bank_statement: 1.0, bank: 1.0,
    upi: 0.9, upi_statement: 0.9, payment_receipt: 0.9,
    employer_letter: 0.8, salary_slip: 0.8, payslip: 0.8,
    invoice: 0.7, receipt: 0.7, gst_return: 0.7,
    self_declaration: 0.4, other: 0.5,
  };
  const sourceWeightsSum = allDocs.reduce((sum, d) => {
    const type = (d.docType || 'other').toLowerCase().replace(/\s+/g, '_');
    return sum + (SOURCE_WEIGHTS[type] || 0.5);
  }, 0);
  const sourceReliabilityScore = sourceWeightsSum / allDocs.length;

  const score = Math.round(
    40 * docQualityScore +
    30 * incomeStabilityScore +
    15 * recencyScore +
    15 * sourceReliabilityScore
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    factors: {
      docQualityScore: Math.round(docQualityScore * 100) / 100,
      incomeStabilityScore: Math.round(incomeStabilityScore * 100) / 100,
      recencyScore: Math.round(recencyScore * 100) / 100,
      sourceReliabilityScore: Math.round(sourceReliabilityScore * 100) / 100,
    },
  };
}

function formatReport(item) {
  return {
    reportId: item.reportId,
    totalIncome: item.totalIncome,
    averageMonthlyIncome: item.averageMonthlyIncome,
    documentCount: item.documentCount,
    verifiedDocumentCount: item.verifiedDocumentCount,
    trustScore: item.trustScore,
    trustFactors: item.trustFactors,
    period: item.period,
    generatedAt: item.generatedAt,
    reportHash: item.reportHash,
    qrCodeData: item.qrCodeData,
  };
}
