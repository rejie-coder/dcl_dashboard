import * as XLSX from 'xlsx';
import { UNITS } from '@/data/units';
import {
  CURRENCY_FIELDS,
  DERIVED_INDICATORS,
  FIELD_GROUPS,
  FIELD_SPECS,
  type RawFieldSpec,
} from '@/lib/schema/import.schema';
import { toCsv } from '@/lib/excel/to-csv';

/**
 * Raw data-entry template workbook (v2 data core).
 *
 * Sheets:
 * - `Observations` — the single wide data-entry sheet. One row per unit per
 *   week or month; friendly headers grouped by section, with the exact
 *   RawPeriodRow field name attached to each header cell as a comment.
 * - `README` — how to fill the template (one row per unit per period, leave
 *   cells blank when not applicable, amounts in LKR, example rows marked).
 * - `Lists` — dropdown values (real unit ids + names, Week/Month grains).
 *
 * The importer recognises the sheet by name ("Observations") and maps both
 * the friendly headers and the camelCase field names, so the file round-
 * trips: download → fill in Excel → upload → dashboard updates.
 */

export const TEMPLATE_VERSION = '2.0.0';
export const OBSERVATIONS_SHEET = 'Observations';
/** marker used on the example rows; the importer skips rows whose unit starts with this */
export const EXAMPLE_UNIT_MARKER = 'EXAMPLE — delete before submitting';

const HEADER_ROW = 1;
const FIRST_DATA_ROW = 2;
const VALIDATION_ROWS = 2000;

/** entry units only — 'all' is derived by pooling, never entered */
const ENTRY_UNITS = UNITS.filter((u) => u.id !== 'all');

const LKR_SET = new Set<string>(CURRENCY_FIELDS);

// ── Example rows (clearly marked; the importer skips them) ──────────────────

type ExampleCell = Partial<Record<RawFieldSpec['field'], string | number>>;

const EXAMPLE_ROWS: ExampleCell[] = [
  {
    // surgical · full month, every section filled
    unitId: EXAMPLE_UNIT_MARKER,
    entryDate: '2026-02-02',
    month: 'Jan 2026',
    periodLabel: 'EXAMPLE Jan 2026 (Month)',
    grain: 'Month',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    daysInPeriod: 31,
    totalAdmissions: 520,
    totalDischarges: 515,
    totalDeaths: 12,
    totalInpatientDays: 2266,
    readmissions30d: 38,
    surgeriesMajor: 85,
    surgeriesMinor: 140,
    surgeriesCataract: 60,
    surgeriesOther: 25,
    surgicalSiteInfections: 3,
    patientFalls: 4,
    adverseDrugReactions: 9,
    newPressureUlcers: 2,
    patientsAtRiskUlcers: 120,
    medicationErrors: 18,
    totalDosesAdministered: 45000,
    needleStickInjuries: 1,
    totalStaffShifts: 620,
    pettyCashAllocation: 150000,
    pettyCashExpenditure: 142500,
    localPurchaseExpenditure: 850000,
    fuelExpenditure: 420000,
    electricityBill: 1250000,
    waterBill: 380000,
    otherOperatingExpenses: 950000,
    totalOperatingExpenses: 27190000,
    totalBudgetedExpenditure: 28500000,
    totalActualExpenditure: 28200000,
    totalRevenue: 3100000,
    daysWithZeroStock: 1,
    availableBeds: 89,
    theatreHoursUsed: 96,
    theatreHoursAvailable: 120,
    totalOpdWaitMinutes: 36000,
    totalOpdPatients: 1800,
    totalDiagnosticTatMinutes: 180000,
    totalDiagnosticsOrdered: 1500,
    trainingProgramsConducted: 2,
    collectiveCpdPoints: 45,
    staffTrainedDoctors: 8,
    staffTrainedNurses: 22,
    staffTrainedAdmin: 3,
    totalStaffDoctors: 12,
    totalStaffNurses: 45,
    totalStaffAdmin: 10,
    staffTrainedCompliance: 30,
    totalStaffRequiredToTrain: 60,
    staffLeft: 1,
    avgTotalStaffCount: 67,
    approvedCadre: 75,
    sickLeaveDays: 45,
    totalScheduledWorkingDays: 1742,
    staffWithValidCpd: 40,
    totalClinicalStaff: 57,
  },
  {
    // medical · one week, clinical + safety + ops only (finance/HR left blank)
    unitId: EXAMPLE_UNIT_MARKER,
    entryDate: '2026-01-12',
    month: 'Jan 2026',
    periodLabel: 'EXAMPLE Week 1, Jan 2026 (Week)',
    grain: 'Week',
    periodStart: '2026-01-05',
    periodEnd: '2026-01-11',
    daysInPeriod: 7,
    totalAdmissions: 130,
    totalDischarges: 128,
    totalDeaths: 3,
    totalInpatientDays: 560,
    readmissions30d: 9,
    patientFalls: 1,
    medicationErrors: 4,
    totalDosesAdministered: 11200,
    availableBeds: 90,
    totalOpdWaitMinutes: 8400,
    totalOpdPatients: 420,
  },
  {
    // maternity · month given only; Period Start/End derived automatically
    unitId: EXAMPLE_UNIT_MARKER,
    entryDate: '2026-03-03',
    month: 'Feb 2026',
    periodLabel: 'EXAMPLE Feb 2026 (Month)',
    grain: 'Month',
    daysInPeriod: 28,
    totalAdmissions: 210,
    totalDischarges: 208,
    totalDeaths: 1,
    totalInpatientDays: 610,
    surgeriesCataract: 0,
    availableBeds: 24,
  },
];

// ── Observations sheet ───────────────────────────────────────────────────────

function buildObservationsSheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const range: XLSX.Range = { s: { r: 0, c: 0 }, e: { r: 0, c: FIELD_SPECS.length - 1 } };

  // header row with field-name comments
  FIELD_SPECS.forEach((spec, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    ws[ref] = {
      t: 's',
      v: spec.header,
      c: [
        {
          a: 'DCL Pulse',
          t: `${spec.field}${spec.required ? ' (required)' : ' (optional)'}\n${spec.rules}`,
        },
      ],
    };
  });

  // example rows (clearly marked; importer skips them)
  EXAMPLE_ROWS.forEach((row, i) => {
    const r = HEADER_ROW + i; // 0-based
    FIELD_SPECS.forEach((spec, c) => {
      const v = row[spec.field];
      if (v === undefined) return;
      const ref = XLSX.utils.encode_cell({ r, c });
      if (typeof v === 'number') {
        ws[ref] = { t: 'n', v, ...(LKR_SET.has(spec.field) ? { z: '#,##0' } : {}) };
      } else {
        ws[ref] = { t: 's', v };
      }
    });
    range.e.r = r;
  });

  ws['!ref'] = XLSX.utils.encode_range(range);
  ws['!cols'] = FIELD_SPECS.map((spec) => ({
    wch: spec.group === 'identity' ? Math.max(spec.header.length, 14) : Math.min(Math.max(spec.header.length * 0.55, 12), 22),
  }));
  // freeze the header row (best-effort; honoured by Excel/LibreOffice)
  (ws as XLSX.WorkSheet & { '!freeze'?: unknown })['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', state: 'frozen' };

  // dropdown validation for Unit + Grain, backed by the Lists sheet
  const unitCol = XLSX.utils.encode_col(FIELD_SPECS.findIndex((s) => s.field === 'unitId'));
  const grainCol = XLSX.utils.encode_col(FIELD_SPECS.findIndex((s) => s.field === 'grain'));
  (ws as XLSX.WorkSheet & { '!dataValidations'?: unknown[] })['!dataValidations'] = [
    {
      sqref: `${unitCol}${FIRST_DATA_ROW}:${unitCol}${VALIDATION_ROWS}`,
      type: 'list',
      formula1: `Lists!$A$2:$A$${ENTRY_UNITS.length + 1}`,
      allowBlank: true,
      showDropDown: false, // false = show the in-cell dropdown (SheetJS quirk)
      promptTitle: 'Unit',
      prompt: ENTRY_UNITS.map((u) => `${u.id} = ${u.name}`).join('; '),
    },
    {
      sqref: `${grainCol}${FIRST_DATA_ROW}:${grainCol}${VALIDATION_ROWS}`,
      type: 'list',
      formula1: 'Lists!$C$2:$C$3',
      allowBlank: true,
      showDropDown: false,
      promptTitle: 'Grain',
      prompt: 'Week or Month',
    },
  ];
  return ws;
}

// ── README sheet ─────────────────────────────────────────────────────────────

function buildReadmeSheet(): XLSX.WorkSheet {
  const lines: (string | number)[][] = [
    ['DCL Pulse — Raw Data Entry Template', `v${TEMPLATE_VERSION}`],
    [],
    ['HOW TO FILL THIS IN'],
    ['1.', 'Enter data on the "Observations" sheet only. One row per unit per reporting period (a week OR a month).'],
    ['2.', 'Weekly and monthly rows may be mixed in the same file — set the Grain dropdown on each row.'],
    ['3.', 'The first rows are worked EXAMPLES (unit = "EXAMPLE — delete before submitting"). They are ignored by the importer. Delete them before submitting if you like.'],
    ['4.', 'Leave a cell BLANK when the figure does not apply to your unit/period (e.g. theatre hours for OPD). Blank is fine — only the indicators that can be calculated will be calculated.'],
    ['5.', 'Required on every row: Unit of the Institution, Grain, Days in Period, and EITHER Month OR Period Start + Period End. Fill in at least one data column.'],
    ['6.', 'When only Month is given (e.g. "Jan 2026"), Period Start/End are filled in automatically as the first and last day of that month.'],
    ['7.', 'Days in Period must match the period: 7 for a week, 28–31 for a month.'],
    ['8.', 'All money columns are in Sri Lankan Rupees (LKR) — section "3. Financial Efficiency (LKR)". Enter plain numbers; thousands separators like 1,250,000 are accepted.'],
    ['9.', 'Do NOT enter an "all" unit row. The all-units view is pooled automatically from the unit rows.'],
    ['10.', 'Dates: use YYYY-MM-DD (e.g. 2026-01-05). Week periods start on Monday.'],
    [],
    ['UNITS'],
    ...ENTRY_UNITS.map((u) => [u.id, u.name]),
    [],
    ['COLUMN GUIDE'],
    ['Section', 'Column', 'Field name', 'Required?', 'Notes'],
    ...FIELD_SPECS.map((s) => [s.groupLabel, s.header, s.field, s.required ? 'Yes' : 'No', s.rules]),
    [],
    ['WHAT THE DASHBOARD CALCULATES (do not enter these — they are derived automatically)'],
    ['Section', 'Indicator', 'Formula', 'Unit'],
    ...DERIVED_INDICATORS.map((d) => [
      GROUP_SECTION_LABEL[d.domainId],
      d.name,
      d.formula,
      d.unitLabel,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(lines);
  ws['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 60 }, { wch: 10 }, { wch: 80 }];
  (ws as XLSX.WorkSheet & { '!freeze'?: unknown })['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', state: 'frozen' };
  return ws;
}

const GROUP_SECTION_LABEL: Record<string, string> = Object.fromEntries(
  FIELD_GROUPS.map((g) => [g.group, g.label]),
);

// ── Lists sheet ──────────────────────────────────────────────────────────────

function buildListsSheet(): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([
    ['unitId', 'unitName', 'grain'],
    ...ENTRY_UNITS.map((u, i) => [u.id, u.name, i < 2 ? ['Week', 'Month'][i] : '']),
  ]);
  ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 10 }];
  return ws;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function generateTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildObservationsSheet(), OBSERVATIONS_SHEET);
  XLSX.utils.book_append_sheet(wb, buildReadmeSheet(), 'README');
  XLSX.utils.book_append_sheet(wb, buildListsSheet(), 'Lists');
  return wb;
}

export function generateTemplateBlob(): Blob {
  const wb = generateTemplateWorkbook();
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** CSV mirror of the Observations sheet (single sheet; README lives in-app). */
export function generateTemplateCsv(): string {
  const headers = FIELD_SPECS.map((s) => s.header);
  const rows = EXAMPLE_ROWS.map((row) =>
    FIELD_SPECS.map((s) => {
      const v = row[s.field];
      return v === undefined ? '' : v;
    }),
  );
  return toCsv(headers, rows);
}

export function generateTemplateCsvBlob(): Blob {
  return new Blob([generateTemplateCsv()], { type: 'text/csv;charset=utf-8' });
}
