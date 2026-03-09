// SchemeSetu AI — Documents Lambda
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { ddb, GetCommand, PutCommand, QueryCommand, UpdateCommand, response, getUserId, parseBody, writeLedgerEntry } = require('../shared/utils');

const s3 = new S3Client({ region: process.env.REGION });
const sqs = new SQSClient({ region: process.env.REGION });

const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE;
const LEDGER_TABLE = process.env.LEDGER_TABLE;
const DOCUMENT_BUCKET = process.env.DOCUMENT_BUCKET;
const OCR_QUEUE_URL = process.env.OCR_QUEUE_URL;

exports.handler = async (event) => {
  const method = event.httpMethod;
  const userId = getUserId(event);

  try {
    // GET /documents — List user documents
    if (method === 'GET' && !event.pathParameters?.docId) {
      const result = await ddb.send(new QueryCommand({
        TableName: DOCUMENTS_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': 'DOC#',
        },
      }));
      return response(200, result.Items || []);
    }

    // GET /documents/{docId} — Get single document
    if (method === 'GET' && event.pathParameters?.docId) {
      const docId = event.pathParameters.docId;
      const result = await ddb.send(new GetCommand({
        TableName: DOCUMENTS_TABLE,
        Key: { PK: `USER#${userId}`, SK: `DOC#${docId}` },
      }));
      if (!result.Item) return response(404, { error: 'Document not found' });

      // Generate presigned URL for download
      const url = await getSignedUrl(s3, new GetObjectCommand({
        Bucket: DOCUMENT_BUCKET,
        Key: `${userId}/${docId}`,
      }), { expiresIn: 3600 });

      return response(200, { ...result.Item, downloadUrl: url });
    }

    // POST /documents — Upload document (get presigned URL + create record)
    if (method === 'POST' && !event.pathParameters?.docId) {
      const body = parseBody(event);
      const { fileName, fileType, docType, declaredPeriodStart, declaredPeriodEnd } = body;
      
      if (!fileName || !docType) {
        return response(400, { error: 'fileName and docType are required' });
      }

      const docId = `doc_${crypto.randomUUID().substring(0, 12)}`;
      const s3Key = `${userId}/${docId}/${fileName}`;

      // Create presigned upload URL
      const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
        Bucket: DOCUMENT_BUCKET,
        Key: s3Key,
        ContentType: fileType || 'application/octet-stream',
      }), { expiresIn: 3600 });

      // Create document record
      const docRecord = {
        PK: `USER#${userId}`,
        SK: `DOC#${docId}`,
        GSI1PK: `STATUS#unverified`,
        GSI1SK: `${Date.now()}`,
        documentId: docId,
        userId,
        fileName,
        fileType: fileType || 'application/octet-stream',
        docType,
        s3Key,
        uploadTimestamp: Date.now(),
        verificationStatus: 'unverified',
        ocrConfidence: 0,
        extractedData: {},
        declaredPeriodStart,
        declaredPeriodEnd,
        blockchainHash: '',
      };

      await ddb.send(new PutCommand({
        TableName: DOCUMENTS_TABLE,
        Item: docRecord,
      }));

      // Write to ledger (blockchain hash chain)
      const ledgerResult = await writeLedgerEntry(LEDGER_TABLE, {
        pk: `USER#${userId}`,
        action: 'DOCUMENT_UPLOAD',
        data: { documentId: docId, fileName, docType },
        userId,
      });

      // Update document record with blockchain hash
      await ddb.send(new UpdateCommand({
        TableName: DOCUMENTS_TABLE,
        Key: { PK: `USER#${userId}`, SK: `DOC#${docId}` },
        UpdateExpression: 'SET blockchainHash = :hash, blockchainTimestamp = :ts',
        ExpressionAttributeValues: {
          ':hash': ledgerResult.hash,
          ':ts': ledgerResult.timestamp,
        },
      }));

      return response(201, {
        documentId: docId,
        uploadUrl,
        blockchainHash: ledgerResult.hash,
        s3Key,
        message: 'Document created. Upload file to the presigned URL, then call /documents/{docId}/process.',
      });
    }

    // POST /documents/{docId}/process — Trigger OCR after file is uploaded to S3
    if (method === 'POST' && event.pathParameters?.docId && (event.resource || '').includes('process')) {
      const docId = event.pathParameters.docId;

      // Verify the document exists and belongs to this user
      const existing = await ddb.send(new GetCommand({
        TableName: DOCUMENTS_TABLE,
        Key: { PK: `USER#${userId}`, SK: `DOC#${docId}` },
      }));
      if (!existing.Item) return response(404, { error: 'Document not found' });

      // Send to OCR queue now that the file is in S3
      await sqs.send(new SendMessageCommand({
        QueueUrl: OCR_QUEUE_URL,
        MessageBody: JSON.stringify({
          documentId: docId,
          userId,
          s3Key: existing.Item.s3Key,
          docType: existing.Item.docType,
          fileType: existing.Item.fileType,
        }),
      }));

      return response(200, { message: 'OCR processing triggered', documentId: docId });
    }

    // DELETE /documents/{docId} — Delete a document
    if (method === 'DELETE' && event.pathParameters?.docId) {
      const docId = event.pathParameters.docId;
      const { DeleteCommand } = require('../shared/utils');

      // Get document first to verify ownership
      const existing = await ddb.send(new GetCommand({
        TableName: DOCUMENTS_TABLE,
        Key: { PK: `USER#${userId}`, SK: `DOC#${docId}` },
      }));
      if (!existing.Item) return response(404, { error: 'Document not found' });

      // Delete from DynamoDB
      await ddb.send(new DeleteCommand({
        TableName: DOCUMENTS_TABLE,
        Key: { PK: `USER#${userId}`, SK: `DOC#${docId}` },
      }));

      // Delete from S3
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      await s3.send(new DeleteObjectCommand({
        Bucket: DOCUMENT_BUCKET,
        Key: existing.Item.s3Key,
      })).catch(() => {}); // Non-critical if S3 delete fails

      // Write to ledger
      await writeLedgerEntry(LEDGER_TABLE, {
        pk: `USER#${userId}`,
        action: 'DOCUMENT_DELETED',
        data: { documentId: docId, fileName: existing.Item.fileName },
        userId,
      });

      return response(200, { message: 'Document deleted' });
    }

    return response(404, { error: 'Route not found' });
  } catch (err) {
    console.error('Documents error:', err);
    return response(500, { error: 'Internal server error' });
  }
};
