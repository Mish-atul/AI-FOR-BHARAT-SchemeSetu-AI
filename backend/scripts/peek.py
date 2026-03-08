import json

with open('schemes_structured.json', encoding='utf-8') as f:
    data = json.load(f)

# Find PM-KISAN
for s in data:
    sid = s['schemeId'].lower()
    if 'pm-kisan' in sid or 'pmay' in sid or 'kisan' in sid:
        print(f"=== {s['schemeId']} ===")
        print(s['fullText'][:3000])
        break
else:
    # Show first scheme
    print(f"=== {data[0]['schemeId']} ===")
    print(data[0]['fullText'][:3000])
