"""
Extract text from already-downloaded PDFs and create structured JSON.
Runs on the 1500+ PDFs already present in scheme_pdfs/text_data/
"""
import json, os, re, sys

try:
    import PyPDF2
except ImportError:
    os.system(f'"{sys.executable}" -m pip install PyPDF2 --quiet')
    import PyPDF2

script_dir = os.path.dirname(os.path.abspath(__file__))
pdf_dir = os.path.join(script_dir, "scheme_pdfs", "text_data")

# Get all unique PDFs (skip copies)
pdf_files = []
for f in os.listdir(pdf_dir):
    if f.endswith('.pdf') and 'copy' not in f.lower():
        pdf_files.append(os.path.join(pdf_dir, f))

print(f"Found {len(pdf_files)} unique PDFs to process")

# Extract text from each PDF
schemes_raw = []
errors = 0
for i, pdf_path in enumerate(pdf_files):
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ""
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
        
        if not text.strip() or len(text.strip()) < 50:
            continue
        
        basename = os.path.splitext(os.path.basename(pdf_path))[0]
        scheme_id = basename.upper().replace(' ', '-').replace('(', '').replace(')', '')
        
        schemes_raw.append({
            "schemeId": scheme_id,
            "rawText": text.strip()
        })
    except Exception as e:
        errors += 1
    
    if (i+1) % 200 == 0:
        print(f"  Processed {i+1}/{len(pdf_files)} ({len(schemes_raw)} extracted, {errors} errors)")

print(f"\nExtracted text from {len(schemes_raw)} schemes ({errors} errors)")


def parse_scheme_text(raw_text, scheme_id):
    """Extract structured fields from scheme PDF text."""
    text = raw_text
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    name = lines[0][:200] if lines else scheme_id
    
    # Description
    desc_end = len(text)
    for marker in ['Eligibility', 'ELIGIBILITY', 'Who Can Apply', 'WHO CAN APPLY', 'Eligible']:
        idx = text.find(marker)
        if 0 < idx < desc_end:
            desc_end = idx
    description = text[:min(desc_end, 1000)].strip()
    
    # Eligibility
    eligibility = ""
    for sm in ['Eligibility', 'ELIGIBILITY', 'Who Can Apply', 'WHO CAN APPLY']:
        idx = text.find(sm)
        if idx >= 0:
            end_idx = len(text)
            for em in ['Benefits', 'BENEFITS', 'How To Apply', 'HOW TO APPLY', 'Application Process', 'Documents Required', 'DOCUMENTS']:
                eidx = text.find(em, idx + len(sm))
                if eidx > idx:
                    end_idx = min(end_idx, eidx)
            eligibility = text[idx:end_idx].strip()[:2000]
            break
    
    # Benefits
    benefits = ""
    for sm in ['Benefits', 'BENEFITS', 'Benefit Details']:
        idx = text.find(sm)
        if idx >= 0:
            end_idx = len(text)
            for em in ['How To Apply', 'HOW TO APPLY', 'Application Process', 'Documents Required', 'DOCUMENTS', 'Eligibility']:
                eidx = text.find(em, idx + len(sm))
                if eidx > idx:
                    end_idx = min(end_idx, eidx)
            benefits = text[idx:end_idx].strip()[:1500]
            break
    
    # Documents required
    documents = ""
    for sm in ['Documents Required', 'DOCUMENTS REQUIRED', 'Required Documents']:
        idx = text.find(sm)
        if idx >= 0:
            end_idx = min(len(text), idx + 1000)
            for em in ['How To Apply', 'HOW TO APPLY', 'Application Process', 'Benefits', 'Contact']:
                eidx = text.find(em, idx + len(sm))
                if eidx > idx:
                    end_idx = min(end_idx, eidx)
            documents = text[idx:end_idx].strip()
            break
    
    # Application process
    application = ""
    for sm in ['How To Apply', 'HOW TO APPLY', 'Application Process', 'APPLICATION PROCESS']:
        idx = text.find(sm)
        if idx >= 0:
            end_idx = min(len(text), idx + 1000)
            for em in ['Documents Required', 'DOCUMENTS', 'Contact', 'FAQs', 'Frequently Asked']:
                eidx = text.find(em, idx + len(sm))
                if eidx > idx:
                    end_idx = min(end_idx, eidx)
            application = text[idx:end_idx].strip()[:1000]
            break
    
    # Income threshold
    max_income = None
    for pat in [
        r'income.*?(?:less than|not exceed|up to|below|within|maximum|max)\s*(?:Rs\.?|₹|INR)?\s*([\d,]+)',
        r'(?:Rs\.?|₹|INR)\s*([\d,]+).*?(?:income|earning)',
        r'(?:annual|monthly|yearly)\s*income.*?(?:Rs\.?|₹|INR)?\s*([\d,]+)',
    ]:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            try:
                max_income = int(m.group(1).replace(',', ''))
            except:
                pass
            break
    if not max_income and re.search(r'BPL|Below Poverty Line', text, re.IGNORECASE):
        max_income = 100000
    
    # Age
    min_age = max_age = None
    for pat in [r'age.*?(\d{2})\s*(?:to|and|-)\s*(\d{2})', r'(?:above|minimum|at least)\s*(\d{2})\s*years', r'(\d{2})\s*years?\s*(?:of age|old|or above|and above)']:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            g = m.groups()
            min_age = int(g[0])
            if len(g) >= 2 and g[1]:
                max_age = int(g[1])
            break
    
    # Occupations
    occ_keywords = {
        'farmer': ['farmer', 'agriculture', 'kisan', 'farming', 'cultivator'],
        'worker': ['worker', 'labour', 'laborer', 'shramik', 'shram'],
        'artisan': ['artisan', 'craftsman', 'handicraft'],
        'vendor': ['vendor', 'street vendor', 'hawker', 'svanidhi'],
        'fisherman': ['fisherman', 'fisher', 'fisheries'],
        'student': ['student', 'education', 'scholarship'],
        'women': ['women', 'woman', 'girl', 'mahila', 'female'],
        'senior_citizen': ['senior citizen', 'old age', 'elderly', 'pension'],
        'disabled': ['disabled', 'disability', 'divyang', 'handicapped', 'pwd'],
        'self_employed': ['self-employed', 'self employed', 'entrepreneur', 'msme', 'micro enterprise'],
        'construction_worker': ['construction worker', 'building worker'],
        'domestic_worker': ['domestic worker', 'domestic help'],
        'driver': ['driver', 'auto driver', 'taxi'],
    }
    text_lower = text.lower()
    occupations = [occ for occ, kws in occ_keywords.items() if any(kw in text_lower for kw in kws)]
    
    # Categories
    categories = []
    if re.search(r'\bSC\b|Scheduled Caste', text, re.IGNORECASE): categories.append('SC')
    if re.search(r'\bST\b|Scheduled Tribe', text, re.IGNORECASE): categories.append('ST')
    if re.search(r'\bOBC\b|Other Backward Class', text, re.IGNORECASE): categories.append('OBC')
    if re.search(r'\bGeneral\b|All Categories|all categories', text, re.IGNORECASE): categories.append('General')
    if not categories: categories.append('General')
    
    # States
    indian_states = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
        'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
        'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
        'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
        'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
    ]
    states = [s for s in indian_states if s.lower() in text_lower]
    
    # Ministry
    ministry = ""
    mm = re.search(r'Ministry of\s+[\w\s&]+|Department of\s+[\w\s&]+', text)
    if mm: ministry = mm.group(0).strip()[:100]
    
    return {
        "schemeId": scheme_id,
        "name": name,
        "description": description[:1500],
        "eligibility": eligibility,
        "benefits": benefits,
        "documentsRequired": documents[:1000],
        "applicationProcess": application,
        "maxIncome": max_income,
        "minAge": min_age,
        "maxAge": max_age,
        "targetOccupations": occupations if occupations else ["all"],
        "targetCategories": categories,
        "targetStates": states if states else ["All India"],
        "ministry": ministry,
        "fullText": text[:4000],
    }

print("\nParsing into structured data...")
structured = []
for s in schemes_raw:
    parsed = parse_scheme_text(s["rawText"], s["schemeId"])
    structured.append(parsed)

# Save
out_path = os.path.join(script_dir, "schemes_structured.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(structured, f, ensure_ascii=False, indent=2)

print(f"\nSaved {len(structured)} schemes to {out_path}")
print(f"File size: {os.path.getsize(out_path) / (1024*1024):.1f} MB")

# Stats
has_income = sum(1 for s in structured if s["maxIncome"])
has_age = sum(1 for s in structured if s["minAge"])
has_elig = sum(1 for s in structured if s["eligibility"])
has_ben = sum(1 for s in structured if s["benefits"])
print(f"\nStats:")
print(f"  With income threshold: {has_income}")
print(f"  With age requirement: {has_age}")
print(f"  With eligibility section: {has_elig}")
print(f"  With benefits section: {has_ben}")

print(f"\nFirst 10 schemes:")
for s in structured[:10]:
    print(f"  [{s['schemeId']}] {s['name'][:80]}")
