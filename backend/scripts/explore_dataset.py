"""Explore the shrijayan/gov_myscheme HuggingFace repo structure."""
from huggingface_hub import list_repo_files, hf_hub_download
import json
import os

repo_id = "shrijayan/gov_myscheme"
print(f"Listing files in {repo_id}...")

files = list_repo_files(repo_id, repo_type="dataset")
for f in files:
    print(f"  {f}")

# Download any CSV, JSON, or Parquet files
output_dir = os.path.dirname(__file__)
for f in files:
    if f.endswith(('.csv', '.json', '.jsonl', '.parquet', '.tsv')):
        print(f"\nDownloading {f}...")
        path = hf_hub_download(repo_id, f, repo_type="dataset", local_dir=output_dir)
        print(f"  Saved to: {path}")
        
        # Preview content
        if f.endswith('.json') or f.endswith('.jsonl'):
            with open(path, encoding='utf-8') as fh:
                content = fh.read()[:2000]
                print(f"  Preview: {content}")
        elif f.endswith('.csv'):
            import csv
            with open(path, encoding='utf-8') as fh:
                reader = csv.reader(fh)
                for i, row in enumerate(reader):
                    if i > 3: break
                    print(f"  Row {i}: {row[:5]}...")
