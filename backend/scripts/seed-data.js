// SchemeSetu AI — Seed Data Script
// Run: node scripts/seed-data.js
// Seeds the DynamoDB Schemes table with real government schemes from myScheme.gov.in

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');

const region = process.env.AWS_REGION || 'ap-south-1';
const SCHEMES_TABLE = process.env.SCHEMES_TABLE || 'schemesetu-schemes';

const client = new DynamoDBClient({ region });
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

async function seed() {
  // Load cleaned scheme data
  const dataPath = path.join(__dirname, 'schemes_clean.json');
  if (!fs.existsSync(dataPath)) {
    console.error('schemes_clean.json not found. Run clean_schemes_v2.py first.');
    process.exit(1);
  }

  const schemes = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Loaded ${schemes.length} schemes from schemes_clean.json`);

  // Convert to DynamoDB items — PK='SCHEME', SK=schemeId
  const items = schemes.map(s => ({
    PK: 'SCHEME',
    SK: s.schemeId,
    schemeId: s.schemeId,
    name: s.name,
    description: (s.description || '').substring(0, 1000),
    eligibility: (s.eligibility || '').substring(0, 1500),
    benefits: (s.benefits || '').substring(0, 1000),
    documentsRequired: (s.documentsRequired || '').substring(0, 800),
    applicationProcess: (s.applicationProcess || '').substring(0, 500),
    maxIncome: s.maxIncome || undefined,
    minAge: s.minAge || undefined,
    maxAge: s.maxAge || undefined,
    targetOccupations: s.targetOccupations,
    targetCategories: s.targetCategories,
    targetStates: s.targetStates,
    ministry: s.ministry || undefined,
    status: 'active',
    createdAt: Date.now(),
  }));

  // Batch write (25 items per batch, DynamoDB limit)
  const BATCH_SIZE = 25;
  let written = 0;
  let errors = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const params = {
      RequestItems: {
        [SCHEMES_TABLE]: batch.map(item => ({
          PutRequest: { Item: item },
        })),
      },
    };

    try {
      const result = await ddb.send(new BatchWriteCommand(params));

      // Handle unprocessed items (throttling)
      let unprocessed = result.UnprocessedItems?.[SCHEMES_TABLE];
      let retries = 0;
      while (unprocessed && unprocessed.length > 0 && retries < 3) {
        retries++;
        await new Promise(r => setTimeout(r, 1000 * retries));
        const retry = await ddb.send(new BatchWriteCommand({
          RequestItems: { [SCHEMES_TABLE]: unprocessed },
        }));
        unprocessed = retry.UnprocessedItems?.[SCHEMES_TABLE];
      }

      written += batch.length;
      if (written % 100 === 0 || i + BATCH_SIZE >= items.length) {
        console.log(`  Progress: ${written}/${items.length} schemes written`);
      }
    } catch (err) {
      errors += batch.length;
      console.error(`  Batch error at ${i}: ${err.message}`);
    }
  }

  console.log(`\nDone! Seeded ${written} schemes, ${errors} errors.`);
}

seed().catch(console.error);
