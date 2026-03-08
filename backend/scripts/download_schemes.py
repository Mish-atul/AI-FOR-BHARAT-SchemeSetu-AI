"""Download shrijayan/gov_myscheme from Hugging Face and save as JSON for seeding DynamoDB."""
import json
import os
from datasets import load_dataset

print("Downloading shrijayan/gov_myscheme from Hugging Face...")
ds = load_dataset("shrijayan/gov_myscheme")

# Check available splits
print(f"Available splits: {list(ds.keys())}")
for split_name in ds:
    print(f"  {split_name}: {len(ds[split_name])} rows")
    print(f"  Columns: {ds[split_name].column_names}")

# Use the first available split (usually 'train')
split = list(ds.keys())[0]
data = ds[split]

# Convert to list of dicts
schemes = []
for i, row in enumerate(data):
    scheme = {}
    for col in data.column_names:
        val = row[col]
        if val is not None:
            scheme[col] = val
    schemes.append(scheme)

# Save to JSON
output_path = os.path.join(os.path.dirname(__file__), "myscheme_data.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(schemes, f, ensure_ascii=False, indent=2)

print(f"\nSaved {len(schemes)} schemes to {output_path}")

# Print first scheme to understand structure
print("\n--- Sample scheme (first entry) ---")
sample = schemes[0]
for key, val in sample.items():
    preview = str(val)[:200] if val else "(empty)"
    print(f"  {key}: {preview}")

# Print a few more scheme names
print(f"\n--- First 10 scheme names ---")
name_col = None
for col in data.column_names:
    if 'name' in col.lower() or 'title' in col.lower() or 'scheme' in col.lower():
        name_col = col
        break
if name_col:
    for s in schemes[:10]:
        print(f"  - {s.get(name_col, 'N/A')}")
else:
    print(f"  Columns available: {data.column_names}")
