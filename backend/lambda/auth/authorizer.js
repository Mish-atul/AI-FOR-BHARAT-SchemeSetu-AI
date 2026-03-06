// SchemeSetu AI — API Gateway Token Authorizer
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.REGION || 'ap-south-1' });
const ddb = DynamoDBDocumentClient.from(client);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE;

exports.handler = async (event) => {
  const token = event.authorizationToken?.replace('Bearer ', '') || '';
  
  if (!token) {
    throw new Error('Unauthorized');
  }

  try {
    const result = await ddb.send(new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { PK: `TOKEN#${token}` },
    }));

    if (!result.Item) {
      throw new Error('Unauthorized');
    }

    // Check TTL
    if (result.Item.ttl && result.Item.ttl < Math.floor(Date.now() / 1000)) {
      throw new Error('Unauthorized');
    }

    // Return policy
    return {
      principalId: result.Item.userId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn.split('/').slice(0, 2).join('/') + '/*',
        }],
      },
      context: {
        userId: result.Item.userId,
        phoneNumber: result.Item.phoneNumber,
      },
    };
  } catch (err) {
    console.error('Authorizer error:', err);
    throw new Error('Unauthorized');
  }
};
