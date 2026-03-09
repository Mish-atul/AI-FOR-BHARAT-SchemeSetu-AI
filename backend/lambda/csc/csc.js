// SchemeSetu AI — CSC Portal Lambda (Verification Queue)
const { ddb, GetCommand, PutCommand, QueryCommand, UpdateCommand, response, getUserId, parseBody, writeLedgerEntry } = require('../shared/utils');

const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE;
const LEDGER_TABLE = process.env.LEDGER_TABLE;

exports.handler = async (event) => {
  const method = event.httpMethod;
  const verifierId = getUserId(event);

  try {
    // GET /csc/queue — Get verification queue
    if (method === 'GET') {
      // Query documents with pending_review OR unverified status using GSI
      const [pendingResult, unverifiedResult] = await Promise.all([
        ddb.send(new QueryCommand({
          TableName: DOCUMENTS_TABLE,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :status',
          ExpressionAttributeValues: { ':status': 'STATUS#pending_review' },
          ScanIndexForward: false,
          Limit: 50,
        })),
        ddb.send(new QueryCommand({
          TableName: DOCUMENTS_TABLE,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :status',
          ExpressionAttributeValues: { ':status': 'STATUS#unverified' },
          ScanIndexForward: false,
          Limit: 50,
        })),
      ]);

      const allItems = [...(pendingResult.Items || []), ...(unverifiedResult.Items || [])];
      // Sort by most recent first
      allItems.sort((a, b) => (b.uploadTimestamp || 0) - (a.uploadTimestamp || 0));

      const queue = allItems.map(item => ({
        documentId: item.documentId,
        userId: item.userId,
        addedAt: item.uploadTimestamp,
        status: 'pending',
        ocrConfidence: item.ocrConfidence || 0,
        extractedData: item.extractedData || {},
        fileName: item.fileName,
        fileType: item.fileType,
        documentType: item.docType,
        userName: 'User', // Privacy: don't expose full name to CSC
        submittedAt: new Date(item.uploadTimestamp).toISOString(),
      }));

      return response(200, queue);
    }

    // PUT /csc/queue/{docId} — Submit verification decision
    if (method === 'PUT') {
      const docId = event.pathParameters?.docId;
      if (!docId) return response(400, { error: 'Document ID is required' });

      const body = parseBody(event);
      const { corrections, approved } = body;

      // Find the document (we need the PK which is USER#userId)
      // For hackathon demo, scan for the document
      const { ScanCommand } = require('../shared/utils');

      // Paginated scan to find the document by documentId
      let scanResult = { Items: [] };
      let lastKey = undefined;
      do {
        const params = {
          TableName: DOCUMENTS_TABLE,
          FilterExpression: 'documentId = :did',
          ExpressionAttributeValues: { ':did': docId },
        };
        if (lastKey) params.ExclusiveStartKey = lastKey;
        const res = await ddb.send(new ScanCommand(params));
        if (res.Items && res.Items.length > 0) {
          scanResult = res;
          break;
        }
        lastKey = res.LastEvaluatedKey;
      } while (lastKey);

      if (!scanResult.Items || scanResult.Items.length === 0) {
        return response(404, { error: 'Document not found' });
      }

      const doc = scanResult.Items[0];
      const newStatus = approved ? 'verified' : 'unverified';

      // Merge corrections into extractedData if provided
      const updatedExtractedData = corrections && Object.keys(corrections).length > 0
        ? { ...(doc.extractedData || {}), ...corrections }
        : doc.extractedData || {};

      // Update document status, extractedData, and verification metadata
      await ddb.send(new UpdateCommand({
        TableName: DOCUMENTS_TABLE,
        Key: { PK: doc.PK, SK: doc.SK },
        UpdateExpression: 'SET verificationStatus = :status, GSI1PK = :gsi1pk, verifiedBy = :verifier, verifiedAt = :at, corrections = :corrections, extractedData = :extractedData',
        ExpressionAttributeValues: {
          ':status': newStatus,
          ':gsi1pk': `STATUS#${newStatus}`,
          ':verifier': verifierId,
          ':at': Date.now(),
          ':corrections': corrections || {},
          ':extractedData': updatedExtractedData,
        },
      }));

      // Write to ledger
      await writeLedgerEntry(LEDGER_TABLE, {
        pk: doc.PK,
        action: approved ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED',
        data: { documentId: docId, verifiedBy: verifierId, approved, corrections },
        userId: doc.userId,
      });

      return response(200, { 
        documentId: docId, 
        status: newStatus,
        message: approved ? 'Document verified successfully' : 'Document rejected',
      });
    }

    return response(404, { error: 'Route not found' });
  } catch (err) {
    console.error('CSC error:', err);
    return response(500, { error: 'Internal server error' });
  }
};
