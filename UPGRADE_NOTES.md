# DCL Pulse — Hospital indicator upgrade

This is an update to rejie-coder/dcl_dashboard, preserving the existing domain pages. The new landing page is the hospital indicator workspace. The former overview is at #/overview.

## Use

- Open the supplied DCL_Pulse_Improved.html directly in a modern browser, or deploy the source project with its existing GitHub Pages workflow.
- The hospital workspace starts with the supplied Hambantota reference dataset, visibly labelled. It is not presented as data from your own hospital.
- Choose an indicator from grouped navigation. Use search and favorites to narrow the list.
- Import Excel / CSV accepts Code (or Indicator / Category), Year, and Jan–Dec columns. XLSX/XLS worksheet selection is supported. Blanks are missing; zeros are retained. Review validation and commit a replace or merge.
- The attached CSV contained 384 rows: 192 original indicator/year rows plus 192 all-zero duplicate copies with repeated years in their names. Import excludes these duplicates with a visible warning, yielding 64 indicators and 192 year rows. Conflicting duplicates block import.
- Data & quality provides an editable monthly register, new years, CSV export and full JSON backup/restore. The backup includes indicator definitions. Browser data is device-local, not shared across devices.
- Customize indicator changes group, units, monthly target, direction and annual aggregation. Add indicator creates a blank series. Rates/averages use an unweighted mean unless the original DCL domain calculation supplies a numerator and denominator.
- Compare years, chronological analysis, cumulative sums, year/month filters, baseline year, 2/3-sigma width, 6/7-point trends, and line visibility are available. Filter changes are immediate. Display filters reset when the workspace is reopened; data, selected indicator and indicator definitions persist.

## Interpretation

Sample-SD reference bands use sample SD (n−1); they are labelled descriptive rather than definitive SPC control limits. Individuals/moving-range limits use average consecutive moving range / 1.128. Both methods floor the lower limit at zero for non-negative data. Baselines use all months of the chosen period independently of display filters; a fixed baseline year recalculates if its data is edited.

Diamond markers identify values outside limits (red high / blue low); amber triangles identify a shift or trend. Shift = eight consecutive months on one side of mean. Trend = six or seven strictly increasing/decreasing months. Rules run chronologically, including across adjacent years; gaps break runs. Markers identify the final month of each qualifying run window. Targets are separate from statistical limits. The Signals tab and marker tooltips expose exact reasons and limit values.

Cumulative mode suppresses limits and flags. Annual bars show recorded-month counts and available totals/means, not projected full-year totals. Missing observations remain gaps. Optional trailing-zero exclusion applies separately to each year without overwriting the stored values. Use it only after determining the zeros are placeholders. The quality tab flags future calendar values for review.

The admission total in the provided CSV is 266,189, versus 266,639 in the screenshot: October 2026 is 7,650 in the CSV and 8,100 in the screenshot. Calculations use the CSV.

Hospital count indicators are kept separate from the existing derived-domain KPI data. No unit allocation, mortality rate, financial result or HR result is invented from counts lacking necessary denominators. Existing domain charts also receive larger shape-based signal markers and straight segments.

## Deploy this source

1. Copy the source project contents into the existing repository (preserve your Git history).
2. Run `npm ci`, then `npm run build`.
3. Commit the changed files and push to main. The existing `.github/workflows` GitHub Pages workflow builds and deploys `dist`.
4. Reload the live site after the workflow completes; an older open PWA tab may need closing/reopening.

The repository update preserves the existing GitHub Pages workflow.

## Verification

Production TypeScript/Vite build passed. Automated checks cover the supplied CSV, duplicate exclusion, totals, zero/missing handling, sample SD, median, moving-range limits, shift/trend detection, gaps, conflicting rows and real XLSX/CSV parsing. Browser checks cover rendering, signal reasons, zero exclusion, data editing and import controls.

To run checks:

```
npx esbuild scripts/test-hospital.ts --bundle --platform=node --format=esm --outfile=scripts/test-hospital.generated.mjs --external:xlsx --external:papaparse
node scripts/test-hospital.generated.mjs
```

Generate the single-file edition after building with `python3 scripts/standalone.py`.
