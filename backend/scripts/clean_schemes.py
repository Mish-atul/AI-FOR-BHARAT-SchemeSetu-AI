"""
Clean scheme data and generate a Node.js seed script for DynamoDB.
Removes web artifacts, normalizes names, and creates seed-schemes.js
"""
import json, os, re

script_dir = os.path.dirname(os.path.abspath(__file__))
input_path = os.path.join(script_dir, "schemes_structured.json")

with open(input_path, encoding="utf-8") as f:
    schemes = json.load(f)

print(f"Loaded {len(schemes)} raw schemes")

# Web artifacts to remove from all text fields
ARTIFACTS = [
    r'Are\s+you\s+sure\s+you\s+want\s+to\s+sign\s+out\?CancelSign\s+Out',
    r'Are\s+you\s+sure\s+you\s+want\s+to\s+sign\s+out\?',
    r'CancelSign\s+Out',
    r'EngEnglish/?',
    r'à¤¹à¤¿à¤‚à¤¦à¥€Hindi',
    r'à¤¹à¤¿à¤‚à¤¦à¥€',
    r'à¤¹à¤¿à¤‚à[\w\s]*',
    r'Sign\s+Out',
    r'English/Hindi',
    r'\bEnglish\b(?=/)',
    r'Details\s*Benefits\s*Eligibility\s*Application Process\s*Documents Required\s*Video\s*FAQs',
    r'Details\s*Benefits\s*Eligibility\s*Application\s*Process',
    r'Print\s*Share\s*',
    r'Translate\s*with\s*Google',
    r'(?:Was this helpful\?)?\s*(?:Thank you for your feedback)?',
    r'(?:Back|Home)\s*>\s*',
    r'SIGN\s+IN\s+WITH\s+MOBILE',
    r'(?:State|Central)\s+Government\s+›',
]

def clean_text(text):
    if not text:
        return ""
    for pattern in ARTIFACTS:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    # Collapse excessive whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def clean_name(name):
    """Extract clean scheme name from first line."""
    name = clean_text(name)
    # Remove trailing noise
    name = re.sub(r'\s*(Eng|Hindi|Details|Benefits|Eligibility).*$', '', name, flags=re.IGNORECASE)
    # Keep only first meaningful line
    first_line = name.split('\n')[0].strip()
    if len(first_line) > 5:
        name = first_line
    # Remove leading numbers/bullets
    name = re.sub(r'^[\d\.\-\*\•]+\s*', '', name)
    return name[:200].strip()

# Clean all schemes
cleaned = []
seen_ids = set()
for s in schemes:
    sid = s["schemeId"]
    # Skip duplicates
    if sid in seen_ids:
        continue
    seen_ids.add(sid)
    
    name = clean_name(s["name"])
    if not name or len(name) < 3:
        continue
    
    description = clean_text(s["description"])
    eligibility = clean_text(s["eligibility"])
    benefits = clean_text(s["benefits"])
    
    # Skip schemes with very little extractable content
    if len(description) < 20 and len(eligibility) < 20:
        continue
    
    cleaned.append({
        "schemeId": sid,
        "name": name,
        "description": description[:1500],
        "eligibility": eligibility[:2000],
        "benefits": benefits[:1500],
        "documentsRequired": clean_text(s.get("documentsRequired", ""))[:1000],
        "applicationProcess": clean_text(s.get("applicationProcess", ""))[:1000],
        "maxIncome": s.get("maxIncome"),
        "minAge": s.get("minAge"),
        "maxAge": s.get("maxAge"),
        "targetOccupations": s.get("targetOccupations", ["all"]),
        "targetCategories": s.get("targetCategories", ["General"]),
        "targetStates": s.get("targetStates", ["All India"]),
        "ministry": clean_text(s.get("ministry", "")),
        "fullText": clean_text(s.get("fullText", ""))[:4000],
    })

print(f"Cleaned: {len(cleaned)} schemes (removed {len(schemes) - len(cleaned)} invalid/duplicate)")

# Save cleaned JSON
clean_path = os.path.join(script_dir, "schemes_clean.json")
with open(clean_path, "w", encoding="utf-8") as f:
    json.dump(cleaned, f, ensure_ascii=False, indent=2)
print(f"Saved clean data to {clean_path} ({os.path.getsize(clean_path) / (1024*1024):.1f} MB)")

# Print some samples
print(f"\nSample cleaned scheme names:")
for s in cleaned[:15]:
    income = f" (max income: ₹{s['maxIncome']:,})" if s['maxIncome'] else ""
    occ = f" [{','.join(s['targetOccupations'][:3])}]" if s['targetOccupations'] != ['all'] else ""
    print(f"  {s['schemeId']}: {s['name'][:70]}{income}{occ}")

# Stats
print(f"\nFinal stats:")
print(f"  Total schemes: {len(cleaned)}")
print(f"  With income threshold: {sum(1 for s in cleaned if s['maxIncome'])}")
print(f"  With age requirement: {sum(1 for s in cleaned if s['minAge'])}")
print(f"  With eligibility text: {sum(1 for s in cleaned if len(s['eligibility']) > 20)}")
print(f"  With benefits text: {sum(1 for s in cleaned if len(s['benefits']) > 20)}")
print(f"  With docs required: {sum(1 for s in cleaned if len(s['documentsRequired']) > 10)}")
print(f"  State-specific: {sum(1 for s in cleaned if s['targetStates'] != ['All India'])}")
print(f"  Central/All India: {sum(1 for s in cleaned if s['targetStates'] == ['All India'])}")
