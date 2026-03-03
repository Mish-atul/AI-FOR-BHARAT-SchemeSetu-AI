"use strict";

/**
 * SchemeSetu AI — Seed Data Script
 * Seeds 8 real government schemes into DynamoDB
 *
 * Run: SCHEMES_TABLE="schemesetu-schemes" node scripts/seed-data.js
 */

const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");

const dynamo = new DynamoDBClient({ region: "ap-south-1" });
const TABLE  = process.env.SCHEMES_TABLE || "schemesetu-schemes";

const schemes = [
  {
    PK          : "SCHEME#PMAY",
    SK          : "METADATA",
    schemeId    : "PMAY",
    schemeName  : "Pradhan Mantri Awas Yojana (PMAY)",
    description : "Affordable housing for urban and rural poor. Provides subsidy on home loans.",
    benefits    : "Home loan interest subsidy up to ₹2.67 lakh. Financial assistance up to ₹1.2 lakh for rural housing.",
    maxAnnualIncome  : 300000,
    maxMonthlyIncome : 25000,
    minAge      : 18,
    targetGroup : "BPL families, EWS, LIG, informal workers without pucca house",
    targetGender: null,
    states      : [],
    requiredDocuments: ["aadhaar", "income proof", "bank account"],
    applyUrl    : "https://pmaymis.gov.in",
    ministry    : "Ministry of Housing and Urban Affairs",
    isActive    : true,
  },
  {
    PK          : "SCHEME#PMKISAN",
    SK          : "METADATA",
    schemeId    : "PM-KISAN",
    schemeName  : "PM Kisan Samman Nidhi (PM-KISAN)",
    description : "Direct income support of ₹6,000/year to small and marginal farmers.",
    benefits    : "₹6,000 per year in 3 installments of ₹2,000 directly to bank account.",
    maxAnnualIncome  : 200000,
    maxMonthlyIncome : 16667,
    minAge      : 18,
    targetGroup : "Small and marginal farmers owning cultivable land",
    targetGender: null,
    states      : [],
    requiredDocuments: ["aadhaar", "land records", "bank account"],
    applyUrl    : "https://pmkisan.gov.in",
    ministry    : "Ministry of Agriculture",
    isActive    : true,
  },
  {
    PK          : "SCHEME#MUDRA",
    SK          : "METADATA",
    schemeId    : "MUDRA",
    schemeName  : "PM MUDRA Yojana",
    description : "Loans up to ₹10 lakh for small businesses and self-employed individuals.",
    benefits    : "Shishu: up to ₹50,000 | Kishore: ₹50,000–5 lakh | Tarun: ₹5–10 lakh. No collateral required.",
    maxAnnualIncome  : 500000,
    maxMonthlyIncome : 41667,
    minAge      : 18,
    maxAge      : 65,
    targetGroup : "Self-employed, small business owners, informal workers, entrepreneurs",
    targetGender: null,
    states      : [],
    requiredDocuments: ["aadhaar", "business proof", "bank account"],
    applyUrl    : "https://mudra.org.in",
    ministry    : "Ministry of Finance",
    isActive    : true,
  },
  {
    PK          : "SCHEME#PMJAY",
    SK          : "METADATA",
    schemeId    : "PM-JAY",
    schemeName  : "Pradhan Mantri Jan Arogya Yojana (PM-JAY / Ayushman Bharat)",
    description : "Health insurance coverage of ₹5 lakh per family per year for secondary and tertiary care.",
    benefits    : "₹5 lakh health cover per family/year. Cashless treatment at 25,000+ empanelled hospitals.",
    maxAnnualIncome  : 200000,
    maxMonthlyIncome : 16667,
    minAge      : 0,
    targetGroup : "BPL families, informal workers, SECC database beneficiaries",
    targetGender: null,
    states      : [],
    requiredDocuments: ["aadhaar", "ration card"],
    applyUrl    : "https://pmjay.gov.in",
    ministry    : "Ministry of Health and Family Welfare",
    isActive    : true,
  },
  {
    PK          : "SCHEME#PMSYM",
    SK          : "METADATA",
    schemeId    : "PM-SYM",
    schemeName  : "PM Shram Yogi Maan-dhan (PM-SYM)",
    description : "Pension scheme for unorganised workers. ₹3,000/month pension after age 60.",
    benefits    : "₹3,000/month pension after 60. Contribution: ₹55–200/month depending on age.",
    maxMonthlyIncome : 15000,
    maxAnnualIncome  : 180000,
    minAge      : 18,
    maxAge      : 40,
    targetGroup : "Unorganised/informal workers, home-based workers, street vendors, construction workers",
    targetGender: null,
    states      : [],
    requiredDocuments: ["aadhaar", "bank account", "mobile number"],
    applyUrl    : "https://maandhan.in",
    ministry    : "Ministry of Labour and Employment",
    isActive    : true,
  },
  {
    PK          : "SCHEME#ESHRAM",
    SK          : "METADATA",
    schemeId    : "E-SHRAM",
    schemeName  : "e-Shram Card",
    description : "National database registration for unorganised workers. Provides access to all social security schemes.",
    benefits    : "₹2 lakh accident insurance. Priority access to all government welfare schemes. Free registration.",
    maxAnnualIncome  : 500000,
    maxMonthlyIncome : 41667,
    minAge      : 16,
    maxAge      : 59,
    targetGroup : "All unorganised/informal workers not covered by EPFO/ESIC",
    targetGender: null,
    states      : [],
    requiredDocuments: ["aadhaar", "bank account", "mobile number"],
    applyUrl    : "https://eshram.gov.in",
    ministry    : "Ministry of Labour and Employment",
    isActive    : true,
  },
  {
    PK          : "SCHEME#UJJWALA",
    SK          : "METADATA",
    schemeId    : "UJJWALA",
    schemeName  : "Pradhan Mantri Ujjwala Yojana (PMUY)",
    description : "Free LPG connection to women from BPL households to replace traditional chulha.",
    benefits    : "Free LPG connection. First refill and stove free. Clean cooking fuel access.",
    maxAnnualIncome  : 200000,
    maxMonthlyIncome : 16667,
    minAge      : 18,
    targetGroup : "Women from BPL families who do not have LPG connection",
    targetGender: "female",
    states      : [],
    requiredDocuments: ["aadhaar", "ration card", "BPL certificate"],
    applyUrl    : "https://pmuy.gov.in",
    ministry    : "Ministry of Petroleum and Natural Gas",
    isActive    : true,
  },
  {
    PK          : "SCHEME#PMSBY",
    SK          : "METADATA",
    schemeId    : "PMSBY",
    schemeName  : "Pradhan Mantri Suraksha Bima Yojana (PMSBY)",
    description : "Accidental death and disability insurance at just ₹20/year premium.",
    benefits    : "₹2 lakh for accidental death. ₹1 lakh for partial disability. Only ₹20/year premium.",
    maxAnnualIncome  : null,   // No income limit!
    maxMonthlyIncome : null,
    minAge      : 18,
    maxAge      : 70,
    targetGroup : "All Indian citizens with bank account and Aadhaar",
    targetGender: null,
    states      : [],
    requiredDocuments: ["aadhaar", "bank account"],
    applyUrl    : "https://jansuraksha.gov.in",
    ministry    : "Ministry of Finance",
    isActive    : true,
  },
];

// ── Seed all schemes ──────────────────────────────────────────────────────────
async function seedSchemes() {
  console.log(`Seeding ${schemes.length} schemes into ${TABLE}...`);

  for (const scheme of schemes) {
    try {
      await dynamo.send(new PutItemCommand({
        TableName: TABLE,
        Item     : marshall(scheme, { removeUndefinedValues: true }),
      }));
      console.log(`✅ Seeded: ${scheme.schemeName}`);
    } catch (err) {
      console.error(`❌ Failed: ${scheme.schemeName}`, err.message);
    }
  }

  console.log("\n🎉 All schemes seeded successfully!");
}

seedSchemes();
