// SchemeSetu AI — Shared utilities for Lambda functions
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const client = new DynamoDBClient({ region: process.env.REGION || 'ap-south-1' });
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// Standard API response
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Request-Language',
    },
    body: JSON.stringify(body),
  };
}

// Generate hash chain entry for immutable ledger
function generateLedgerHash(data, previousHash) {
  const payload = JSON.stringify(data) + (previousHash || 'GENESIS');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// Write to immutable ledger (DynamoDB with condition expression)
async function writeLedgerEntry(tableName, entry) {
  const hash = generateLedgerHash(entry.data, entry.previousHash);
  const item = {
    PK: entry.pk,
    SK: `LEDGER#${Date.now()}#${crypto.randomUUID()}`,
    hash,
    previousHash: entry.previousHash || 'GENESIS',
    data: entry.data,
    action: entry.action,
    timestamp: Date.now(),
    userId: entry.userId,
  };
  
  await ddb.send(new PutCommand({
    TableName: tableName,
    Item: item,
    ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
  }));
  
  return { hash, timestamp: item.timestamp };
}

// Get user ID from authorizer context (supports Cognito + legacy)
function getUserId(event) {
  // Cognito User Pools Authorizer
  if (event.requestContext?.authorizer?.claims) {
    return event.requestContext.authorizer.claims.sub || 'anonymous';
  }
  // Legacy custom token authorizer
  return event.requestContext?.authorizer?.userId || 'anonymous';
}

// Get phone number from authorizer context
function getPhoneNumber(event) {
  if (event.requestContext?.authorizer?.claims) {
    return event.requestContext.authorizer.claims.phone_number;
  }
  return event.requestContext?.authorizer?.phoneNumber;
}

// Parse JSON body safely
function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

module.exports = { ddb, GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand, response, generateLedgerHash, writeLedgerEntry, getUserId, getPhoneNumber, parseBody };
