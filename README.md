# DCL Pulse — Hospital Performance Monitoring Dashboard (POC)

A proof-of-concept, GitHub Pages-ready **Progressive Web App** for executive hospital
performance monitoring, configured for a Sri Lankan district/general hospital (currency
**LKR**). Apple-inspired, minimal, vibrant. All data is client-side — a deterministic
3-year dummy dataset (Jan 2023 – Dec 2025) is preloaded, and users can import their own
Excel/CSV data or download a blank template. Nothing leaves the browser.

**Data model:** users enter **raw period data** (admissions, deaths, inpatient days,
surgeries, doses, expenditures in LKR, theatre hours, staff counts, …) — one row per
unit per week/month — and the dashboard **derives all 27 KPI indicators** from those
raw columns (e.g. Mortality Rate = Total Deaths ÷ Total Discharges × 100). Uploading a
filled template updates every chart automatically.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS 3.4 + shadcn/ui + CSS custom properties |
| Charts | Chart.js + react-chartjs-2 + chartjs-plugin-annotation |
| Routing | `HashRouter` (GitHub Pages compatible, no server rewrites) |
| Excel/CSV | SheetJS (`xlsx`) + Papa Parse |
| Validation | Zod |
| State | Zustand (persisted filters + dataset store) |
| PWA | vite-plugin-pwa (`autoUpdate`, precached app shell + data) |
| Icons | lucide-react |

## File Structure

```txt
dcl-dashboard/
├── public/
│   ├── icons/                  # PWA icons (192, 512, maskable)
│   ├── dcl-logo.svg            # Logo mark
│   ├── empty-import.svg        # Data-page empty state illustration
│   └── no-data-chart.svg       # Empty chart illustration
├── src/
│   ├── App.tsx                 # HashRouter + routes (AppShell layout, Outlet)
│   ├── main.tsx
│   ├── index.css               # Design tokens, fonts, domain accent classes
│   ├── components/
│   │   ├── charts/             # SPCChart, SPCMiniChart (CL/UCL/LCL/target/signals)
│   │   ├── data/               # ImportWizard, SchemaPreview, TemplateDownloadCard,
│   │   │                       # ValidationReport, undo-snapshot
│   │   ├── domain/             # DomainCard, DomainHeader, KPISummaryTiles,
│   │   │                       # DomainKPIChartCard, MetricDetailDrawer,
│   │   │                       # per-domain sections + insight rails
│   │   ├── filters/            # GlobalFilterBar (time scale, hospital unit)
│   │   ├── insights/           # AlertFeed, SignalMap, ActionTracker,
│   │   │                       # SPCRuleGuide, ExecutiveExport
│   │   ├── layout/             # AppShell, SidebarNav, TopBar, StatusBar
│   │   └── ui/                 # shadcn/ui primitives
│   ├── data/                   # domains.ts, metrics.ts (all 20 KPIs),
│   │                           # units.ts, dummy-generator.ts (seeded)
│   ├── hooks/                  # usePersistentFilters, useDataset, useSPC
│   ├── lib/
│   │   ├── excel/              # parse-workbook, normalize-rows, to-csv
│   │   ├── schema/             # import.schema.ts (Zod)
│   │   ├── spc/                # calculate-limits, detect-signals, aggregate
│   │   ├── alerts.ts  score.ts  export-template.ts
│   ├── pages/                  # OverviewPage, DomainPage, DataPage, InsightsPage
│   ├── stores/                 # filter-store, dataset-store (localStorage)
│   └── types/                  # dcl.ts (matches JSON schema below)
├── vite.config.ts              # base './' + PWA manifest
└── package.json
```

## Pages

| Route | Purpose |
|---|---|
| `#/` | Level 1 executive overview — five composite domain KPI cards, global health score, priority alerts |
| `#/domains/clinical-outcome` | Mortality Rate, Hospital Daily Deaths, Readmission Rate, Avg Length of Stay, Surgical Site Infection Rate, Major / Minor / Cataract Surgeries |
| `#/domains/patient-safety` | Medication Error, Patient Fall, Pressure Ulcer, Needle Stick Injury |
| `#/domains/financial-efficiency` | Cost per Patient Day (LKR), Petty Cash Utilization %, Local Purchase / Fuel / Electricity / Water Expenditure (LKR), Stock-out Rate |
| `#/domains/operational-efficiency` | Bed Occupancy, Theatre Utilization, OPD Wait, Diagnostic Turnaround |
| `#/domains/hr-development` | Training Programs Conducted, Staff Turnover, Absenteeism, CPD Participation |
| `#/data` | Import Excel/CSV, export blank template, validation report, dataset versions |
| `#/insights` | Cross-domain SPC alert feed, signal map, action tracker, SPC guide, exports |

Global filters — **Time Scale** (Week / Month / Year) and **Hospital Unit** — live in the
top bar, persist in `localStorage`, and apply to every view.

## Dummy Data JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://dcl.example/schemas/performance-dataset.json",
  "title": "DCL Performance Dataset",
  "type": "object",
  "required": ["schemaVersion", "generatedAt", "hospital", "units", "domains", "metrics", "observations"],
  "properties": {
    "schemaVersion": { "const": "1.0.0" },
    "generatedAt": { "type": "string", "format": "date-time" },
    "hospital": {
      "type": "object",
      "required": ["id", "name", "currency"],
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "currency": { "type": "string", "minLength": 3, "maxLength": 3 },
        "timezone": { "type": "string" }
      }
    },
    "units": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "active"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "active": { "type": "boolean" }
        }
      }
    },
    "domains": {
      "type": "array", "minItems": 5, "maxItems": 5,
      "items": {
        "type": "object",
        "required": ["id", "name", "order", "color", "metricIds"],
        "properties": {
          "id": { "enum": ["clinical-outcome", "patient-safety", "financial-efficiency", "operational-efficiency", "hr-development"] },
          "name": { "type": "string" },
          "order": { "type": "integer", "minimum": 1, "maximum": 5 },
          "color": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
          "metricIds": { "type": "array", "minItems": 4, "maxItems": 4, "items": { "type": "string" } }
        }
      }
    },
    "metrics": {
      "type": "array", "minItems": 20,
      "items": {
        "type": "object",
        "required": ["id", "domainId", "name", "unitLabel", "polarity", "target", "spcMethod", "precision", "active"],
        "properties": {
          "id": { "type": "string" },
          "domainId": { "type": "string" },
          "name": { "type": "string" },
          "description": { "type": "string" },
          "unitLabel": { "type": "string" },
          "polarity": { "enum": ["lower", "higher", "range", "zero"] },
          "target": { "type": ["number", "null"] },
          "targetMin": { "type": ["number", "null"] },
          "targetMax": { "type": ["number", "null"] },
          "spcMethod": { "enum": ["p-chart", "u-chart", "i-chart"] },
          "precision": { "type": "integer", "minimum": 0, "maximum": 4 },
          "weight": { "type": "number", "minimum": 0, "default": 1 },
          "active": { "type": "boolean" }
        }
      }
    },
    "observations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["metricId", "unitId", "periodStart", "periodEnd", "grain", "value"],
        "properties": {
          "metricId": { "type": "string" },
          "unitId": { "type": "string" },
          "periodStart": { "type": "string", "format": "date" },
          "periodEnd": { "type": "string", "format": "date" },
          "grain": { "enum": ["week", "month", "year"] },
          "value": { "type": "number" },
          "numerator": { "type": ["number", "null"] },
          "denominator": { "type": ["number", "null"] },
          "source": { "enum": ["sample", "import"] },
          "qualityFlag": { "enum": ["ok", "estimated", "missing-denominator", "outlier-reviewed"] }
        }
      }
    },
    "importBatches": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "importedAt", "fileName", "rowCount", "status"],
        "properties": {
          "id": { "type": "string" },
          "importedAt": { "type": "string", "format": "date-time" },
          "fileName": { "type": "string" },
          "rowCount": { "type": "integer", "minimum": 0 },
          "status": { "enum": ["validated", "committed", "rejected"] },
          "kind": { "enum": ["raw-rows", "observations"] }
        }
      }
    },
    "rawRows": {
      "type": "array",
      "description": "Source-of-truth raw period entries; all indicator observations are derived from these rows",
      "items": {
        "type": "object",
        "required": ["unitId", "entryDate", "month", "periodLabel", "grain", "periodStart", "periodEnd", "daysInPeriod"],
        "properties": {
          "unitId": { "type": "string", "description": "Real unit id — never 'all' (the all-unit view is pooled automatically)" },
          "entryDate": { "type": "string", "format": "date" },
          "month": { "type": "string", "pattern": "^\\d{4}-\\d{2}$" },
          "periodLabel": { "type": "string", "description": "e.g. 'Week 1, Jan 2026'" },
          "grain": { "enum": ["week", "month"] },
          "periodStart": { "type": "string", "format": "date" },
          "periodEnd": { "type": "string", "format": "date" },
          "daysInPeriod": { "type": "integer", "minimum": 1, "maximum": 31 },
          "totalAdmissions": { "type": ["number", "null"] },
          "totalDischarges": { "type": ["number", "null"] },
          "totalDeaths": { "type": ["number", "null"] },
          "totalInpatientDays": { "type": ["number", "null"] },
          "readmissions30d": { "type": ["number", "null"] },
          "surgeriesMajor": { "type": ["number", "null"] },
          "surgeriesMinor": { "type": ["number", "null"] },
          "surgeriesCataract": { "type": ["number", "null"] },
          "surgeriesOther": { "type": ["number", "null"] },
          "surgicalSiteInfections": { "type": ["number", "null"] },
          "patientFalls": { "type": ["number", "null"] },
          "adverseDrugReactions": { "type": ["number", "null"] },
          "newPressureUlcers": { "type": ["number", "null"] },
          "patientsAtRiskUlcers": { "type": ["number", "null"] },
          "medicationErrors": { "type": ["number", "null"] },
          "totalDosesAdministered": { "type": ["number", "null"] },
          "needleStickInjuries": { "type": ["number", "null"] },
          "totalStaffShifts": { "type": ["number", "null"] },
          "pettyCashAllocation": { "type": ["number", "null"], "description": "LKR" },
          "pettyCashExpenditure": { "type": ["number", "null"], "description": "LKR" },
          "localPurchaseExpenditure": { "type": ["number", "null"], "description": "LKR" },
          "fuelExpenditure": { "type": ["number", "null"], "description": "LKR" },
          "electricityBill": { "type": ["number", "null"], "description": "LKR" },
          "waterBill": { "type": ["number", "null"], "description": "LKR" },
          "otherOperatingExpenses": { "type": ["number", "null"], "description": "LKR" },
          "totalOperatingExpenses": { "type": ["number", "null"], "description": "LKR" },
          "totalBudgetedExpenditure": { "type": ["number", "null"], "description": "LKR" },
          "totalActualExpenditure": { "type": ["number", "null"], "description": "LKR" },
          "totalRevenue": { "type": ["number", "null"], "description": "LKR" },
          "daysWithZeroStock": { "type": ["number", "null"] },
          "availableBeds": { "type": ["number", "null"] },
          "theatreHoursUsed": { "type": ["number", "null"] },
          "theatreHoursAvailable": { "type": ["number", "null"] },
          "totalOpdWaitMinutes": { "type": ["number", "null"] },
          "totalOpdPatients": { "type": ["number", "null"] },
          "totalDiagnosticTatMinutes": { "type": ["number", "null"] },
          "totalDiagnosticsOrdered": { "type": ["number", "null"] },
          "trainingProgramsConducted": { "type": ["number", "null"] },
          "collectiveCpdPoints": { "type": ["number", "null"] },
          "staffTrainedDoctors": { "type": ["number", "null"] },
          "staffTrainedNurses": { "type": ["number", "null"] },
          "staffTrainedAdmin": { "type": ["number", "null"] },
          "totalStaffDoctors": { "type": ["number", "null"] },
          "totalStaffNurses": { "type": ["number", "null"] },
          "totalStaffAdmin": { "type": ["number", "null"] },
          "staffTrainedCompliance": { "type": ["number", "null"] },
          "totalStaffRequiredToTrain": { "type": ["number", "null"] },
          "staffLeft": { "type": ["number", "null"] },
          "avgTotalStaffCount": { "type": ["number", "null"] },
          "approvedCadre": { "type": ["number", "null"] },
          "sickLeaveDays": { "type": ["number", "null"] },
          "totalScheduledWorkingDays": { "type": ["number", "null"] },
          "staffWithValidCpd": { "type": ["number", "null"] },
          "totalClinicalStaff": { "type": ["number", "null"] }
        }
      }
    }
  }
}
```

### Derived indicators (computed by `src/lib/indicators/derive.ts`)

| Indicator | Formula | SPC |
|---|---|---:|
| Mortality Rate | Total Deaths ÷ Total Discharges × 100 | p |
| Hospital Daily Deaths | Total Deaths ÷ Days in Period | i |
| Readmission Rate | Readmissions (30d) ÷ Total Discharges × 100 | p |
| Avg Length of Stay | Total Inpatient Days ÷ Total Discharges | i |
| Surgical Site Infection Rate | SSIs ÷ Total Surgeries (All) × 100 | p |
| Major / Minor / Cataract Surgeries | raw counts (volume) | i |
| Patient Fall Rate | Falls ÷ Total Inpatient Days × 1,000 | u |
| Medication Error Rate | Errors ÷ Total Doses Administered × 1,000 | u |
| Pressure Ulcer Incidence | New Ulcers ÷ Patients at Risk × 100 | p |
| Needle Stick Injury Rate | Injuries ÷ Total Staff Shifts × 1,000 | u |
| Cost per Patient Day | Total Operating Expenses ÷ Total Inpatient Days (LKR) | i |
| Petty Cash Utilization | Petty Cash Expenditure ÷ Allocation × 100 | i |
| Local Purchase / Fuel / Electricity / Water | raw LKR amounts (volume) | i |
| Stock-out Rate | Days with Zero Stock ÷ Days in Period × 100 | p |
| Bed Occupancy Rate | Inpatient Days ÷ (Available Beds × Days in Period) × 100 | p |
| Theatre Utilization Rate | Theatre Hours Used ÷ Hours Available × 100 | p |
| OPD Avg Wait Time | Total OPD Wait Minutes ÷ Total OPD Patients | i |
| Diagnostic Turnaround Time | Total TAT Minutes ÷ Total Diagnostics Ordered | i |
| Training Programs Conducted | raw count (volume) | i |
| Staff Turnover Rate | Staff Left ÷ Avg Total Staff × 100 | p |
| Absenteeism Rate | Sick Leave Days ÷ Scheduled Working Days × 100 | p |
| CPD Participation Rate | Staff with Valid CPD ÷ Total Clinical Staff × 100 | p |

The **All Units** view is computed by pooling raw rows (summing numerators and
denominators, then recomputing ratios — never averaging rates).

The bundled dataset is generated deterministically (seed `DCL-POC-2026`): 936 weekly raw
rows (6 real units × 156 weeks, Jan 2023 – Dec 2025) with realistic Sri Lankan
magnitudes (e.g. cost per patient day ≈ LKR 11,300–11,800; electricity ≈ LKR 2.4M/month
per large unit), seasonality, gentle improvement trends, and 1–2 special-cause events
per raw field. Month/year grains are pooled rollups of the derived observations.

## SPC Logic

- **p-chart** — proportions (numerator/denominator), limits vary with denominator.
- **u-chart** — count rates per exposure.
- **i-chart** — continuous values; sigma from mean moving range (`MR̄ / 1.128`).
- Baseline = first 20 completed periods (minimum 12, otherwise "Insufficient baseline").
- LCL floored at 0 for naturally non-negative metrics.
- Signal rules: (1) point beyond UCL/LCL, (2) 8 consecutive points one side of CL,
  (3) 6 consecutive increasing/decreasing, (4) 2 of 3 beyond the same 2σ zone.

Core component: `src/components/charts/SPCChart.tsx` — measured series + CL (solid),
UCL/LCL (dashed, labeled), optional target line (dotted green annotation), red markers
for special causes, amber rings for run-rule points, rich tooltip with CL/UCL/LCL and
signal rule. `SPCMiniChart.tsx` is the sparkline variant used on Level 1 domain cards.

## Excel Upload Logic (Client-Side)

Implemented in `src/components/data/ImportWizard.tsx` + `src/lib/excel/`:

1. **Accept file** — drag-and-drop or file input; `.xlsx` / `.xls` / `.csv`, ≤ 10 MB.
2. **Read locally** — `file.arrayBuffer()`; never leaves the browser.
3. **Parse** — `XLSX.read(buffer, { type: 'array', cellDates: true })`; Papa Parse for CSV.
   Expects the template's `Observations` sheet (one row per unit per week/month).
4. **Normalize headers** — friendly names and camelCase field names both accepted
   (`Total Deaths` / `totalDeaths` → same field); coerces Excel serial dates,
   `Jan 2026` month strings, `1,250,000` / Indian grouping `1,50,000`, `LKR ` / `Rs `
   prefixes, and `2.9%` strings. Month-only rows get period bounds derived automatically.
5. **Validate with Zod** — blockers: valid unit (never `all`), grain, ISO dates,
   `daysInPeriod` matching the period length, numeric ≥ 0 fields, at least one data
   field filled. Warnings (never block): deaths > discharges, occupancy-implied > 100%,
   petty cash spent > 120% of allocation, etc.
6. **Duplicates** — key `unitId + periodStart + grain`, checked against existing raw rows
   and within the file; user picks skip/overwrite.
7. **Preview** — first 20 valid rows, first 20 errors, coverage counts, min/max dates.
8. **Commit** — `commitImportedRawRows(rows, { mode: 'merge' })` upserts into the
   localStorage-backed raw store; indicators are re-derived automatically and every
   dashboard chart updates. Pre-commit snapshot kept for one-click undo.
9. **Export template** — blank workbook generated client-side: `Observations` entry
   sheet (62 columns grouped by the 5 domains, frozen header, 3 example rows, LKR number
   formats), `README` instructions sheet with the full column guide + indicator formulas,
   `Lists` sheet backing Unit/Grain dropdowns. CSV mirror also offered.

## PWA & GitHub Pages

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`; app shell + sample data precached.
- Vite `base: './'` — works on `https://<user>.github.io/<repo>/` with no extra config.
- `HashRouter` — no server-side rewrite rules required.
- To deploy: `npm run build` and push `dist/` to a `gh-pages` branch (or use
  `peaceiris/actions-gh-pages`).

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/ (with service worker)
```

**Privacy note:** imported files are parsed and stored locally in the browser.
Nothing is uploaded.
