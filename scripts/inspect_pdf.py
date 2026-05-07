"""Inspect the Advanced Energy 2026 catalogue PDF to understand its structure."""
import sys
import io
from pathlib import Path
import pdfplumber

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

PDF = Path(__file__).resolve().parent.parent / "docs" / "AE Catalogue2026.pdf"

def main():
    with pdfplumber.open(PDF) as pdf:
        print(f"Total pages: {len(pdf.pages)}")
        print(f"Metadata: {pdf.metadata}")
        print("-" * 80)
        # Print first 6 pages text to find ToC
        for i in range(min(10, len(pdf.pages))):
            page = pdf.pages[i]
            text = page.extract_text() or ""
            print(f"=== PAGE {i+1} (w={page.width:.0f} h={page.height:.0f}) ===")
            print(text[:2000])
            print()

if __name__ == "__main__":
    main()
