import { UNITS } from '@/data/units';
import {
  DATA_FIELDS,
  FIELD_SPECS,
  RAW_FIELDS,
  rawRowSchema,
  type RawField,
} from '@/lib/schema/import.schema';
import type { RawPeriodRow } from '@/types/dcl';
import type { ParsedSheet } from './parse-workbook';

/**
 * Row normalization + validation for the RAW data-entry format (v2).
 *
 * - Header mapping: friendly template headers ('Total Deaths'), camelCase
 *   field names ('totalDeaths') and common variants all resolve to
 *   RawPeriodRow fields.
 * - Cell coercion: Excel serial dates, 'Jan 2026' month strings, '2.9%'
 *   percent strings, thousands separators ('1,250,000' / '12,50,000'),
 *   currency prefixes ('LKR 12,500').
 * - Period derivation: when only Month is given, Period Start/End are
 *   derived as the first–last day of that month.
 * - Example rows from the template (unit starts with 'EXAMPLE') are skipped.
 * - Zod structural validation + soft semantic warnings; duplicate detection
 *   on unitId+periodStart+grain against the active dataset AND within file.
 */

// ── Header mapping ──────────────────────────────────────────────────────────

export interface HeaderMapping {
  source: string;
  field: RawField | null;
  confidence: 'exact' | 'alias' | 'none';
  status: 'mapped' | 'unmapped';
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** aliases beyond the friendly headers / camelCase field names */
const HEADER_ALIASES: Record<string, RawField> = {
  // identity
  unitoftheinstitution: 'unitId',
  unit: 'unitId',
  unitid: 'unitId',
  hospitalunit: 'unitId',
  institution: 'unitId',
  institutionunit: 'unitId',
  ward: 'unitId',
  department: 'unitId',
  unitname: 'unitId',
  dateofdataentry: 'entryDate',
  entrydate: 'entryDate',
  dateentered: 'entryDate',
  datadate: 'entryDate',
  enteredon: 'entryDate',
  month: 'month',
  calendarmonth: 'month',
  reportingmonth: 'month',
  reportingperiodegweek1jan2026: 'periodLabel',
  reportingperiod: 'periodLabel',
  periodlabel: 'periodLabel',
  periodname: 'periodLabel',
  period: 'periodLabel',
  grainweekmonth: 'grain',
  grain: 'grain',
  weekormonth: 'grain',
  frequency: 'grain',
  periodicity: 'grain',
  periodtype: 'grain',
  periodstartyyyymmdd: 'periodStart',
  periodstart: 'periodStart',
  startdate: 'periodStart',
  start: 'periodStart',
  from: 'periodStart',
  fromdate: 'periodStart',
  periodendyyyymmdd: 'periodEnd',
  periodend: 'periodEnd',
  enddate: 'periodEnd',
  end: 'periodEnd',
  to: 'periodEnd',
  todate: 'periodEnd',
  daysinperiod: 'daysInPeriod',
  days: 'daysInPeriod',
  perioddays: 'daysInPeriod',
  noofdays: 'daysInPeriod',
  numberofdays: 'daysInPeriod',
  workingdaysinperiod: 'daysInPeriod',
  // clinical
  admissions: 'totalAdmissions',
  discharges: 'totalDischarges',
  deaths: 'totalDeaths',
  inpatientdays: 'totalInpatientDays',
  beddays: 'totalInpatientDays',
  patientsreadmitted30days: 'readmissions30d',
  readmissions: 'readmissions30d',
  readmissions30days: 'readmissions30d',
  readmission30d: 'readmissions30d',
  totalsurgeriesmajor: 'surgeriesMajor',
  majorsurgeries: 'surgeriesMajor',
  totalsurgeriesminor: 'surgeriesMinor',
  minorsurgeries: 'surgeriesMinor',
  totalsurgeriescataract: 'surgeriesCataract',
  cataractsurgeries: 'surgeriesCataract',
  totalsurgeriesother: 'surgeriesOther',
  othersurgeries: 'surgeriesOther',
  surgicalsiteinfections: 'surgicalSiteInfections',
  ssi: 'surgicalSiteInfections',
  // patient safety
  totalpatientfalls: 'patientFalls',
  falls: 'patientFalls',
  patientsatriskforulcers: 'patientsAtRiskUlcers',
  patientsatriskulcers: 'patientsAtRiskUlcers',
  atriskpatients: 'patientsAtRiskUlcers',
  medicationerrors: 'medicationErrors',
  mederrors: 'medicationErrors',
  totaldosesadministered: 'totalDosesAdministered',
  dosesadministered: 'totalDosesAdministered',
  needlestickinjuries: 'needleStickInjuries',
  sharpsinjuries: 'needleStickInjuries',
  totalstaffshifts: 'totalStaffShifts',
  staffshifts: 'totalStaffShifts',
  // financial (friendly names include the "(LKR)" suffix — normalize strips it)
  pettycashallocationlkr: 'pettyCashAllocation',
  pettycashexpenditurelkr: 'pettyCashExpenditure',
  localpurchaseexpenditurelkr: 'localPurchaseExpenditure',
  fuelexpenditurelkr: 'fuelExpenditure',
  electricitybilllkr: 'electricityBill',
  waterbilllkr: 'waterBill',
  otheroperatingexpenseslkr: 'otherOperatingExpenses',
  totaloperatingexpenseslkr: 'totalOperatingExpenses',
  totalbudgetedexpenditurelkr: 'totalBudgetedExpenditure',
  totalactualexpenditurelkr: 'totalActualExpenditure',
  totalrevenuelkr: 'totalRevenue',
  dayswithzerostock: 'daysWithZeroStock',
  zerostockdays: 'daysWithZeroStock',
  stockoutdays: 'daysWithZeroStock',
  // operational
  beds: 'availableBeds',
  totaltheatrehoursavailable: 'theatreHoursAvailable',
  theatrehours: 'theatreHoursUsed',
  totalopdwaittimeminutes: 'totalOpdWaitMinutes',
  opdwaittimeminutes: 'totalOpdWaitMinutes',
  totalopdwaittime: 'totalOpdWaitMinutes',
  totaldiagnosticturnaroundtimeminutes: 'totalDiagnosticTatMinutes',
  diagnostictatminutes: 'totalDiagnosticTatMinutes',
  totaldiagnostictatminutes: 'totalDiagnosticTatMinutes',
  diagnosticsordered: 'totalDiagnosticsOrdered',
  // hr
  trainingprogrammesconducted: 'trainingProgramsConducted',
  trainingprograms: 'trainingProgramsConducted',
  collectivecpdpoints: 'collectiveCpdPoints',
  cpdpoints: 'collectiveCpdPoints',
  stafftraineddoctors: 'staffTrainedDoctors',
  stafftrainednurses: 'staffTrainedNurses',
  stafftrainedadmin: 'staffTrainedAdmin',
  totalstaffdoctors: 'totalStaffDoctors',
  totalstaffnurses: 'totalStaffNurses',
  totalstaffadmin: 'totalStaffAdmin',
  stafftrainedcompliance: 'staffTrainedCompliance',
  totalstaffrequiredtotrain: 'totalStaffRequiredToTrain',
  staffleftresigned: 'staffLeft',
  staffleft: 'staffLeft',
  leavers: 'staffLeft',
  resignations: 'staffLeft',
  averagetotalstaffcount: 'avgTotalStaffCount',
  averagestaffcount: 'avgTotalStaffCount',
  avgstaffcount: 'avgTotalStaffCount',
  approvedcadrerequirement: 'approvedCadre',
  cadre: 'approvedCadre',
  sickleave: 'sickLeaveDays',
  sickdays: 'sickLeaveDays',
  totalscheduledworkingdays: 'totalScheduledWorkingDays',
  scheduledworkingdays: 'totalScheduledWorkingDays',
  staffwithvalidcpd: 'staffWithValidCpd',
  validcpdstaff: 'staffWithValidCpd',
  totalclinicalstaff: 'totalClinicalStaff',
  clinicalstaff: 'totalClinicalStaff',
};

/** Map a sheet's headers onto canonical RawPeriodRow fields. */
export function mapHeaders(headers: string[]): HeaderMapping[] {
  const used = new Set<RawField>();
  return headers.map((source) => {
    const norm = normalizeHeader(source);
    const exact = RAW_FIELDS.find((f) => normalizeHeader(f) === norm);
    const aliased = exact ?? HEADER_ALIASES[norm];
    const field = aliased && !used.has(aliased) ? aliased : null;
    if (field) used.add(field);
    return {
      source,
      field,
      confidence: field ? (exact ? 'exact' : 'alias') : 'none',
      status: field ? 'mapped' : 'unmapped',
    };
  });
}

// ── Cell coercion ───────────────────────────────────────────────────────────

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isoFromSerial(n: number): string | null {
  // Excel serial date (days since 1899-12-30)
  if (n > 20000 && n < 80000) {
    return new Date(Math.round((n - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }
  return null;
}

function coerceDate(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return isoFromSerial(v) ?? String(v);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // DD/MM/YYYY or MM/DD/YYYY — prefer DD/MM (Sri Lankan convention)
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b];
      return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return s;
  }
  return '';
}

/** Coerce a month cell ('Jan 2026', 'January 2026', '2026-01', 01/2026, serial date) → 'YYYY-MM'. */
function coerceMonth(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 7);
  if (typeof v === 'number' && Number.isFinite(v)) {
    const iso = isoFromSerial(v);
    return iso ? iso.slice(0, 7) : String(v);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    const iso = s.match(/^(\d{4})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}`;
    const words = s.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
    if (words) {
      const m = MONTHS[words[1].slice(0, 3).toLowerCase()];
      if (m) return `${words[2]}-${String(m).padStart(2, '0')}`;
    }
    const numeric = s.match(/^(\d{1,2})[/\-.](\d{4})$/);
    if (numeric) return `${numeric[2]}-${String(Number(numeric[1])).padStart(2, '0')}`;
    return s;
  }
  return '';
}

function coerceNumber(v: unknown): number | null {
  if (isBlank(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string') {
    let s = v.trim();
    // currency prefixes: LKR, Rs, Rs.
    s = s.replace(/^(lkr|rs\.?)\s*/i, '');
    // percent strings: '2.9%' → 2.9
    s = s.replace(/%$/, '');
    // thousands separators (western 1,250,000 and Sri Lankan/Indian 12,50,000)
    s = s.replace(/,/g, '').replace(/\s/g, '');
    if (s === '') return null;
    const n = Number(s);
    return Number.isNaN(n) ? NaN : n;
  }
  return NaN;
}

function coerceGrain(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase();
  if (['w', 'weekly', 'wk', 'week'].includes(s)) return 'week';
  if (['m', 'monthly', 'mo', 'month'].includes(s)) return 'month';
  return s;
}

/** Resolve a unit cell to a unit id (accepts id or unit name, case-insensitive). */
function coerceUnit(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const norm = s.toLowerCase().replace(/[\s_]+/g, '-');
  const byId = UNITS.find((u) => u.id === norm);
  if (byId) return byId.id;
  const byName = UNITS.find((u) => u.name.toLowerCase() === s.toLowerCase());
  return byName ? byName.id : norm;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(month: string): string {
  const m = Number(month.slice(5, 7));
  return `${MONTH_SHORT[m - 1] ?? month} ${month.slice(0, 4)}`;
}

function lastDayOfMonth(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// ── Validation issues ───────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  row: number; // 1-based data row (header = row 1 in the sheet)
  field: string;
  issue: string;
  severity: IssueSeverity;
  suggestion: string;
}

export interface DuplicateInfo {
  key: string;
  row: number;
  unitId: string;
  periodStart: string;
  grain: string;
  /** duplicate of an existing dataset row or of another incoming row */
  against: 'existing' | 'incoming';
}

export interface ValidRow {
  row: number;
  raw: RawPeriodRow;
}

export interface NormalizedResult {
  mappings: HeaderMapping[];
  missingRequired: RawField[];
  /** template example rows that were skipped (informational) */
  exampleRowsSkipped: number;
  valid: ValidRow[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  duplicates: DuplicateInfo[];
  summary: {
    totalRows: number;
    byUnit: Record<string, number>;
    byGrain: Record<string, number>;
    /** rows carrying at least one field of each domain section */
    byDomain: Record<string, number>;
    minDate: string | null;
    maxDate: string | null;
  };
}

function suggestionFor(field: string, message: string): string {
  if (message.startsWith('Unknown unit')) return 'Use the dropdown: ed, icu, medical, surgical, maternity or outpatient.';
  if (field === 'unitId') return 'Pick a unit from the dropdown (never "all" — it is calculated automatically).';
  if (field === 'grain') return 'Choose Week or Month from the dropdown.';
  if (field === 'month') return 'Use e.g. "Jan 2026" or 2026-01.';
  if (field === 'periodStart' || field === 'periodEnd') return 'Use YYYY-MM-DD (e.g. 2026-01-05), or fill the Month column and leave dates blank.';
  if (field === 'entryDate') return 'Use YYYY-MM-DD (e.g. 2026-02-02).';
  if (field === 'daysInPeriod') return 'Use 7 for a week or 28–31 for a month, matching the dates.';
  if (DATA_FIELDS.includes(field as RawField)) return 'Enter a plain number ≥ 0 (no units or text). Thousands separators are fine.';
  return 'Fix the value and re-import, or clear the row.';
}

const MIN_DATE = '2020-01-01';
const MAX_DATE = '2030-12-31';

function hasNum(v: number | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Soft semantic checks — never block a row, always fixable later. */
function semanticWarnings(row: RawPeriodRow, rowNo: number): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const warn = (field: string, issue: string, suggestion: string) =>
    out.push({ row: rowNo, field, issue, severity: 'warning', suggestion });

  if (hasNum(row.totalDeaths) && hasNum(row.totalDischarges) && row.totalDeaths > row.totalDischarges) {
    warn('totalDeaths', `Total Deaths (${row.totalDeaths}) exceeds Total Discharges (${row.totalDischarges})`, 'Check whether deaths are included in the discharge count.');
  }
  if (hasNum(row.readmissions30d) && hasNum(row.totalDischarges) && row.readmissions30d > row.totalDischarges) {
    warn('readmissions30d', `Readmissions (${row.readmissions30d}) exceed Total Discharges (${row.totalDischarges})`, 'Readmissions should be a subset of discharges.');
  }
  if (hasNum(row.totalInpatientDays) && hasNum(row.availableBeds) && row.daysInPeriod > 0) {
    const capacity = row.availableBeds * row.daysInPeriod;
    if (row.totalInpatientDays > capacity) {
      warn('totalInpatientDays', `Implied bed occupancy is over 100% (${row.totalInpatientDays} inpatient days vs ${capacity} available bed-days)`, 'Check Available Beds, Days in Period, and Total Inpatient Days.');
    }
  }
  if (hasNum(row.pettyCashExpenditure) && hasNum(row.pettyCashAllocation) && row.pettyCashAllocation > 0 && row.pettyCashExpenditure > row.pettyCashAllocation * 1.2) {
    warn('pettyCashExpenditure', `Petty Cash Expenditure is more than 120% of the allocation`, 'Confirm the petty cash figures (LKR).');
  }
  if (hasNum(row.theatreHoursUsed) && hasNum(row.theatreHoursAvailable) && row.theatreHoursUsed > row.theatreHoursAvailable) {
    warn('theatreHoursUsed', 'Theatre Hours Used exceeds Total Theatre Hours Available', 'Check the theatre hour figures.');
  }
  if (hasNum(row.surgicalSiteInfections)) {
    const all = [row.surgeriesMajor, row.surgeriesMinor, row.surgeriesCataract, row.surgeriesOther].reduce<number>((s, v) => s + (v ?? 0), 0);
    if (all > 0 && row.surgicalSiteInfections > all) {
      warn('surgicalSiteInfections', 'Surgical Site Infections exceed the total number of surgeries', 'Check the SSI and surgery counts.');
    }
  }
  if (hasNum(row.daysWithZeroStock) && row.daysWithZeroStock > row.daysInPeriod) {
    warn('daysWithZeroStock', `Days with Zero Stock (${row.daysWithZeroStock}) exceeds Days in Period (${row.daysInPeriod})`, 'Use a count of days within the period.');
  }
  if (row.periodStart < MIN_DATE || row.periodStart > MAX_DATE || row.periodEnd < MIN_DATE || row.periodEnd > MAX_DATE) {
    warn('periodStart', `Period dates fall outside 2020–2030`, 'Check the year — a typo here shifts the whole trend line.');
  }
  return out;
}

// ── Main entry ──────────────────────────────────────────────────────────────

/**
 * Normalize + validate the Observations sheet of a parsed file.
 * `existingKeys` is the set of `unitId|periodStart|grain` keys already in
 * the active dataset (for duplicate reporting).
 */
export function normalizeSheet(
  sheet: ParsedSheet,
  mappings: HeaderMapping[],
  existingKeys: Set<string>,
): NormalizedResult {
  const fieldOf = new Map<string, RawField>();
  for (const m of mappings) if (m.field) fieldOf.set(m.source, m.field);
  const mapped = new Set(fieldOf.values());

  // periodStart/periodEnd may be derived from Month, so they are only
  // hard-required when no Month column is mapped.
  const missingRequired: RawField[] = (['unitId', 'grain', 'daysInPeriod'] as RawField[]).filter((f) => !mapped.has(f));
  if (!mapped.has('periodStart') && !mapped.has('month')) missingRequired.push('periodStart');

  const valid: ValidRow[] = [];
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const duplicates: DuplicateInfo[] = [];
  const byUnit: Record<string, number> = {};
  const byGrain: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  let minDate: string | null = null;
  let maxDate: string | null = null;
  let exampleRowsSkipped = 0;
  const incomingKeys = new Set<string>();

  const baseSummary = () => ({ totalRows: sheet.rows.length, byUnit, byGrain, byDomain, minDate, maxDate });

  // If required columns are unmapped, every row is blocked — report once.
  if (missingRequired.length > 0) {
    for (const f of missingRequired) {
      const spec = FIELD_SPECS.find((s) => s.field === f);
      errors.push({
        row: 0,
        field: f,
        issue: `Required column "${spec?.header ?? f}" is not mapped to any header`,
        severity: 'error',
        suggestion: 'Map a source header to this field in the Map columns step, or download the current template.',
      });
    }
    return { mappings, missingRequired, exampleRowsSkipped, valid, errors, warnings, duplicates, summary: baseSummary() };
  }

  sheet.rows.forEach((raw, idx) => {
    const rowNo = idx + 2; // header row is 1
    const get = (field: RawField): unknown => {
      for (const [source, f] of fieldOf) if (f === field) return raw[source];
      return null;
    };

    // skip fully blank rows
    if (RAW_FIELDS.every((f) => isBlank(get(f)))) return;

    // skip template example rows (unit cell starts with 'EXAMPLE')
    if (String(get('unitId') ?? '').trim().toUpperCase().startsWith('EXAMPLE')) {
      exampleRowsSkipped += 1;
      return;
    }

    const unitId = coerceUnit(get('unitId'));
    const grain = coerceGrain(get('grain'));
    const month = coerceMonth(get('month'));
    let periodStart = coerceDate(get('periodStart'));
    let periodEnd = coerceDate(get('periodEnd'));
    // derive period bounds from Month when only the month is given
    if (!periodStart && /^\d{4}-\d{2}$/.test(month)) {
      periodStart = `${month}-01`;
      if (!periodEnd) periodEnd = lastDayOfMonth(month);
    }
    const resolvedMonth = /^\d{4}-\d{2}$/.test(month) ? month : periodStart.slice(0, 7);
    let periodLabel = String(get('periodLabel') ?? '').trim();
    if (!periodLabel && periodStart) {
      periodLabel = grain === 'week' ? `Week of ${periodStart}` : monthLabel(resolvedMonth);
    }
    const entryDate = coerceDate(get('entryDate')) || periodEnd;
    const daysInPeriod = coerceNumber(get('daysInPeriod'));

    const candidate: Record<string, unknown> = {
      unitId,
      grain,
      periodStart,
      periodEnd,
      daysInPeriod: daysInPeriod === null ? undefined : daysInPeriod,
    };
    if (entryDate) candidate.entryDate = entryDate;
    if (resolvedMonth) candidate.month = resolvedMonth;
    if (periodLabel) candidate.periodLabel = periodLabel;
    for (const f of DATA_FIELDS) {
      const n = coerceNumber(get(f));
      if (n !== null) candidate[f] = n;
    }

    const parsed = rawRowSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? 'row');
        errors.push({
          row: rowNo,
          field,
          issue: issue.message,
          severity: 'error',
          suggestion: suggestionFor(field, issue.message),
        });
      }
      return;
    }

    const data = parsed.data;
    const row: RawPeriodRow = {
      unitId: data.unitId,
      entryDate: data.entryDate ?? data.periodEnd,
      month: data.month ?? data.periodStart.slice(0, 7),
      periodLabel: data.periodLabel ?? '',
      grain: data.grain,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      daysInPeriod: data.daysInPeriod,
      source: 'import',
    };
    const rowRecord = row as unknown as Record<string, unknown>;
    for (const f of DATA_FIELDS) {
      const v = (data as Record<string, unknown>)[f];
      if (typeof v === 'number') rowRecord[f] = v;
    }

    warnings.push(...semanticWarnings(row, rowNo));

    const key = `${row.unitId}|${row.periodStart}|${row.grain}`;
    if (incomingKeys.has(key)) {
      duplicates.push({ key, row: rowNo, unitId: row.unitId, periodStart: row.periodStart, grain: row.grain, against: 'incoming' });
    } else if (existingKeys.has(key)) {
      duplicates.push({ key, row: rowNo, unitId: row.unitId, periodStart: row.periodStart, grain: row.grain, against: 'existing' });
    }
    incomingKeys.add(key);

    valid.push({ row: rowNo, raw: row });
    byUnit[row.unitId] = (byUnit[row.unitId] ?? 0) + 1;
    byGrain[row.grain] = (byGrain[row.grain] ?? 0) + 1;
    // count rows carrying at least one field per domain section
    for (const domain of ['clinical-outcome', 'patient-safety', 'financial-efficiency', 'operational-efficiency', 'hr-development']) {
      const anyField = FIELD_SPECS.some((s) => s.group === domain && hasNum(rowRecord[s.field] as number | undefined));
      if (anyField) byDomain[domain] = (byDomain[domain] ?? 0) + 1;
    }
    if (!minDate || row.periodStart < minDate) minDate = row.periodStart;
    if (!maxDate || row.periodEnd > maxDate) maxDate = row.periodEnd;
  });

  return {
    mappings,
    missingRequired,
    exampleRowsSkipped,
    valid,
    errors,
    warnings,
    duplicates,
    summary: baseSummary(),
  };
}

/** Rows to commit given the duplicate strategy. */
export function rowsForCommit(result: NormalizedResult, duplicateMode: 'skip' | 'overwrite'): RawPeriodRow[] {
  const dupKeys = new Set(result.duplicates.filter((d) => d.against === 'existing').map((d) => d.key));
  const seenIncoming = new Set<string>();
  return result.valid
    .filter(({ raw }) => {
      const key = `${raw.unitId}|${raw.periodStart}|${raw.grain}`;
      // always keep only the first occurrence of within-file duplicates
      if (seenIncoming.has(key)) return false;
      seenIncoming.add(key);
      return duplicateMode === 'overwrite' || !dupKeys.has(key);
    })
    .map((v) => v.raw);
}

/** Duplicate key used across the import pipeline. */
export function rawRowKey(row: RawPeriodRow): string {
  return `${row.unitId}|${row.periodStart}|${row.grain}`;
}
