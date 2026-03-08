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
        const kvPairs = {};
        for (const [keyId, keyBlock] of Object.entries(keyMap)) {
          const keyText = getTextFromBlock(keyBlock, blockMap);
          const valueBlock = keyBlock.Relationships?.find(r => r.Type === 'VALUE');
          if (valueBlock) {
            const valBlock = valueMap[valueBlock.Ids?.[0]];
            if (valBlock) {
              const valText = getTextFromBlock(valBlock, blockMap);
              if (keyText && valText) {
                kvPairs[keyText.toLowerCase().replace(/[^a-z0-9]/g, '_')] = valText;
              }
            }
          }
        }

        // Extract full text from all LINE blocks
        const fullText = blocks
          .filter(b => b.BlockType === 'LINE')
          .map(b => b.Text)
          .join('\n');

        // Calculate average confidence from WORD blocks (most accurate)
        const wordBlocks = blocks.filter(b => b.BlockType === 'WORD' && b.Confidence);
        ocrConfidence = wordBlocks.length > 0
          ? wordBlocks.reduce((sum, b) => sum + b.Confidence, 0) / wordBlocks.length / 100
          : 0;

        // Start with raw key-value pairs
        extractedData = { ...kvPairs };

        // Always extract amounts and dates from full text
        extractAmountsAndDates(extractedData, fullText);

        // Document-type-specific extraction
        switch ((docType || '').toLowerCase()) {
          case 'aadhaar':
            extractAadhaarFields(extractedData, fullText, kvPairs);
            break;
          case 'pan':
            extractPanFields(extractedData, fullText, kvPairs);
            break;
          case 'bank_statement':
          case 'bank':
            extractBankStatementFields(extractedData, fullText, kvPairs);
            break;
          case 'salary_slip':
          case 'payslip':
            extractSalaryFields(extractedData, fullText, kvPairs);
            break;
          case 'invoice':
          case 'receipt':
          case 'payment_receipt':
            extractFinancialFields(extractedData, fullText, kvPairs);
            break;
          case 'ration_card':
            extractRationCardFields(extractedData, fullText, kvPairs);
            break;
          case 'voter_id':
            extractVoterIdFields(extractedData, fullText, kvPairs);
            break;
          default:
            // Generic: try to extract name, address, amounts from any document
            extractGenericFields(extractedData, fullText, kvPairs);
            break;
        }

        // Store full text summary (first 2000 chars) for AI context
        extractedData.fullTextSummary = fullText.substring(0, 2000);
        extractedData.docType = docType;
      } else if (fileType?.includes('csv')) {
        ocrConfidence = 1.0;
        extractedData = { type: 'csv', note: 'CSV data parsed directly', docType };
      }

      // Update document with OCR results
      await ddb.send(new UpdateCommand({
        TableName: DOCUMENTS_TABLE,
        Key: { PK: `USER#${userId}`, SK: `DOC#${documentId}` },
        UpdateExpression: 'SET extractedData = :data, ocrConfidence = :conf, verificationStatus = :status, GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':data': extractedData,
          ':conf': Math.round(ocrConfidence * 100) / 100,
          ':status': ocrConfidence >= 0.8 ? 'verified' : 'pending_review',
          ':gsi1pk': `STATUS#${ocrConfidence >= 0.8 ? 'verified' : 'pending_review'}`,
        },
      }));

      console.log(`OCR completed for ${documentId}: confidence=${ocrConfidence}, fields=${Object.keys(extractedData).length}`);
    } catch (err) {
      console.error(`OCR failed for ${documentId}:`, err);
      
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

// --- Common extraction helpers ---

function extractAmountsAndDates(data, fullText) {
  // Find all amounts (₹, Rs, INR patterns)
  const amountMatches = fullText.match(/(?:[₹]|Rs\.?|INR)\s*([\d,]+\.?\d*)/gi) || [];
  const amounts = amountMatches.map(m => {
    const num = m.replace(/[₹Rs.INR\s]/gi, '').replace(/,/g, '');
    return parseFloat(num);
  }).filter(n => !isNaN(n) && n > 0);

  if (amounts.length > 0) {
    data.amount = Math.max(...amounts); // primary/largest amount
    if (amounts.length > 1) data.allAmounts = amounts;
  }

  // Find dates (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
  const dateMatches = fullText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/g) || [];
  if (dateMatches.length > 0) {
    data.date = dateMatches[0];
    if (dateMatches.length > 1) data.allDates = dateMatches;
  }
}

function extractNameFromText(fullText) {
  // Common patterns: "Name: ...", "Name of ...: ..."
  const nameMatch = fullText.match(/(?:Name|नाम)\s*[:\-]?\s*([A-Z][a-zA-Z\s.]+)/i);
  return nameMatch ? nameMatch[1].trim() : null;
}

// --- Document-type specific extractors ---

function extractAadhaarFields(data, fullText, kvPairs) {
  // Aadhaar number: 12 digits (XXXX XXXX XXXX)
  const aadhaarMatch = fullText.match(/\b(\d{4}\s?\d{4}\s?\d{4})\b/);
  if (aadhaarMatch) data.aadhaarNumber = aadhaarMatch[1].replace(/\s/g, '');

  // Name
  const name = extractNameFromText(fullText);
  if (name) data.name = name;

  // DOB
  const dobMatch = fullText.match(/(?:DOB|Date of Birth|जन्म\s*तिथि)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dobMatch) data.dateOfBirth = dobMatch[1];

  // Gender
  const genderMatch = fullText.match(/\b(MALE|FEMALE|पुरुष|महिला|TRANSGENDER)\b/i);
  if (genderMatch) data.gender = genderMatch[1];

  // Address
  const addressMatch = fullText.match(/(?:Address|पता)\s*[:\-]?\s*(.+?)(?:\n|$)/i);
  if (addressMatch) data.address = addressMatch[1].trim();

  // VID
  const vidMatch = fullText.match(/(?:VID)\s*[:\-]?\s*(\d{4}\s?\d{4}\s?\d{4}\s?\d{4})/i);
  if (vidMatch) data.vid = vidMatch[1].replace(/\s/g, '');

  data.documentCategory = 'identity';
}

function extractPanFields(data, fullText, kvPairs) {
  // PAN number: ABCDE1234F
  const panMatch = fullText.match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
  if (panMatch) data.panNumber = panMatch[1];

  const name = extractNameFromText(fullText);
  if (name) data.name = name;

  // Father's name
  const fatherMatch = fullText.match(/(?:Father|पिता)\s*(?:'s)?\s*(?:Name)?\s*[:\-]?\s*([A-Z][a-zA-Z\s.]+)/i);
  if (fatherMatch) data.fatherName = fatherMatch[1].trim();

  const dobMatch = fullText.match(/(?:DOB|Date of Birth)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dobMatch) data.dateOfBirth = dobMatch[1];

  data.documentCategory = 'identity';
}

function extractBankStatementFields(data, fullText, kvPairs) {
  // Account number
  const acctMatch = fullText.match(/(?:A\/C|Account|Acct)\s*(?:No\.?|Number)?\s*[:\-]?\s*(\d{8,18})/i);
  if (acctMatch) data.accountNumber = acctMatch[1];

  // IFSC code
  const ifscMatch = fullText.match(/(?:IFSC)\s*[:\-]?\s*([A-Z]{4}0[A-Z0-9]{6})/i);
  if (ifscMatch) data.ifscCode = ifscMatch[1];

  // Bank name
  const bankMatch = fullText.match(/(State Bank|HDFC|ICICI|Axis|Punjab National|Bank of Baroda|Canara|Union Bank|Kotak|IndusInd|Yes Bank|IDBI|Central Bank|Indian Bank|Bank of India)[^\n]*/i);
  if (bankMatch) data.bankName = bankMatch[1].trim();

  const name = extractNameFromText(fullText);
  if (name) data.accountHolder = name;

  // Balance
  const balanceMatch = fullText.match(/(?:Balance|Bal|Closing)\s*[:\-]?\s*(?:[₹Rs.INR]*)\s*([\d,]+\.?\d*)/i);
  if (balanceMatch) data.balance = parseFloat(balanceMatch[1].replace(/,/g, ''));

  // Credits / total deposits
  const creditMatches = fullText.match(/(?:Cr|Credit|Deposit)\s*[:\-]?\s*(?:[₹Rs.INR]*)\s*([\d,]+\.?\d*)/gi) || [];
  const credits = creditMatches.map(m => parseFloat((m.match(/([\d,]+\.?\d*)/) || ['0'])[0].replace(/,/g, ''))).filter(n => n > 0);
  if (credits.length > 0) {
    data.totalCredits = credits.reduce((a, b) => a + b, 0);
    data.amount = data.totalCredits; // Use total credits as income indicator
  }

  data.documentCategory = 'financial';
}

function extractSalaryFields(data, fullText, kvPairs) {
  const name = extractNameFromText(fullText);
  if (name) data.employeeName = name;

  // Employee ID
  const empIdMatch = fullText.match(/(?:Emp|Employee)\s*(?:ID|No|Code)\s*[:\-]?\s*([A-Z0-9]+)/i);
  if (empIdMatch) data.employeeId = empIdMatch[1];

  // Gross salary
  const grossMatch = fullText.match(/(?:Gross|Total)\s*(?:Salary|Pay|Earnings)\s*[:\-]?\s*(?:[₹Rs.INR]*)\s*([\d,]+\.?\d*)/i);
  if (grossMatch) data.grossSalary = parseFloat(grossMatch[1].replace(/,/g, ''));

  // Net salary
  const netMatch = fullText.match(/(?:Net|Take\s*Home)\s*(?:Salary|Pay)\s*[:\-]?\s*(?:[₹Rs.INR]*)\s*([\d,]+\.?\d*)/i);
  if (netMatch) data.netSalary = parseFloat(netMatch[1].replace(/,/g, ''));

  // Use gross or net as the main amount
  data.amount = data.grossSalary || data.netSalary || data.amount;

  // Designation
  const dsgMatch = fullText.match(/(?:Designation|Position|Role)\s*[:\-]?\s*([A-Za-z\s]+)/i);
  if (dsgMatch) data.designation = dsgMatch[1].trim();

  data.documentCategory = 'income';
}

function extractFinancialFields(data, fullText, kvPairs) {
  // Vendor/merchant name
  const vendorMatch = fullText.match(/(?:From|Vendor|Merchant|Seller)\s*[:\-]?\s*([A-Za-z0-9\s&.]+)/i);
  if (vendorMatch) data.vendor = vendorMatch[1].trim();

  // Invoice/receipt number
  const invMatch = fullText.match(/(?:Invoice|Receipt|Bill)\s*(?:No\.?|Number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i);
  if (invMatch) data.invoiceNumber = invMatch[1];

  // GST number
  const gstMatch = fullText.match(/(?:GST|GSTIN)\s*(?:No\.?)?\s*[:\-]?\s*(\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z0-9]{2})/i);
  if (gstMatch) data.gstNumber = gstMatch[1];

  data.documentCategory = 'financial';
}

function extractRationCardFields(data, fullText, kvPairs) {
  const name = extractNameFromText(fullText);
  if (name) data.headOfFamily = name;

  // Card number
  const cardMatch = fullText.match(/(?:Card|Ration)\s*(?:No\.?|Number)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i);
  if (cardMatch) data.rationCardNumber = cardMatch[1];

  // Category (APL/BPL/AAY)
  const catMatch = fullText.match(/\b(APL|BPL|AAY|PHH|NPHH|Antyodaya)\b/i);
  if (catMatch) data.category = catMatch[1].toUpperCase();

  // Family members count
  const membersMatch = fullText.match(/(?:Members|Family Size)\s*[:\-]?\s*(\d+)/i);
  if (membersMatch) data.familyMembers = parseInt(membersMatch[1]);

  data.documentCategory = 'identity';
}

function extractVoterIdFields(data, fullText, kvPairs) {
  // EPIC number
  const epicMatch = fullText.match(/\b([A-Z]{3}\d{7})\b/);
  if (epicMatch) data.epicNumber = epicMatch[1];

  const name = extractNameFromText(fullText);
  if (name) data.name = name;

  // Father/Husband name
  const relMatch = fullText.match(/(?:Father|Husband)\s*(?:'s)?\s*(?:Name)?\s*[:\-]?\s*([A-Z][a-zA-Z\s.]+)/i);
  if (relMatch) data.fatherOrHusbandName = relMatch[1].trim();

  // Address with state/district
  const addressMatch = fullText.match(/(?:Address|Part No)\s*[:\-]?\s*(.+?)(?:\n|$)/i);
  if (addressMatch) data.address = addressMatch[1].trim();

  data.documentCategory = 'identity';
}

function extractGenericFields(data, fullText, kvPairs) {
  // Try to extract any useful info from unknown document types
  const name = extractNameFromText(fullText);
  if (name) data.name = name;

  const addressMatch = fullText.match(/(?:Address|पता)\s*[:\-]?\s*(.+?)(?:\n|$)/i);
  if (addressMatch) data.address = addressMatch[1].trim();

  // Phone number
  const phoneMatch = fullText.match(/(?:Phone|Mobile|Tel|Contact)\s*[:\-]?\s*(\+?91[\s\-]?\d{10}|\d{10})/i);
  if (phoneMatch) data.phone = phoneMatch[1];

  // Email
  const emailMatch = fullText.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) data.email = emailMatch[1];

  data.documentCategory = 'other';
}
