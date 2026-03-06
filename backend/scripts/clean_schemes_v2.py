"""
Properly clean and parse myScheme PDF text. The PDFs are web-to-PDF exports from
myscheme.gov.in with tab/space-separated words and navigation UI artifacts.

Key insight from raw text inspection:
- Text format: "SchemeNameAre\tyou\tsure\tyou\twant\tto\tsign\tout?..."
- Nav menu: "DetailsBenefitsEligibilityApplication\tProcessDocuments\tRequired..."
- Tags area: "StateNameSchemeNameTag1Tag2Tag3"
- Content starts at "Details" keyword
- Sections concatenated without newlines: "...children.Benefitsâ‚¹1200..."
"""
import json, os, re

script_dir = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(script_dir, "schemes_structured.json"), encoding="utf-8") as f:
    raw_schemes = json.load(f)

print(f"Loaded {len(raw_schemes)} raw schemes")

def parse_scheme(raw_text):
    """Parse a raw myScheme PDF text into structured sections."""
    if not raw_text or len(raw_text) < 100:
        return None
    
    # Step 1: Normalize tabs to spaces
    text = raw_text.replace('\t', ' ')
    # Collapse multiple spaces
    text = re.sub(r' {2,}', ' ', text)
    
    # Step 2: Extract scheme name (everything before "Are you sure")
    name = ''
    m = re.search(r'^(.+?)(?:Are you sure you want to sign out)', text)
    if m:
        name = m.group(1).strip()
    else:
        # Fallback: first line
        name = text.split('\n')[0].strip()[:100]
    
    # Step 3: Find where the actual content starts (after "Details" section header)
    # The nav menu + modals + tags area comes first, then "Details" keyword starts content
    # Pattern: "...DetailsThe scheme..." or "...DetailsObjective..."
    content_start = 0
    # Find "Details" that's followed by actual content (not followed by "Benefits")
    details_matches = list(re.finditer(r'Details', text))
    for dm in details_matches:
        pos = dm.end()
        # Check this isn't the nav "DetailsBenefits..." 
        next_bit = text[pos:pos+20]
        if not next_bit.startswith('Benefits') and not next_bit.startswith('Benefit'):
            content_start = pos
            break
    
    if content_start == 0:
        # No "Details" section found, try to skip artifacts
        # Skip to after the nav menu + modals block
        skip_patterns = [
            r'FeedbackSomething',
            r'Feedback',
            r'Sources And References',
            r'Frequently Asked Questions',
        ]
        for sp in skip_patterns:
            m = re.search(sp, text)
            if m:
                # Look for scheme name repeat after this
                content_start = m.end()
                break
    
    content = text[content_start:]
    
    # Step 4: Split content into sections
    # Section headers appear concatenated: "...word.BenefitsContent..." or "...word.EligibilityThe..."
    section_pattern = r'(?:^|(?<=\.)|\b)(Benefits|Eligibility|Exclusions?|Application Process|Documents? Required|Frequently Asked Questions?|Sources? And References?|Feedback)(?=[A-Z\d₹â‚¹\*\.]|\s)'
    
    sections = {
        'description': '',
        'benefits': '',
        'eligibility': '',
        'exclusions': '',
        'applicationProcess': '',
        'documentsRequired': '',
    }
    
    # Find all section positions
    sec_positions = []
    for m in re.finditer(section_pattern, content, re.IGNORECASE):
        header = m.group(1).strip().lower()
        if 'benefit' in header: key = 'benefits'
        elif 'eligib' in header: key = 'eligibility'
        elif 'exclus' in header: key = 'exclusions'
        elif 'application' in header: key = 'applicationProcess'
        elif 'document' in header: key = 'documentsRequired'
        elif 'frequently' in header: key = 'faqs'
        elif 'source' in header: key = 'sources'
        elif 'feedback' in header: key = 'feedback'
        else: continue
        sec_positions.append((m.start(), m.end(), key))
    
    if sec_positions:
        # Description = content before first section
        sections['description'] = content[:sec_positions[0][0]].strip()
        
        for i, (start, end, key) in enumerate(sec_positions):
            if key in ('faqs', 'sources', 'feedback'):
                continue  # Skip these sections
            next_start = sec_positions[i+1][0] if i+1 < len(sec_positions) else len(content)
            sections[key] = content[end:next_start].strip()
    else:
        sections['description'] = content.strip()
    
    # Step 5: Extract ministry from the tag area (between nav and content)
    tag_area = text[:content_start] if content_start > 0 else ''
    ministry = ''
    m = re.search(r'(Ministry\s+of\s+[A-Za-z &]+|Department\s+of\s+[A-Za-z &]+)', tag_area, re.IGNORECASE)
    if m:
        ministry = m.group(1).strip()
    if not ministry:
        m = re.search(r'(Ministry\s+of\s+[A-Za-z &]+|Department\s+of\s+[A-Za-z &]+)', content[:500], re.IGNORECASE)
        if m:
            ministry = m.group(1).strip()
    
    # Clean up section content - remove trailing nav/artifact remnants
    for key in sections:
        s = sections[key]
        # Remove common trailing artifacts
        s = re.sub(r'(?:Sources? And References?|Feedback).*$', '', s, flags=re.DOTALL)
        s = re.sub(r'Frequently Asked Questions?.*$', '', s, flags=re.DOTALL)
        # Clean newlines
        s = re.sub(r'\n{2,}', '\n', s)
        sections[key] = s.strip()
    
    return {
        'name': name,
        'ministry': ministry,
        'description': sections['description'],
        'benefits': sections['benefits'],
        'eligibility': sections['eligibility'],
        'exclusions': sections['exclusions'],
        'applicationProcess': sections['applicationProcess'],
        'documentsRequired': sections['documentsRequired'],
    }

def extract_income(text):
    """Try to find income threshold from text."""
    patterns = [
        r'(?:annual|yearly)\s+(?:family\s+)?income\s+(?:is\s+)?(?:less\s+than|not\s+exceed(?:ing)?|up\s+to|below|within|maximum|max|upto)\s*(?:Rs\.?|â‚¹|INR|Rs)?\s*\.?\s*([\d,]+(?:\.\d+)?)',
        r'(?:income|earning)s?\s+(?:should\s+)?(?:not\s+exceed|less\s+than|up\s+to|below|maximum)\s*(?:Rs\.?|â‚¹|INR|Rs)?\s*\.?\s*([\d,]+(?:\.\d+)?)',
        r'(?:Rs\.?|â‚¹|INR)\s*([\d,]+(?:\.\d+)?)\s*(?:per\s+annum|annually|yearly|p\.?\s*a\.?)',
        r'(?:monthly\s+income)\s*(?:Rs\.?|â‚¹|INR)?\s*([\d,]+(?:\.\d+)?)',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            try:
                val = int(m.group(1).replace(',', '').split('.')[0])
                if val > 100:  # Filter out garbage like ₹1 or ₹5
                    return val
            except:
                pass
    if re.search(r'\bBPL\b|Below\s+Poverty\s+Line', text, re.IGNORECASE):
        return 100000
    return None

def extract_age(text):
    """Extract age requirements."""
    min_age = max_age = None
    patterns = [
        (r'(?:age|aged)\s+(?:between\s+)?(\d{2})\s*(?:to|and|-|–)\s*(\d{2})', 'range'),
        (r'(\d{2})\s*(?:to|and|-|–)\s*(\d{2})\s*years', 'range'),
        (r'(?:above|minimum|at\s+least|not\s+less\s+than)\s*(\d{2})\s*years', 'min'),
        (r'(\d{2})\s*years?\s*(?:of\s+age|old)?\s*(?:or\s+above|and\s+above|\+)', 'min'),
        (r'(?:below|under|not\s+more\s+than|maximum)\s*(\d{2})\s*years', 'max'),
    ]
    for pat, kind in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            if kind == 'range':
                min_age = int(m.group(1))
                max_age = int(m.group(2))
            elif kind == 'min':
                min_age = int(m.group(1))
            elif kind == 'max':
                max_age = int(m.group(1))
            break
    return min_age, max_age

# Process all schemes
cleaned = []
seen_names = set()

for s in raw_schemes:
    raw_text = s.get('fullText') or s.get('rawText', '')
    if not raw_text or len(raw_text) < 100:
        continue
    
    parsed = parse_scheme(raw_text)
    if not parsed:
        continue
    
    name = parsed['name']
    if not name or len(name) < 3 or name.lower() in seen_names:
        continue
    seen_names.add(name.lower())
    
    # Normalize tabs in full text for searches
    text = raw_text.replace('\t', ' ')
    text = re.sub(r' {2,}', ' ', text)
    
    max_income = extract_income(text)
    min_age, max_age = extract_age(text)
    
    # Detect occupations
    occ_map = {
        'farmer': ['farmer', 'agriculture', 'kisan', 'farming', 'cultivator', 'crop'],
        'worker': ['worker', 'labour', 'laborer', 'shramik', 'shram', 'unorganized', 'informal'],
        'artisan': ['artisan', 'craftsman', 'handicraft', 'handloom', 'weaver'],
        'vendor': ['vendor', 'street vendor', 'hawker', 'svanidhi'],
        'fisherman': ['fisherman', 'fisher', 'fisheries', 'matsya'],
        'student': ['student', 'education', 'scholarship', 'college', 'school'],
        'women': ['women', 'woman', 'girl', 'mahila', 'female', 'widow', 'pregnant'],
        'senior_citizen': ['senior citizen', 'old age', 'elderly', 'pension'],
        'disabled': ['disabled', 'disability', 'divyang', 'handicapped', 'pwd'],
        'self_employed': ['self-employed', 'self employed', 'entrepreneur', 'msme', 'micro enterprise', 'startup'],
        'construction_worker': ['construction worker', 'building worker', 'bocw'],
        'driver': ['driver', 'auto driver', 'taxi'],
    }
    tl = text.lower()
    occupations = [occ for occ, kws in occ_map.items() if any(kw in tl for kw in kws)]
    
    # Categories
    categories = []
    if re.search(r'\bSC\b|Scheduled\s+Caste', text): categories.append('SC')
    if re.search(r'\bST\b|Scheduled\s+Tribe', text): categories.append('ST')
    if re.search(r'\bOBC\b|Other\s+Backward', text, re.IGNORECASE): categories.append('OBC')
    if not categories: categories.append('General')
    
    # States
    states_list = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
        'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
        'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
        'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
        'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
    ]
    detected_states = [st for st in states_list if st.lower() in tl]
    # If "Central Government" or no specific state mentioned, mark All India
    if re.search(r'Central\s+Government|Government\s+of\s+India', text, re.IGNORECASE) and not detected_states:
        detected_states = ['All India']
    if not detected_states:
        detected_states = ['All India']
    
    cleaned.append({
        "schemeId": s['schemeId'],
        "name": name[:200],
        "description": parsed['description'][:1500] or text[:500],
        "eligibility": parsed['eligibility'][:2000],
        "benefits": parsed['benefits'][:1500],
        "documentsRequired": parsed['documentsRequired'][:1000],
        "applicationProcess": parsed['applicationProcess'][:1000],
        "exclusions": parsed['exclusions'][:500],
        "maxIncome": max_income,
        "minAge": min_age,
        "maxAge": max_age,
        "targetOccupations": occupations if occupations else ["all"],
        "targetCategories": categories,
        "targetStates": detected_states,
        "ministry": parsed['ministry'][:150],
        "fullText": text[:4000],
    })

print(f"\nCleaned: {len(cleaned)} schemes")

# Save
out_path = os.path.join(script_dir, "schemes_clean.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(cleaned, f, ensure_ascii=False, indent=2)
print(f"Saved to {out_path} ({os.path.getsize(out_path) / (1024*1024):.1f} MB)")

# Stats
print(f"\nStats:")
print(f"  Total: {len(cleaned)}")
print(f"  With income threshold: {sum(1 for s in cleaned if s['maxIncome'])}")
print(f"  With age requirement: {sum(1 for s in cleaned if s['minAge'])}")
print(f"  With eligibility text: {sum(1 for s in cleaned if len(s['eligibility']) > 20)}")
print(f"  With benefits text: {sum(1 for s in cleaned if len(s['benefits']) > 20)}")
print(f"  With docs required: {sum(1 for s in cleaned if len(s['documentsRequired']) > 10)}")
print(f"  All India: {sum(1 for s in cleaned if 'All India' in s['targetStates'])}")
print(f"  State-specific: {sum(1 for s in cleaned if 'All India' not in s['targetStates'])}")

# Sample
print(f"\nSample schemes:")
for s in cleaned[:15]:
    inc = f" (max ₹{s['maxIncome']:,})" if s['maxIncome'] else ""
    occ = f" [{','.join(s['targetOccupations'][:3])}]" if s['targetOccupations'] != ['all'] else ""
    st = f" ({s['targetStates'][0]})" if s['targetStates'] != ['All India'] else " (All India)"
    print(f"  {s['name'][:60]}{inc}{occ}{st}")
