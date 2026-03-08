"""
Download all PDFs from shrijayan/gov_myscheme, extract text, and create structured JSON.
"""
import json, os, re, sys
from huggingface_hub import list_repo_files, hf_hub_download

repo_id = "shrijayan/gov_myscheme"
output_dir = os.path.dirname(os.path.abspath(__file__))

# Step 1: List all unique PDF files (skip duplicates with "copy" in name)
print("Listing files...")
all_files = list_repo_files(repo_id, repo_type="dataset")
pdf_files = [f for f in all_files if f.endswith('.pdf') and 'copy' not in f.lower()]
print(f"Found {len(pdf_files)} unique PDF scheme files (excluded copies)")

# Step 2: Download all PDFs to a temp dir
download_dir = os.path.join(output_dir, "scheme_pdfs")
os.makedirs(download_dir, exist_ok=True)

print(f"\nDownloading PDFs to {download_dir}...")
downloaded = []
for i, pdf_file in enumerate(pdf_files):
    try:
        path = hf_hub_download(repo_id, pdf_file, repo_type="dataset", local_dir=download_dir)
        downloaded.append((pdf_file, path))
        if (i+1) % 50 == 0:
            print(f"  Downloaded {i+1}/{len(pdf_files)}")
    except Exception as e:
        print(f"  SKIP {pdf_file}: {e}")

print(f"Downloaded {len(downloaded)} PDFs")

# Step 3: Extract text from each PDF using PyPDF2
try:
    import PyPDF2
except ImportError:
    os.system(f'"{sys.executable}" -m pip install PyPDF2 --quiet')
    import PyPDF2

print("\nExtracting text from PDFs...")
schemes = []
for pdf_file, local_path in downloaded:
    try:
        with open(local_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
        
        if not text.strip():
            continue
        
        # Derive scheme ID from filename
        basename = os.path.splitext(os.path.basename(pdf_file))[0]
        scheme_id = basename.upper().replace(' ', '-').replace('(', '').replace(')', '')
        
        schemes.append({
            "schemeId": scheme_id,
            "sourceFile": pdf_file,
            "rawText": text.strip()
        })
    except Exception as e:
        print(f"  ERROR extracting {pdf_file}: {e}")

print(f"Extracted text from {len(schemes)} schemes")

# Step 4: Save raw extracted text
raw_path = os.path.join(output_dir, "schemes_raw_text.json")
with open(raw_path, "w", encoding="utf-8") as f:
    json.dump(schemes, f, ensure_ascii=False, indent=2)
print(f"\nSaved raw text to {raw_path}")

# Step 5: Parse each scheme text into structured data
def parse_scheme_text(raw_text, scheme_id):
    """Extract structured fields from scheme PDF text."""
    text = raw_text
    
    # Try to extract scheme name (usually first line or first substantial text)
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    name = lines[0] if lines else scheme_id
    # Clean up name - remove page numbers, URLs
    if len(name) > 200:
        name = name[:200]
    
    # Extract description (first ~500 chars or until "Eligibility" section)
    desc_end = len(text)
    for marker in ['Eligibility', 'ELIGIBILITY', 'Who Can Apply', 'WHO CAN APPLY', 'Eligible']:
        idx = text.find(marker)
        if idx > 0:
            desc_end = min(desc_end, idx)
    description = text[:min(desc_end, 1000)].strip()
    
    # Extract eligibility section
    eligibility = ""
    for start_marker in ['Eligibility', 'ELIGIBILITY', 'Who Can Apply', 'WHO CAN APPLY']:
        idx = text.find(start_marker)
        if idx >= 0:
            end_idx = len(text)
            for end_marker in ['Benefits', 'BENEFITS', 'How To Apply', 'HOW TO APPLY', 'Application Process', 'Documents Required', 'DOCUMENTS']:
                eidx = text.find(end_marker, idx + len(start_marker))
                if eidx > idx:
                    end_idx = min(end_idx, eidx)
            eligibility = text[idx:end_idx].strip()
            break
    
    # Extract benefits section
    benefits = ""
    for start_marker in ['Benefits', 'BENEFITS', 'Benefit Details']:
        idx = text.find(start_marker)
        if idx >= 0:
            end_idx = len(text)
            for end_marker in ['How To Apply', 'HOW TO APPLY', 'Application Process', 'Documents Required', 'DOCUMENTS', 'Eligibility']:
                eidx = text.find(end_marker, idx + len(start_marker))
                if eidx > idx:
                    end_idx = min(end_idx, eidx)
            benefits = text[idx:end_idx].strip()
            break
    
    # Extract documents required
    documents = ""
    for start_marker in ['Documents Required', 'DOCUMENTS REQUIRED', 'Required Documents']:
        idx = text.find(start_marker)
        if idx >= 0:
            end_idx = min(len(text), idx + 1000)
            for end_marker in ['How To Apply', 'HOW TO APPLY', 'Application Process', 'Benefits', 'Contact']:
                eidx = text.find(end_marker, idx + len(start_marker))
                if eidx > idx:
                    end_idx = min(end_idx, eidx)
            documents = text[idx:end_idx].strip()
            break
    
    # Extract application process
    application = ""
    for start_marker in ['How To Apply', 'HOW TO APPLY', 'Application Process', 'APPLICATION PROCESS']:
        idx = text.find(start_marker)
        if idx >= 0:
            end_idx = min(len(text), idx + 1000)
            for end_marker in ['Documents Required', 'DOCUMENTS', 'Contact', 'FAQs', 'Frequently Asked']:
                eidx = text.find(end_marker, idx + len(start_marker))
                if eidx > idx:
                    end_idx = min(end_idx, eidx)
            application = text[idx:end_idx].strip()
            break
    
    # Try to detect income thresholds from text
    max_income = None
    income_patterns = [
        r'income.*?(?:less than|not exceed|up to|below|within|maximum|max)\s*(?:Rs\.?|₹|INR)?\s*([\d,]+)',
        r'(?:Rs\.?|₹|INR)\s*([\d,]+).*?(?:income|earning)',
        r'(?:annual|monthly|yearly)\s*income.*?(?:Rs\.?|₹|INR)?\s*([\d,]+)',
        r'BPL|Below Poverty Line',
    ]
    for pattern in income_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            if 'BPL' in pattern:
                max_income = 100000  # Approximate BPL threshold
            else:
                try:
                    max_income = int(match.group(1).replace(',', ''))
                except:
                    pass
            break
    
    # Detect age requirements
    min_age = None
    max_age = None
    age_patterns = [
        r'age.*?(\d{2})\s*(?:to|and|-)\s*(\d{2})',
        r'(?:above|minimum|at least|min)\s*(\d{2})\s*years',
        r'(\d{2})\s*years?\s*(?:of age|old|or above|and above)',
    ]
    for pattern in age_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            groups = match.groups()
            if len(groups) >= 2 and groups[1]:
                min_age = int(groups[0])
                max_age = int(groups[1])
            else:
                min_age = int(groups[0])
            break
    
    # Detect target occupations/categories
    occupations = []
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
    for occ, keywords in occ_keywords.items():
        if any(kw in text_lower for kw in keywords):
            occupations.append(occ)
    
    # Detect category (SC/ST/OBC/General)
    categories = []
    if re.search(r'\bSC\b|Scheduled Caste', text, re.IGNORECASE):
        categories.append('SC')
    if re.search(r'\bST\b|Scheduled Tribe', text, re.IGNORECASE):
        categories.append('ST')
    if re.search(r'\bOBC\b|Other Backward Class', text, re.IGNORECASE):
        categories.append('OBC')
    if re.search(r'\bGeneral\b|All Categories|all categories', text, re.IGNORECASE):
        categories.append('General')
    if not categories:
        categories.append('General')  # Default: open to all
    
    # Detect state specificity
    states = []
    indian_states = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
        'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
        'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
        'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
        'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
    ]
    for state in indian_states:
        if state.lower() in text_lower:
            states.append(state)
    
    # Detect ministry/department
    ministry = ""
    ministry_match = re.search(r'Ministry of\s+[\w\s&]+|Department of\s+[\w\s&]+', text)
    if ministry_match:
        ministry = ministry_match.group(0).strip()
    
    return {
        "schemeId": scheme_id,
        "name": name,
        "description": description[:1500],
        "eligibility": eligibility[:2000],
        "benefits": benefits[:1500],
        "documentsRequired": documents[:1000],
        "applicationProcess": application[:1000],
        "maxIncome": max_income,
        "minAge": min_age,
        "maxAge": max_age,
        "targetOccupations": occupations if occupations else ["all"],
        "targetCategories": categories,
        "targetStates": states if states else ["All India"],
        "ministry": ministry,
        "fullText": text[:5000],  # Keep first 5000 chars for AI context
    }

print("\nParsing scheme text into structured data...")
structured_schemes = []
for scheme in schemes:
    parsed = parse_scheme_text(scheme["rawText"], scheme["schemeId"])
    parsed["sourceFile"] = scheme["sourceFile"]
    structured_schemes.append(parsed)

# Save structured data
structured_path = os.path.join(output_dir, "schemes_structured.json")
with open(structured_path, "w", encoding="utf-8") as f:
    json.dump(structured_schemes, f, ensure_ascii=False, indent=2)

print(f"\nDone! {len(structured_schemes)} schemes parsed and saved to {structured_path}")

# Print stats
has_income = sum(1 for s in structured_schemes if s["maxIncome"])
has_age = sum(1 for s in structured_schemes if s["minAge"])
has_eligibility = sum(1 for s in structured_schemes if s["eligibility"])
has_benefits = sum(1 for s in structured_schemes if s["benefits"])
print(f"\nStats:")
print(f"  With income threshold: {has_income}")
print(f"  With age requirement: {has_age}")
print(f"  With eligibility section: {has_eligibility}")
print(f"  With benefits section: {has_benefits}")
print(f"  States represented: {len(set(s for sch in structured_schemes for s in sch['targetStates']))}")

# Print first 5 scheme names
print(f"\nFirst 10 schemes:")
for s in structured_schemes[:10]:
    print(f"  [{s['schemeId']}] {s['name'][:80]}")
