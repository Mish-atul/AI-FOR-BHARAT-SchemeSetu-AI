// SchemeSetu AI — Consent Lambda
const { ddb, GetCommand, PutCommand, QueryCommand, response, getUserId, getPhoneNumber, parseBody, writeLedgerEntry } = require('../shared/utils');

const CONSENT_TABLE = process.env.CONSENT_TABLE;
const LEDGER_TABLE = process.env.LEDGER_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;

exports.handler = async (event) => {
  const method = event.httpMethod;
  const userId = getUserId(event);
  const phone = getPhoneNumber(event);

  try {
    // GET /consent — Get consent status
    if (method === 'GET') {
      const result = await ddb.send(new QueryCommand({
        TableName: CONSENT_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `USER#${userId}` },
      }));

      return response(200, (result.Items || []).map(item => ({
        userId: item.userId || userId,
        consentType: item.consentType,
        version: item.version,
        granted: item.granted,
        timestamp: item.timestamp,
      })));
    }

    // POST /consent — Grant/revoke consent
    if (method === 'POST') {
      const body = parseBody(event);
      const { consentType, version, granted } = body;

      if (!consentType || !version) {
        return response(400, { error: 'consentType and version are required' });
      }

      const timestamp = Date.now();
      
      // Store consent
      await ddb.send(new PutCommand({
        TableName: CONSENT_TABLE,
        Item: {
          PK: `USER#${userId}`,
          SK: `CONSENT#${consentType}#${timestamp}`,
          userId,
          consentType,
          version,
          granted: granted !== false,
          timestamp,
        },
      }));

      // Write to ledger (immutable audit trail)
      await writeLedgerEntry(LEDGER_TABLE, {
        pk: `USER#${userId}`,
        action: granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
        data: { consentType, version },
        userId,
      });

      // Update user consent version  
      if (phone) {
        const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
        await ddb.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { PK: `USER#${phone}`, SK: 'PROFILE' },
          UpdateExpression: 'SET consentVersion = :v',
          ExpressionAttributeValues: { ':v': version },
        })).catch(() => {});
      }

      return response(200, {
        userId,
        consentType,
        version,
        granted: granted !== false,
        timestamp,
      });
    }

    return response(404, { error: 'Route not found' });
  } catch (err) {
    console.error('Consent error:', err);
    return response(500, { error: 'Internal server error' });
  }
};
