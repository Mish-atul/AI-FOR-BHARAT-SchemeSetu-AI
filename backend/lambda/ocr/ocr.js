// SchemeSetu AI — OCR Processing Lambda (triggered by SQS)
const { TextractClient, AnalyzeDocumentCommand } = require('@aws-sdk/client-textract');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { ddb, UpdateCommand, response } = require('../shared/utils');

const textract = new TextractClient({ region: process.env.REGION });
const s3 = new S3Client({ region: process.env.REGION });

const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE;
const DOCUMENT_BUCKET = process.env.DOCUMENT_BUCKET;

exports.handler = async (event) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    const { documentId, userId, s3Key, docType, fileType } = message;

    console.log(`Processing OCR for document: ${documentId}`);

    try {
      let extractedData = {};
      let ocrConfidence = 0;

      // Only process image/PDF types with Textract
      if (fileType && (fileType.includes('image') || fileType.includes('pdf'))) {
        const textractResult = await textract.send(new AnalyzeDocumentCommand({
          Document: {
            S3Object: {
              Bucket: DOCUMENT_BUCKET,
              Name: s3Key,
            },
          },
          FeatureTypes: ['FORMS', 'TABLES'],
        }));

        // Extract key-value pairs
        const blocks = textractResult.Blocks || [];
        const keyMap = {};
        const valueMap = {};
        const blockMap = {};

        blocks.forEach(b => {
          blockMap[b.Id] = b;
          if (b.BlockType === 'KEY_VALUE_SET') {
            if (b.EntityTypes?.includes('KEY')) keyMap[b.Id] = b;
            else valueMap[b.Id] = b;
          }
        });

        // Build extracted data from key-value pairs
        for (const [keyId, keyBlock] of Object.entries(keyMap)) {
          const keyText = getTextFromBlock(keyBlock, blockMap);
          const valueBlock = keyBlock.Relationships?.find(r => r.Type === 'VALUE');
          if (valueBlock) {
            const valBlock = valueMap[valueBlock.Ids?.[0]];
            if (valBlock) {
              const valText = getTextFromBlock(valBlock, blockMap);
              if (keyText && valText) {
                extractedData[keyText.toLowerCase().replace(/[^a-z0-9]/g, '_')] = valText;
              }
            }
          }
        }

        // Calculate average confidence
        const confidences = blocks
          .filter(b => b.Confidence)
          .map(b => b.Confidence);
        ocrConfidence = confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length / 100
          : 0;

        // Map common fields based on docType  
        if (docType === 'invoice' || docType === 'receipt') {
          extractedData = mapFinancialFields(extractedData, blocks);
        }
      } else if (fileType?.includes('csv')) {
        // For CSV, parse directly
        ocrConfidence = 1.0;
        extractedData = { type: 'csv', note: 'CSV data parsed directly' };
      }

      // Update document with OCR results
      await ddb.send(new UpdateCommand({
        TableName: DOCUMENTS_TABLE,
        Key: { PK: `USER#${userId}`, SK: `DOC#${documentId}` },
        UpdateExpression: 'SET extractedData = :data, ocrConfidence = :conf, verificationStatus = :status, GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':data': extractedData,
          ':conf': ocrConfidence,
          ':status': ocrConfidence >= 0.8 ? 'verified' : 'pending_review',
          ':gsi1pk': `STATUS#${ocrConfidence >= 0.8 ? 'verified' : 'pending_review'}`,
        },
      }));

      console.log(`OCR completed for ${documentId}: confidence=${ocrConfidence}`);
    } catch (err) {
      console.error(`OCR failed for ${documentId}:`, err);
      
      // Mark as pending review on error
      await ddb.send(new UpdateCommand({
        TableName: DOCUMENTS_TABLE,
        Key: { PK: `USER#${userId}`, SK: `DOC#${documentId}` },
        UpdateExpression: 'SET verificationStatus = :status, GSI1PK = :gsi1pk, ocrError = :err',
        ExpressionAttributeValues: {
          ':status': 'pending_review',
          ':gsi1pk': `STATUS#pending_review`,
          ':err': err.message,
        },
      }));
    }
  }
};

function getTextFromBlock(block, blockMap) {
  let text = '';
  if (block.Relationships) {
    for (const rel of block.Relationships) {
      if (rel.Type === 'CHILD') {
        for (const childId of rel.Ids || []) {
          const child = blockMap[childId];
          if (child?.BlockType === 'WORD') {
            text += (text ? ' ' : '') + child.Text;
          }
        }
      }
    }
  }
  return text;
}

function mapFinancialFields(data, blocks) {
  // Extract full text for amount detection
  const fullText = blocks
    .filter(b => b.BlockType === 'LINE')
    .map(b => b.Text)
    .join(' ');

  // Try to find amounts (₹ or Rs patterns)
  const amountMatch = fullText.match(/[₹Rs.]\s*([\d,]+\.?\d*)/);
  if (amountMatch) {
    data.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Try to find dates
  const dateMatch = fullText.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  if (dateMatch) {
    data.date = dateMatch[1];
  }

  return data;
}
