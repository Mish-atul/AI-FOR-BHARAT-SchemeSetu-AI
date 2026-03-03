"use strict";

/**
 * SchemeSetu AI — Schemes Lambda
 *
 * GET /schemes          → list all schemes
 * GET /schemes/eligible → list schemes user is eligible for
 *
 * AWS Services: DynamoDB only
 */

const {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  ScanCommand,
} = require("@aws-sdk/client-dynamodb");

const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const dynamo = new DynamoDBClient({ region: process.env.REGION });

const USERS_TABLE   = process.env.USERS_TABLE;
const DOCS_TABLE    = process.env.DOCUMENTS_TABLE;
const SCHEMES_TABLE = process.env.SCHEMES_TABLE;

// ── HTTP helper ────────────────────────────────────────────────────────────────
const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type"                : "application/json",
    "Access-Control-Allow-Origin" : "*",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
  },
  body: JSON.stringify(body),
});

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  console.log("Schemes:", JSON.stringify({ path: event.path, method: event.httpMethod }));

  try {
    const userId = event.requestContext?.authorizer?.userId;
    if (!userId) return respond(401, { error: "Unauthorized" });

    const path = event.path || "";

    // GET /schemes/eligible → personalized eligibility list
    if (path.endsWith("/eligible")) {
      return await getEligibleSchemes(userId);
    }

    // GET /schemes → return all schemes (no eligibility check)
    return await getAllSchemes();

  } catch (err) {
    console.error("Schemes error:", err);
    return respond(500, { error: "Unable to fetch schemes.", detail: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET ALL SCHEMES — just returns everything in the table
// ─────────────────────────────────────────────────────────────────────────────
async function getAllSchemes() {
  const res     = await dynamo.send(new ScanCommand({ TableName: SCHEMES_TABLE }));
  const schemes = (res.Items || []).map(i => unmarshall(i));
  return respond(200, { schemes, total: schemes.length });
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET ELIGIBLE SCHEMES — checks user profile + docs against each scheme
// ─────────────────────────────────────────────────────────────────────────────
async function getEligibleSchemes(userId) {
  // Load everything in parallel
  const [userProfile, userDocs, allSchemes] = await Promise.all([
    fetchUserProfile(userId),
    fetchUserDocuments(userId),
    fetchAllSchemes(),
  ]);

  if (!userProfile) {
    return respond(200, {
      schemes      : [],
      total        : 0,
      message      : "Please complete your profile to see eligible schemes.",
      profileComplete: false,
    });
  }

  // Extract income from profile OR from verified documents (teammate's OCR output)
  const profileIncome = userProfile.monthlyIncome || (userProfile.annualIncome / 12) || 0;
  const docIncome     = extractIncomeFromDocs(userDocs);
  const monthlyIncome = docIncome || profileIncome || 0;
  const annualIncome  = monthlyIncome * 12;

  // Build user context for eligibility check
  const userContext = {
    monthlyIncome,
    annualIncome,
    age        : userProfile.age || 0,
    gender     : (userProfile.gender || "").toLowerCase(),
    state      : (userProfile.state || userProfile.location?.state || "").toLowerCase(),
    occupation : (userProfile.occupation || userProfile.employmentType || "").toLowerCase(),
    hasAadhaar : userProfile.hasAadhaar || false,
    hasBankAccount: userProfile.hasBankAccount || false,
    hasLPG     : userProfile.hasLPG || false,
    documents  : userDocs,
  };

  // Score each scheme
  const results = allSchemes.map(scheme => {
    const { eligible, score, reasons, missingDocs } = checkEligibility(userContext, scheme);
    return { ...scheme, eligible, score, reasons, missingDocs };
  });

  // Sort: eligible first, then by score descending
  results.sort((a, b) => {
    if (a.eligible && !b.eligible) return -1;
    if (!a.eligible && b.eligible) return 1;
    return b.score - a.score;
  });

  const eligibleSchemes    = results.filter(s => s.eligible);
  const notEligibleSchemes = results.filter(s => !s.eligible);

  return respond(200, {
    schemes        : results,
    eligibleSchemes,
    notEligible    : notEligibleSchemes,
    total          : results.length,
    eligibleCount  : eligibleSchemes.length,
    profileComplete: true,
    userIncome     : monthlyIncome,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  ELIGIBILITY ENGINE
//  Checks user context against scheme criteria
//  Returns: { eligible, score (0-100), reasons[], missingDocs[] }
// ─────────────────────────────────────────────────────────────────────────────
function checkEligibility(user, scheme) {
  const reasons    = [];   // why eligible
  const blockers   = [];   // why NOT eligible
  const missingDocs = [];
  let score        = 0;

  // ── Income check ──────────────────────────────────────────────────────────
  if (scheme.maxAnnualIncome) {
    if (user.annualIncome === 0) {
      reasons.push("Income not verified yet — upload income proof to confirm");
    } else if (user.annualIncome <= scheme.maxAnnualIncome) {
      reasons.push(`✓ Income ₹${user.annualIncome.toLocaleString()}/yr is within limit`);
      score += 30;
    } else {
      blockers.push(`✗ Annual income ₹${user.annualIncome.toLocaleString()} exceeds limit of ₹${scheme.maxAnnualIncome.toLocaleString()}`);
    }
  }

  if (scheme.maxMonthlyIncome) {
    if (user.monthlyIncome === 0) {
      reasons.push("Income not verified yet");
    } else if (user.monthlyIncome <= scheme.maxMonthlyIncome) {
      reasons.push(`✓ Monthly income ₹${user.monthlyIncome.toLocaleString()} is within limit`);
      score += 30;
    } else {
      blockers.push(`✗ Monthly income ₹${user.monthlyIncome.toLocaleString()} exceeds limit of ₹${scheme.maxMonthlyIncome.toLocaleString()}`);
    }
  }

  // ── Age check ─────────────────────────────────────────────────────────────
  if (scheme.minAge || scheme.maxAge) {
    if (!user.age) {
      reasons.push("Age not in profile — please update your profile");
    } else {
      const minOk = !scheme.minAge || user.age >= scheme.minAge;
      const maxOk = !scheme.maxAge || user.age <= scheme.maxAge;
      if (minOk && maxOk) {
        reasons.push(`✓ Age ${user.age} is within required range`);
        score += 20;
      } else {
        blockers.push(`✗ Age ${user.age} is outside required range (${scheme.minAge || 0}-${scheme.maxAge || "any"})`);
      }
    }
  }

  // ── Gender check ──────────────────────────────────────────────────────────
  if (scheme.targetGender) {
    if (user.gender === scheme.targetGender.toLowerCase()) {
      reasons.push(`✓ Gender matches scheme requirement`);
      score += 10;
    } else if (user.gender) {
      blockers.push(`✗ Scheme is for ${scheme.targetGender} only`);
    }
  }

  // ── State check ───────────────────────────────────────────────────────────
  if (scheme.states?.length > 0) {
    const stateMatch = scheme.states.some(s => s.toLowerCase() === user.state);
    if (stateMatch) {
      reasons.push(`✓ Available in your state`);
      score += 10;
    } else if (user.state) {
      blockers.push(`✗ Scheme not available in ${user.state}`);
    }
  } else {
    // Available in all states
    reasons.push(`✓ Available across all states`);
    score += 10;
  }

  // ── Occupation/Target group check ─────────────────────────────────────────
  if (scheme.targetGroup) {
    const target = scheme.targetGroup.toLowerCase();
    const occ    = user.occupation;
    const matches =
      target.includes("farmer")    && occ.includes("farm")   ||
      target.includes("worker")    && (occ.includes("labour") || occ.includes("worker")) ||
      target.includes("women")     && user.gender === "female" ||
      target.includes("bpl")       && user.annualIncome < 100000 ||
      target.includes("informal")  ||
      target.includes("all");

    if (matches) {
      reasons.push(`✓ You qualify as target beneficiary`);
      score += 20;
    }
  }

  // ── Document requirements check ───────────────────────────────────────────
  if (scheme.requiredDocuments?.length > 0) {
    const verifiedTypes = (user.documents || [])
      .filter(d => d.status === "verified" || d.ocrConfidence >= 0.8)
      .map(d => (d.documentType || d.type || "").toLowerCase());

    scheme.requiredDocuments.forEach(reqDoc => {
      const has = verifiedTypes.some(t => t.includes(reqDoc.toLowerCase()));
      if (!has) missingDocs.push(reqDoc);
    });

    if (missingDocs.length === 0) {
      reasons.push(`✓ All required documents available`);
      score += 10;
    }
  }

  // ── Final eligibility decision ────────────────────────────────────────────
  // Eligible if no hard blockers
  const eligible = blockers.length === 0;
  if (!eligible) score = Math.min(score, 30);  // cap score if blocked

  return {
    eligible,
    score    : Math.min(score, 100),
    reasons  : eligible ? reasons : [...reasons, ...blockers],
    missingDocs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  DynamoDB helpers
// ─────────────────────────────────────────────────────────────────────────────
async function fetchUserProfile(userId) {
  try {
    const res = await dynamo.send(new GetItemCommand({
      TableName: USERS_TABLE,
      Key      : marshall({ PK: `USER#${userId}`, SK: "PROFILE" }),
    }));
    return res.Item ? unmarshall(res.Item) : null;
  } catch (e) { console.warn("fetchUserProfile:", e.message); return null; }
}

async function fetchUserDocuments(userId) {
  try {
    const res = await dynamo.send(new QueryCommand({
      TableName                 : DOCS_TABLE,
      KeyConditionExpression    : "PK = :pk",
      ExpressionAttributeValues : marshall({ ":pk": `USER#${userId}` }),
    }));
    return (res.Items || []).map(i => unmarshall(i));
  } catch (e) { console.warn("fetchUserDocs:", e.message); return []; }
}

async function fetchAllSchemes() {
  try {
    const res = await dynamo.send(new ScanCommand({ TableName: SCHEMES_TABLE }));
    return (res.Items || []).map(i => unmarshall(i));
  } catch (e) { console.warn("fetchAllSchemes:", e.message); return []; }
}

// Extract best income value from verified documents (set by teammate's OCR lambda)
function extractIncomeFromDocs(docs) {
  const verified = (docs || []).filter(d =>
    d.status === "verified" || d.status === "processed" || d.ocrConfidence >= 0.8
  );
  for (const doc of verified) {
    const income = doc.extractedData?.monthlyIncome ||
                   doc.extractedData?.income        ||
                   (doc.extractedData?.annualIncome / 12);
    if (income && income > 0) return income;
  }
  return 0;
}