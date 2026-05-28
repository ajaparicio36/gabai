"""
BIR Zonal Values Pipeline for GAVAI
Extracts street/subdivision-level zonal values from BIR RDO PDFs.
Outputs JSON files per RDO for import into the ZonalValue table.
"""

import pdfplumber
import re
import json
import urllib.request
from pathlib import Path

RDO_FILES = {
    "cebu_city_north": "https://bir-cdn.bir.gov.ph/BIR/pdf/RDO%2081.pdf",
    "cebu_city_south": "https://bir-cdn.bir.gov.ph/BIR/pdf/RDO%2082%20(1).pdf",
}

ZONAL_ROW_RE = re.compile(
    r"ZONAL\s+VALUE\s*/\s*SQ\.?\s*M\.?\s+([\d,]+\.?\d*)", re.IGNORECASE
)
MONEY_CLEAN = re.compile(r"[^\d.]")

SUBD_KEYWORDS = [
    "SUBD",
    "SUBDIVISION",
    "VILLAGE",
    "HOMES",
    "HEIGHTS",
    "ESTATE",
    "PARK",
    "RESIDENCES",
    "CONDOMINIUM",
    "TOWNHOUSE",
]


def download_pdf(url: str, dest: str) -> None:
    print(f"Downloading {url}...")
    urllib.request.urlretrieve(url, dest)
    print(f"Saved to {dest}")


def is_city_header(line: str) -> bool:
    return (
        line.isupper()
        and len(line) > 4
        and "ZONAL" not in line
        and "BARANGAY" not in line
        and "BRGY" not in line
        and not re.search(r"\d", line)
    )


def is_barangay_header(line: str) -> bool:
    keywords = ["BARANGAY", "BRGY", "BGY"]
    return any(kw in line.upper() for kw in keywords) and "ZONAL" not in line


def classify_zone(name: str) -> str:
    return "subdivision" if any(k in name.upper() for k in SUBD_KEYWORDS) else "street"


def norm(s: str) -> str:
    return s.strip().upper().replace("  ", " ")


def parse_rdo_pdf(pdf_path: str) -> list[dict]:
    records = []
    current_city = None
    current_barangay = None

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            lines = text.split("\n")

            for line in lines:
                line = line.strip()
                if not line:
                    continue

                if is_city_header(line):
                    current_city = norm(line)
                    continue

                if is_barangay_header(line):
                    current_barangay = norm(line)
                    continue

                match = ZONAL_ROW_RE.search(line)
                if match and current_barangay:
                    street_or_subd = line[: match.start()].strip()
                    php_value = float(MONEY_CLEAN.sub("", match.group(1)))
                    records.append(
                        {
                            "city": current_city,
                            "barangay": current_barangay,
                            "streetOrSubd": street_or_subd,
                            "zoneType": classify_zone(street_or_subd),
                            "zonalValuePhp": php_value,
                            "rdoSource": Path(pdf_path).stem,
                        }
                    )

    return records


def main() -> None:
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)

    all_records: list[dict] = []

    for source, url in RDO_FILES.items():
        pdf_filename = f"{source}.pdf"
        pdf_path = data_dir / pdf_filename

        if pdf_path.exists() and pdf_path.stat().st_size > 0:
            print(f"Using cached: {pdf_path}")
        else:
            download_pdf(url, str(pdf_path))

        records = parse_rdo_pdf(str(pdf_path))
        print(f"Extracted {len(records)} records from {source}")

        output_path = data_dir / f"zonal_{source}.json"
        with open(output_path, "w") as f:
            json.dump(records, f, indent=2)
        print(f"Wrote {output_path}")

        all_records.extend(records)

    combined_path = data_dir / "zonal_all.json"
    with open(combined_path, "w") as f:
        json.dump(all_records, f, indent=2)

    print(f"\nTotal: {len(all_records)} zonal records → {combined_path}")


if __name__ == "__main__":
    main()
