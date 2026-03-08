"""Peek at raw text to understand the artifact pattern."""
import json, os
script_dir = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(script_dir, "schemes_structured.json"), encoding="utf-8") as f:
    raw = json.load(f)

# Find a scheme with the artifact
for s in raw:
    if 'ARAVANAIPPU' in (s.get('name') or ''):
        text = s.get('fullText') or s.get('rawText', '')
        # Print first 2000 chars with repr to see whitespace
        print("=== RAW TEXT (first 2000) ===")
        print(repr(text[:2000]))
        print("\n=== CLEANED TEXT (first 2000) ===")
        print(text[:2000])
        break

# Also look at the second scheme
for s in raw:
    if 'Capital Investment Subsidy' in (s.get('name') or ''):
        text = s.get('fullText') or s.get('rawText', '')
        print("\n\n=== 25% Capital Investment (first 1500) ===")
        print(repr(text[:1500]))
        break
