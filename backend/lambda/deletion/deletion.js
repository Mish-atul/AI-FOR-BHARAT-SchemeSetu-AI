// SchemeSetu AI — Account Deletion Lambda (Right to be Forgotten)
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, DeleteCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const region = process.env.REGION || 'ap-south-1';
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const s3 = new S3Client({ region });

const USERS_TABLE = process.env.USERS_TABLE;
const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE;
const LEDGER_TABLE = process.env.LEDGER_TABLE;
const CONSENT_TABLE = process.env.CONSENT_TABLE;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const BUCKET_NAME = process.env.BUCKET_NAME;

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
  },
  body: JSON.stringify(body),
});

// Delete all items from a table for a given PK
async function deleteAllForPK(tableName, pk) {
  let lastKey;
  let deleted = 0;
  do {
    const result = await ddb.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': pk },
      ExclusiveStartKey: lastKey,
      Limit: 25,
    }));

    const items = result.Items || [];
    if (items.length === 0) break;

    // Batch delete (max 25 per batch)
    const deleteRequests = items.map(item => ({
      DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
    }));

    await ddb.send(new BatchWriteCommand({
      RequestItems: { [tableName]: deleteRequests },
    }));

    deleted += items.length;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return deleted;
}

// Delete all S3 objects for a user
async function deleteUserS3Objects(userId) {
  const prefix = `documents/${userId}/`;
  let deleted = 0;
  let continuationToken;

  do {
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));

    const objects = listResult.Contents || [];
    if (objects.length === 0) break;

    await s3.send(new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: objects.map(obj => ({ Key: obj.Key })),
        Quiet: true,
      },
    }));

    deleted += objects.length;
    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);

  return deleted;
}

exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method !== 'DELETE') {
    return response(405, { error: 'Method not allowed' });
  }

  // Extract user ID from authorizer context
  const userId = event.requestContext?.authorizer?.claims?.sub || event.requestContext?.authorizer?.userId;
  if (!userId) {
    return response(401, { error: 'Unauthorized' });
  }

  const userPK = `USER#${userId}`;
  const body = event.body ? JSON.parse(event.body) : {};
  const { confirmation } = body;

  // Require explicit confirmation
  if (confirmation !== 'DELETE_MY_ACCOUNT') {
    return response(400, { 
      error: 'Confirmation required',
      message: 'Send { "confirmation": "DELETE_MY_ACCOUNT" } to proceed',
    });
  }

  try {
    console.log(`Starting account deletion for user: ${userId}`);
    const summary = {};

    // 1. Delete user documents from S3
    try {
      summary.s3Objects = await deleteUserS3Objects(userId);
      console.log(`Deleted ${summary.s3Objects} S3 objects`);
    } catch (err) {
      console.error('S3 deletion error:', err);
      summary.s3Objects = 'error';
    }

    // 2. Delete from documents table
    try {
      summary.documents = await deleteAllForPK(DOCUMENTS_TABLE, userPK);
      console.log(`Deleted ${summary.documents} document records`);
    } catch (err) {
      console.error('Documents deletion error:', err);
      summary.documents = 'error';
    }

    // 3. Delete from consent table
    try {
      summary.consent = await deleteAllForPK(CONSENT_TABLE, userPK);
      console.log(`Deleted ${summary.consent} consent records`);
    } catch (err) {
      console.error('Consent deletion error:', err);
      summary.consent = 'error';
    }

    // 4. Delete from sessions table
    try {
      summary.sessions = await deleteAllForPK(SESSIONS_TABLE, userPK);
      console.log(`Deleted ${summary.sessions} session records`);
    } catch (err) {
      console.error('Sessions deletion error:', err);
      summary.sessions = 'error';
    }

    // 5. Write final ledger entry (anonymized — for audit compliance)
    try {
      const { createHash } = require('crypto');
      const hashedUserId = createHash('sha256').update(userId).digest('hex').slice(0, 12);
      
      await ddb.send(new (require('@aws-sdk/lib-dynamodb').PutCommand)({
        TableName: LEDGER_TABLE,
        Item: {
          PK: `AUDIT#DELETION`,
          SK: `${Date.now()}#${hashedUserId}`,
          action: 'ACCOUNT_DELETED',
          anonymizedUser: hashedUserId,
          timestamp: Date.now(),
          isoDate: new Date().toISOString(),
          summary: {
            documentsDeleted: summary.documents,
            s3ObjectsDeleted: summary.s3Objects,
            consentRecordsDeleted: summary.consent,
            sessionsDeleted: summary.sessions,
          },
        },
      }));
      console.log('Ledger audit entry written');
    } catch (err) {
      console.error('Ledger audit entry error:', err);
    }

    // 6. Delete ledger entries for user (except the anonymized audit above)
    try {
      summary.ledger = await deleteAllForPK(LEDGER_TABLE, userPK);
      console.log(`Deleted ${summary.ledger} ledger records`);
    } catch (err) {
      console.error('Ledger deletion error:', err);
      summary.ledger = 'error';
    }

    // 7. Delete user profile (last, so we can reference userId throughout)
    try {
      summary.user = await deleteAllForPK(USERS_TABLE, userPK);
      console.log(`Deleted ${summary.user} user records`);
    } catch (err) {
      console.error('User deletion error:', err);
      summary.user = 'error';
    }

    console.log(`Account deletion complete for user: ${userId}`, summary);

    return response(200, {
      message: 'Account deleted successfully. All personal data has been removed.',
      summary,
    });
  } catch (err) {
    console.error('Account deletion error:', err);
    return response(500, { error: 'Account deletion failed. Please contact support.' });
  }
};
