// SchemeSetu AI — Schemes Lambda (Discovery + Eligibility + Document Matching)
const { ddb, QueryCommand, GetCommand, ScanCommand, response, getUserId, getPhoneNumber, parseBody } = require('../shared/utils');

const USERS_TABLE = process.env.USERS_TABLE;
const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE;
const SCHEMES_TABLE = process.env.SCHEMES_TABLE;

// Fetch all schemes from DynamoDB with pagination
async function getAllSchemes() {
  const items = [];
  let lastKey = undefined;
  do {
    const result = await ddb.send(new QueryCommand({
      TableName: SCHEMES_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': 'SCHEME' },
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.resource;
  const userId = getUserId(event);
  const qs = event.queryStringParameters || {};

  try {
    // GET /schemes — List all schemes (with optional filtering)
    if (path === '/schemes' && method === 'GET') {
      const allSchemes = await getAllSchemes();

      // Optional filters from query parameters
      let filtered = allSchemes;
      if (qs.state) {
        filtered = filtered.filter(s =>
          (s.targetStates || []).some(st =>
            st === 'All India' || st.toLowerCase() === qs.state.toLowerCase()
          )
        );
      }
      if (qs.occupation) {
        filtered = filtered.filter(s =>
          (s.targetOccupations || []).some(o =>
            o === 'all' || o.toLowerCase().includes(qs.occupation.toLowerCase())
          )
        );
      }
      if (qs.search) {
        const q = qs.search.toLowerCase();
        filtered = filtered.filter(s =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q) ||
          (s.benefits || '').toLowerCase().includes(q)
        );
      }

      // Return slim response (no fullText)
      return response(200, filtered.map(s => ({
        schemeId: s.schemeId,
        name: s.name,
        description: s.description,
        benefits: s.benefits,
        ministry: s.ministry,
        maxIncome: s.maxIncome,
        targetStates: s.targetStates,
        targetOccupations: s.targetOccupations,
      })));
    }

    // GET /schemes/eligible — Get eligible schemes with document match %
    if (path === '/schemes/eligible' && method === 'GET') {
      const phone = getPhoneNumber(event);

      // Fetch user profile, documents, and schemes in parallel
      const [userResult, docsResult, allSchemes] = await Promise.all([
        ddb.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { PK: `USER#${phone}`, SK: 'PROFILE' },
        })),
        ddb.send(new QueryCommand({
          TableName: DOCUMENTS_TABLE,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': `USER#${userId}` },
        })),
        getAllSchemes(),
      ]);

      const profile = userResult.Item?.profile || {};
      const docs = docsResult.Items || [];
      const verifiedDocs = docs.filter(d => d.verificationStatus === 'verified');

      // Build user's document type set from uploaded docs
      const userDocTypes = new Set();
      for (const doc of docs) {
        const dt = (doc.docType || doc.fileName || '').toLowerCase();
        // Map common document types
        if (dt.includes('aadhaar') || dt.includes('aadhar')) userDocTypes.add('aadhaar');
        if (dt.includes('pan')) userDocTypes.add('pan_card');
        if (dt.includes('ration')) userDocTypes.add('ration_card');
        if (dt.includes('voter') || dt.includes('election')) userDocTypes.add('voter_id');
        if (dt.includes('income') || dt.includes('salary')) userDocTypes.add('income_certificate');
        if (dt.includes('bank') || dt.includes('passbook')) userDocTypes.add('bank_passbook');
        if (dt.includes('caste')) userDocTypes.add('caste_certificate');
        if (dt.includes('domicile') || dt.includes('residence')) userDocTypes.add('domicile_certificate');
        if (dt.includes('birth')) userDocTypes.add('birth_certificate');
        if (dt.includes('land') || dt.includes('patta')) userDocTypes.add('land_record');
        if (dt.includes('disability') || dt.includes('pwd')) userDocTypes.add('disability_certificate');
        if (dt.includes('bpl')) userDocTypes.add('bpl_certificate');
        if (dt.includes('photo') || dt.includes('passport')) userDocTypes.add('photo');
      }

      // Score each scheme
      const scored = allSchemes.map(scheme => {
        const result = calculateEligibility(scheme, profile, docs, verifiedDocs, userDocTypes);
        return {
          schemeId: scheme.schemeId,
          schemeName: scheme.name,
          description: scheme.description,
          ministry: scheme.ministry,
          benefits: scheme.benefits,
          eligibilityScore: result.score,
          documentMatch: result.documentMatch,
          matchReasons: result.matchReasons,
          missingRequirements: result.missingRequirements,
          missingDocuments: result.missingDocuments,
          targetStates: scheme.targetStates,
        };
      });

      // Sort by eligibility score descending
      scored.sort((a, b) => b.eligibilityScore - a.eligibilityScore);

      // Return top 50 most relevant
      return response(200, scored.slice(0, 50));
    }

    return response(404, { error: 'Route not found' });
  } catch (err) {
    console.error('Schemes error:', err);
    return response(500, { error: 'Internal server error' });
  }
};

// Known document type keywords that appear in myScheme "Documents Required" text
const DOC_PATTERNS = [
  { type: 'aadhaar', patterns: ['aadhaar', 'aadhar', 'uid'] },
  { type: 'pan_card', patterns: ['pan card', 'pan number'] },
  { type: 'ration_card', patterns: ['ration card'] },
  { type: 'voter_id', patterns: ['voter id', 'voter card', 'election card', 'epic'] },
  { type: 'income_certificate', patterns: ['income certificate', 'income proof', 'salary slip', 'salary certificate'] },
  { type: 'bank_passbook', patterns: ['bank passbook', 'bank account', 'bank statement', 'bank details'] },
  { type: 'caste_certificate', patterns: ['caste certificate', 'sc/st certificate', 'obc certificate', 'community certificate'] },
  { type: 'domicile_certificate', patterns: ['domicile', 'residence proof', 'residence certificate', 'address proof'] },
  { type: 'birth_certificate', patterns: ['birth certificate', 'date of birth', 'dob proof'] },
  { type: 'land_record', patterns: ['land record', 'land document', 'patta', 'land ownership', 'khasra', 'khatauni'] },
  { type: 'disability_certificate', patterns: ['disability certificate', 'pwd certificate', 'handicapped'] },
  { type: 'bpl_certificate', patterns: ['bpl card', 'bpl certificate', 'below poverty'] },
  { type: 'photo', patterns: ['passport size photo', 'photograph', 'passport photo'] },
];

function getRequiredDocTypes(docsRequiredText) {
  if (!docsRequiredText) return [];
  const lower = docsRequiredText.toLowerCase();
  const required = [];
  for (const { type, patterns } of DOC_PATTERNS) {
    if (patterns.some(p => lower.includes(p))) {
      required.push(type);
    }
  }
  return required;
}

function calculateEligibility(scheme, profile, allDocs, verifiedDocs, userDocTypes) {
  let score = 40; // Base score
  const matchReasons = [];
  const missingRequirements = [];

  // 1. Income check (25 points)
  if (scheme.maxIncome && profile.monthlyIncome) {
    const annualIncome = profile.monthlyIncome * 12;
    if (annualIncome <= scheme.maxIncome) {
      score += 25;
      matchReasons.push(`Income within ₹${scheme.maxIncome.toLocaleString()}/year limit`);
    } else {
      score -= 15;
      missingRequirements.push(`Annual income exceeds ₹${scheme.maxIncome.toLocaleString()} limit`);
    }
  } else if (scheme.maxIncome && !profile.monthlyIncome) {
    missingRequirements.push('Update income in profile for better matching');
  } else if (!scheme.maxIncome) {
    score += 10; // No income restriction = more accessible
  }

  // 2. Occupation match (15 points)
  if (profile.occupation) {
    const occ = profile.occupation.toLowerCase();
    const schemeOccs = scheme.targetOccupations || [];
    if (schemeOccs.includes('all') || schemeOccs.some(t => occ.includes(t) || t.includes(occ))) {
      score += 15;
      matchReasons.push(`Occupation matches scheme target`);
    }
  }

  // 3. State match (10 points)
  if (profile.state) {
    const states = scheme.targetStates || [];
    if (states.includes('All India') || states.some(s => s.toLowerCase() === profile.state.toLowerCase())) {
      score += 10;
      matchReasons.push(`Available in ${profile.state}`);
    } else if (states.length > 0 && !states.includes('All India')) {
      score -= 10;
      missingRequirements.push(`Scheme is for: ${states.slice(0, 3).join(', ')}`);
    }
  }

  // 4. Age check (10 points)
  if (profile.age) {
    const ageOk = (!scheme.minAge || profile.age >= scheme.minAge) &&
                  (!scheme.maxAge || profile.age <= scheme.maxAge);
    if (ageOk) {
      score += 10;
      if (scheme.minAge || scheme.maxAge) {
        matchReasons.push('Age meets requirement');
      }
    } else {
      score -= 20;
      missingRequirements.push(`Age requirement: ${scheme.minAge || 0}-${scheme.maxAge || 'any'} years`);
    }
  }

  // 5. Document match percentage (up to 15 points)
  const requiredDocTypes = getRequiredDocTypes(scheme.documentsRequired);
  let documentMatch = { percentage: 0, matched: [], missing: [] };

  if (requiredDocTypes.length > 0) {
    const matched = requiredDocTypes.filter(dt => userDocTypes.has(dt));
    const missing = requiredDocTypes.filter(dt => !userDocTypes.has(dt));
    const pct = Math.round((matched.length / requiredDocTypes.length) * 100);
    documentMatch = { percentage: pct, matched, missing };

    score += Math.round((pct / 100) * 15);
    if (pct > 0) matchReasons.push(`${pct}% documents ready (${matched.length}/${requiredDocTypes.length})`);
    if (missing.length > 0) missingRequirements.push(`Missing docs: ${missing.join(', ')}`);
  } else if (verifiedDocs.length > 0) {
    score += 5;
    matchReasons.push(`${verifiedDocs.length} verified document(s)`);
    documentMatch = { percentage: verifiedDocs.length > 0 ? 50 : 0, matched: [], missing: [] };
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    documentMatch,
    matchReasons,
    missingRequirements,
    missingDocuments: documentMatch.missing,
  };
}
