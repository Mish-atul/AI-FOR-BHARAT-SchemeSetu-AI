// SchemeSetu AI — Verify Lambda (Public — no auth)
const { ddb, QueryCommand, GetCommand, response, generateLedgerHash } = require('../shared/utils');

const LEDGER_TABLE = process.env.LEDGER_TABLE;

exports.handler = async (event) => {
  const reportId = event.pathParameters?.reportId;
  
  if (!reportId) {
    return response(400, { error: 'Report ID is required' });
  }

  try {
    // Search ledger for the report
    // We need to scan since we don't know the userId from the QR code
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
    const client = new DynamoDBClient({ region: process.env.REGION });
    const scanDdb = DynamoDBDocumentClient.from(client);

    const result = await scanDdb.send(new ScanCommand({
      TableName: LEDGER_TABLE,
      FilterExpression: 'reportId = :rid',
      ExpressionAttributeValues: { ':rid': reportId },
      Limit: 1,
    }));

    if (!result.Items || result.Items.length === 0) {
      return response(404, {
        valid: false,
        isValid: false,
        reportId,
        error: 'Report not found in blockchain ledger',
      });
    }

    const report = result.Items[0];

    // Verify hash integrity — recompute using same fields as report generation
    const expectedHash = generateLedgerHash({
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
    }, null);

    const hashValid = expectedHash === report.reportHash;

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
      period: `${new Date(report.period?.start).toLocaleDateString()} — ${new Date(report.period?.end).toLocaleDateString()}`,
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
