# 09 — BIR Zonal Values Pipeline

## Overview

The BIR (Bureau of Internal Revenue) publishes zonal values — government-mandated minimum land values per street/subdivision/barangay — as PDFs per Revenue District Office (RDO). This pipeline extracts those values and makes them queryable for property enrichment.

**Status for hackathon:** Manual script. The BIR compliance feature is flagged as a **prototype** — zonal values are often 5–10 years outdated and well below market prices.

---

## Data Sources

BIR hosts zonal value PDFs at a predictable CDN:

```
https://bir-cdn.bir.gov.ph/BIR/pdf/RDO%2081.pdf       ← Cebu City North
https://bir-cdn.bir.gov.ph/BIR/pdf/RDO%2082%20(1).pdf  ← Cebu City South
```

The full RDO file listing is at `https://www.bir.gov.ph/zonal-values` (JS-rendered — scrapable via BrightData Browser API for expansion).

---

## PDF Structure

All RDO PDFs follow a consistent structure:

```
[MUNICIPALITY / CITY NAME]
  [BARANGAY NAME]
    [STREET / SUBDIVISION NAME]         ZONAL VALUE/SQ.M.    [PHP AMOUNT]
    [STREET / SUBDIVISION NAME]         ZONAL VALUE/SQ.M.    [PHP AMOUNT]
  [BARANGAY NAME]
    ...
```

Key patterns:

- Every money row contains `ZONAL VALUE/SQ.M.` followed by the PHP amount
- Barangay names appear as section headers (all-caps)
- Subdivision names contain keywords: `SUBD.`, `SUBDIVISION`, `HOMES`, `VILLAGE`, `HEIGHTS`, `ESTATE`
- Values are plain integers or floats (e.g., `3,500`, `12,000.00`)

---

## Extraction Script

```python
# scripts/bir_zonal_pipeline.py
import pdfplumber
import re
import json
from pathlib import Path

RDO_FILES = {
    'cebu_city_north': 'https://bir-cdn.bir.gov.ph/BIR/pdf/RDO%2081.pdf',
    'cebu_city_south': 'https://bir-cdn.bir.gov.ph/BIR/pdf/RDO%2082%20(1).pdf',
}

ZONAL_ROW_RE = re.compile(r'ZONAL\s+VALUE\s*/\s*SQ\.?\s*M\.?\s+([\d,]+\.?\d*)', re.IGNORECASE)
MONEY_CLEAN = re.compile(r'[^\d.]')

def parse_rdo_pdf(pdf_path: str) -> list[dict]:
    records = []
    current_city = current_barangay = None

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            lines = text.split('\n')

            for line in lines:
                line = line.strip()
                if not line:
                    continue

                if is_city_header(line):
                    current_city = normalise(line)
                    continue

                if is_barangay_header(line):
                    current_barangay = normalise(line)
                    continue

                match = ZONAL_ROW_RE.search(line)
                if match and current_barangay:
                    street_or_subd = line[:match.start()].strip()
                    php_value = float(MONEY_CLEAN.sub('', match.group(1)))
                    records.append({
                        'city': current_city,
                        'barangay': current_barangay,
                        'street_or_subd': street_or_subd,
                        'zone_type': classify_zone(street_or_subd),
                        'zonal_value_php': php_value,
                        'rdo_source': Path(pdf_path).stem,
                    })

    return records

def is_city_header(line: str) -> bool:
    return (line.isupper() and len(line) > 4
            and 'ZONAL' not in line and 'BARANGAY' not in line
            and not re.search(r'\d', line))

def is_barangay_header(line: str) -> bool:
    keywords = ['BARANGAY', 'BRGY', 'BGY']
    return any(kw in line.upper() for kw in keywords) and 'ZONAL' not in line

def classify_zone(name: str) -> str:
    subd_keywords = ['SUBD', 'SUBDIVISION', 'VILLAGE', 'HOMES', 'HEIGHTS', 'ESTATE', 'PARK', 'RESIDENCES']
    return 'subdivision' if any(k in name.upper() for k in subd_keywords) else 'street'

def normalise(s: str) -> str:
    return s.strip().upper().replace('  ', ' ')

if __name__ == '__main__':
    for source, url in RDO_FILES.items():
        records = parse_rdo_pdf(url)
        output_path = f'data/zonal_{source}.json'
        with open(output_path, 'w') as f:
            json.dump(records, f, indent=2)
        print(f'Extracted {len(records)} records → {output_path}')
```

**To run:**

```bash
python scripts/bir_zonal_pipeline.py
```

Output goes to `data/zonal_*.json`. Then import into the `ZonalValue` table via a separate import script or Prisma seed.

---

## Lookup Strategy at Enrichment Time

When a property's scraped address needs a zonal value:

```
1. Exact subdivision name match (zoneType = 'subdivision') within same barangay
2. Street name match within same barangay
3. Barangay-level median of all zonal values in that barangay (fallback)
4. City-level median (last resort — flags record as low-confidence zonal lookup)
```

```typescript
// libs/pipeline/src/enrichment/zonal-lookup.service.ts
@Injectable()
export class ZonalLookupService {
  async getZonalValue(
    barangay: string,
    city: string,
    streetOrSubd?: string,
  ): Promise<ZonalLookupResult> {
    if (streetOrSubd) {
      // 1. Exact subdivision match
      const exact = await this.prisma.zonalValue.findFirst({
        where: {
          barangay,
          city,
          streetOrSubd: { contains: streetOrSubd, mode: 'insensitive' },
          zoneType: 'subdivision',
        },
      });
      if (exact)
        return { value: exact.zonalValuePhp, confidence: 'exact_subdivision' };

      // 2. Street match
      const street = await this.prisma.zonalValue.findFirst({
        where: {
          barangay,
          city,
          streetOrSubd: { contains: streetOrSubd, mode: 'insensitive' },
        },
      });
      if (street) return { value: street.zonalValuePhp, confidence: 'street' };
    }

    // 3. Barangay median
    const brgyVals = await this.prisma.zonalValue.findMany({
      where: { barangay, city },
    });
    if (brgyVals.length) {
      const median = computeMedian(brgyVals.map((v) => v.zonalValuePhp));
      return { value: median, confidence: 'barangay_median' };
    }

    // 4. City median (last resort)
    const cityVals = await this.prisma.zonalValue.findMany({ where: { city } });
    if (cityVals.length) {
      const median = computeMedian(cityVals.map((v) => v.zonalValuePhp));
      return { value: median, confidence: 'city_median' };
    }

    return { value: 0, confidence: 'not_found' };
  }
}
```

---

## BIR Compliance Output (Prototype)

The `F_BIR` compliance floor and `S_risk` audit risk score are computed as output annotations — not model inputs:

```python
def bir_compliance(prop: dict, gov_ref: dict) -> dict:
    z_floor = (gov_ref.get('zonal_value_php') or 0) * prop['lot_area_sqm']
    assess_floor = (gov_ref.get('lgu_assessed_value') or 0) / (gov_ref.get('assessment_level') or 0.20)
    F_BIR = max(z_floor, assess_floor)

    P_decl = prop.get('asking_price_php') or 0
    S_risk = ((P_decl - F_BIR) / F_BIR * 100) if F_BIR > 0 else None

    if S_risk is None:
        risk_label = 'unknown'
    elif S_risk > 0:
        risk_label = 'green'   # Above compliance floor
    elif S_risk >= -5:
        risk_label = 'yellow'  # Slightly below
    else:
        risk_label = 'red'     # Significantly below — audit risk

    return {
        'compliance_floor_php': F_BIR,
        'audit_risk_score': S_risk,
        'risk_label': risk_label,
    }
```

Displayed in the valuation panel as:

```
BIR compliance (prototype):
  Floor: PHP 2,450,000  ·  Audit risk: Low 🟢
  ⚠ Based on zonal values that may be outdated. Not a legal assessment.
```

---

## Prisma Model

```prisma
model ZonalValue {
  id            String   @id @default(cuid())
  city          String
  barangay      String
  streetOrSubd  String?
  zoneType      String   // "street" | "subdivision"
  zonalValuePhp Float
  rdoSource     String   // e.g. "cebu_city_north"
  extractedAt   DateTime @default(now())

  @@index([barangay, city])
  @@index([city])
}
```

---

## Coverage Note

For hackathon: **Metro Cebu only** (RDO 81 + 82). The script is designed to accept additional RDO files as coverage expands. Full national coverage would require scraping the BIR zonal values index page and processing all ~120 RDO PDFs.

Consider filing a GitHub issue: `national-bir-zonal-expansion`.
