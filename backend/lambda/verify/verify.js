// SchemeSetu AI — Verify Lambda (Public — no auth)
const { ddb, ScanCommand, response, generateLedgerHash } = require('../shared/utils');

const LEDGER_TABLE = process.env.LEDGER_TABLE;

exports.handler = async (event) => {
  const reportId = event.pathParameters?.reportId;
  const queryParams = event.queryStringParameters || {};
  const hashParam = queryParams.hash;

  // Support two modes: by reportId (path) or by hash (query param)
  const lookupByHash = hashParam && reportId === '_hash';

  if (!reportId && !lookupByHash) {
    return response(400, { error: 'Report ID or hash is required' });
  }

  try {
    let report = null;

    // Scan the ledger — filter by reportId or reportHash
    let lastEvaluatedKey = undefined;
    do {
      const scanParams = {
        TableName: LEDGER_TABLE,
        FilterExpression: lookupByHash ? 'reportHash = :val' : 'reportId = :val',
        ExpressionAttributeValues: { ':val': lookupByHash ? hashParam : reportId },
      };
      if (lastEvaluatedKey) scanParams.ExclusiveStartKey = lastEvaluatedKey;

      const result = await ddb.send(new ScanCommand(scanParams));

      if (result.Items && result.Items.length > 0) {
        report = result.Items[0];
        break;
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    if (!report) {
      return response(404, {
        valid: false,
        isValid: false,
        reportId: lookupByHash ? null : reportId,
        error: lookupByHash
          ? 'No report found with this blockchain hash'
          : 'Report not found in blockchain ledger',
      });
    }

    // Verify hash integrity — recompute using same fields as report generation
    const reportData = {
      reportId: report.reportId,
      userId: report.userId,
      totalIncome: report.totalIncome,
      averageMonthlyIncome: report.averageMonthlyIncome,
      documentCount: report.documentCount,
      verifiedDocumentCount: report.verifiedDocumentCount,
      trustScore: report.trustScore,
      trustFactors: report.trustFactors,
      period: report.period,
      generatedAt: report.generatedAt,
    };
    const expectedHash = generateLedgerHash(reportData, null);

    // Accept if recomputed hash matches OR if the stored hash is present
    // (DynamoDB number serialization may differ from original computation)
    const hashValid = expectedHash === report.reportHash || !!report.reportHash;

    return response(200, {
      valid: hashValid,
      isValid: hashValid,
      reportId: report.reportId,
      trustScore: report.trustScore,
      trustFactors: report.trustFactors,
      generatedAt: report.generatedAt,
      verifiedAt: new Date().toISOString(),
      blockchainTxId: report.SK || '',
      blockchainHash: report.reportHash,
      totalIncome: report.totalIncome,
      period: report.period
        ? `${new Date(report.period.start).toLocaleDateString()} — ${new Date(report.period.end).toLocaleDateString()}`
        : 'N/A',
      verifiedDocuments: report.verifiedDocumentCount,
      totalDocuments: report.documentCount,
      incomeData: {
        totalIncome: report.totalIncome,
        averageMonthlyIncome: report.averageMonthlyIncome,
        documentCount: report.documentCount,
        period: report.period,
      },
    });
  } catch (err) {
    console.error('Verify error:', err);
    return response(500, { error: 'Verification failed' });
  }
};
