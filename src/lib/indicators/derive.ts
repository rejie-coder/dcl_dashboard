import type { Observation, RawPeriodRow } from '@/types/dcl';

/**
 * Indicator derivation: RAW data-entry rows → KPI Observations.
 *
 * - One pass per row emits every derivable Observation (value plus
 *   numerator/denominator for ratio metrics).
 * - An observation is SKIPPED when a required raw field is missing or the
 *   denominator is 0.
 * - The 'all' unit is NEVER entered directly: raw rows are pooled across
 *   units per period first (counts and LKR amounts summed; availableBeds is
 *   the per-unit period value, summed across units) and every ratio is then
 *   recomputed from the pooled sums — ratios are never averaged.
 */

interface DerivedPoint {
  value: number;
  numerator: number | null;
  denominator: number | null;
}

type Rule = (row: RawPeriodRow) => DerivedPoint | null;

const has = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** ratio helper: scale = 100 (percent), 1000 (per-1,000 rate) or 1 (plain ratio) */
function ratio(numerator: number | undefined, denominator: number | undefined, scale: number): DerivedPoint | null {
  if (!has(numerator) || !has(denominator) || denominator <= 0) return null;
  return { value: (numerator / denominator) * scale, numerator, denominator };
}

/** raw amount/count passthrough (i-chart; rolls up by sum) */
function amount(v: number | undefined): DerivedPoint | null {
  if (!has(v)) return null;
  return { value: v, numerator: null, denominator: null };
}

/** surgeriesAll = major + minor + cataract + other (missing fields count as 0; null when none reported) */
function surgeriesAll(row: RawPeriodRow): number | null {
  const parts = [row.surgeriesMajor, row.surgeriesMinor, row.surgeriesCataract, row.surgeriesOther];
  if (!parts.some(has)) return null;
  return parts.reduce<number>((s, v) => s + (v ?? 0), 0);
}

const RULES: Record<string, Rule> = {
  // ── Clinical Outcome ───────────────────────────────────────────────
  'mortality-rate': (r) => ratio(r.totalDeaths, r.totalDischarges, 100),
  'hospital-daily-deaths': (r) => ratio(r.totalDeaths, r.daysInPeriod, 1),
  'readmission-rate': (r) => ratio(r.readmissions30d, r.totalDischarges, 100),
  'avg-length-of-stay': (r) => ratio(r.totalInpatientDays, r.totalDischarges, 1),
  'ssi-rate': (r) => {
    const all = surgeriesAll(r);
    return all === null ? null : ratio(r.surgicalSiteInfections, all, 100);
  },
  'surgeries-major': (r) => amount(r.surgeriesMajor),
  'surgeries-minor': (r) => amount(r.surgeriesMinor),
  'surgeries-cataract': (r) => amount(r.surgeriesCataract),

  // ── Patient Safety ─────────────────────────────────────────────────
  'patient-fall-rate': (r) => ratio(r.patientFalls, r.totalInpatientDays, 1000),
  'medication-error-rate': (r) => ratio(r.medicationErrors, r.totalDosesAdministered, 1000),
  'pressure-ulcer-incidence': (r) => ratio(r.newPressureUlcers, r.patientsAtRiskUlcers, 100),
  'needle-stick-injury-rate': (r) => ratio(r.needleStickInjuries, r.totalStaffShifts, 1000),

  // ── Financial Efficiency (LKR) ─────────────────────────────────────
  'cost-per-patient-day': (r) => ratio(r.totalOperatingExpenses, r.totalInpatientDays, 1),
  'petty-cash-utilization': (r) => ratio(r.pettyCashExpenditure, r.pettyCashAllocation, 100),
  'local-purchase-expenditure': (r) => amount(r.localPurchaseExpenditure),
  'fuel-expenditure': (r) => amount(r.fuelExpenditure),
  'electricity-bill': (r) => amount(r.electricityBill),
  'water-bill': (r) => amount(r.waterBill),
  'stock-out-rate': (r) => ratio(r.daysWithZeroStock, r.daysInPeriod, 100),

  // ── Operational Efficiency ─────────────────────────────────────────
  'bed-occupancy-rate': (r) =>
    has(r.availableBeds) && r.daysInPeriod > 0
      ? ratio(r.totalInpatientDays, r.availableBeds * r.daysInPeriod, 100)
      : null,
  'theatre-utilization-rate': (r) => ratio(r.theatreHoursUsed, r.theatreHoursAvailable, 100),
  'opd-avg-wait-time': (r) => ratio(r.totalOpdWaitMinutes, r.totalOpdPatients, 1),
  'diagnostic-turnaround-time': (r) => ratio(r.totalDiagnosticTatMinutes, r.totalDiagnosticsOrdered, 1),

  // ── HR Development ─────────────────────────────────────────────────
  'training-programs-conducted': (r) => amount(r.trainingProgramsConducted),
  'staff-turnover-rate': (r) => ratio(r.staffLeft, r.avgTotalStaffCount, 100),
  'absenteeism-rate': (r) => ratio(r.sickLeaveDays, r.totalScheduledWorkingDays, 100),
  'cpd-participation-rate': (r) => ratio(r.staffWithValidCpd, r.totalClinicalStaff, 100),
};

/** numeric RawPeriodRow fields that are summed when pooling units into 'all' */
const POOLED_FIELDS = [
  'totalAdmissions', 'totalDischarges', 'totalDeaths', 'totalInpatientDays', 'readmissions30d',
  'surgeriesMajor', 'surgeriesMinor', 'surgeriesCataract', 'surgeriesOther', 'surgicalSiteInfections',
  'patientFalls', 'adverseDrugReactions', 'newPressureUlcers', 'patientsAtRiskUlcers',
  'medicationErrors', 'totalDosesAdministered', 'needleStickInjuries', 'totalStaffShifts',
  'pettyCashAllocation', 'pettyCashExpenditure', 'localPurchaseExpenditure', 'fuelExpenditure',
  'electricityBill', 'waterBill', 'otherOperatingExpenses', 'totalOperatingExpenses',
  'totalBudgetedExpenditure', 'totalActualExpenditure', 'totalRevenue', 'daysWithZeroStock',
  'availableBeds', 'theatreHoursUsed', 'theatreHoursAvailable',
  'totalOpdWaitMinutes', 'totalOpdPatients', 'totalDiagnosticTatMinutes', 'totalDiagnosticsOrdered',
  'trainingProgramsConducted', 'collectiveCpdPoints',
  'staffTrainedDoctors', 'staffTrainedNurses', 'staffTrainedAdmin',
  'totalStaffDoctors', 'totalStaffNurses', 'totalStaffAdmin',
  'staffTrainedCompliance', 'totalStaffRequiredToTrain', 'staffLeft', 'avgTotalStaffCount',
  'approvedCadre', 'sickLeaveDays', 'totalScheduledWorkingDays', 'staffWithValidCpd', 'totalClinicalStaff',
] as const;

/**
 * Pool raw rows across units for one period into a synthetic 'all' row.
 * Numeric fields are summed over the units that reported them;
 * daysInPeriod is the period length (max across rows).
 */
export function poolRowsForAllUnit(rows: RawPeriodRow[]): RawPeriodRow | null {
  if (rows.length === 0) return null;
  const pooled: RawPeriodRow = {
    unitId: 'all',
    entryDate: rows.reduce((max, r) => (r.entryDate > max ? r.entryDate : max), rows[0].entryDate),
    month: rows[0].month,
    periodLabel: rows[0].periodLabel,
    grain: rows[0].grain,
    periodStart: rows[0].periodStart,
    periodEnd: rows[0].periodEnd,
    daysInPeriod: Math.max(...rows.map((r) => r.daysInPeriod)),
  };
  const acc = pooled as unknown as Record<string, number | undefined>;
  for (const field of POOLED_FIELDS) {
    let sum = 0;
    let seen = false;
    for (const row of rows) {
      const v = (row as unknown as Record<string, number | undefined>)[field];
      if (has(v)) {
        sum += v;
        seen = true;
      }
    }
    if (seen) acc[field] = sum;
  }
  return pooled;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function deriveFromRow(row: RawPeriodRow): Observation[] {
  const out: Observation[] = [];
  for (const [metricId, rule] of Object.entries(RULES)) {
    const point = rule(row);
    if (!point) continue;
    out.push({
      metricId,
      unitId: row.unitId,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      grain: row.grain,
      value: round4(point.value),
      numerator: point.numerator,
      denominator: point.denominator,
      source: row.source ?? 'sample',
      qualityFlag: 'ok',
    });
  }
  return out;
}

/**
 * Derive all KPI observations from raw data-entry rows.
 * Rows with unitId 'all' in the input are ignored (the 'all' unit is always
 * re-derived here by pooling the real units per period).
 */
export function deriveObservations(rawRows: RawPeriodRow[]): Observation[] {
  const unitRows = rawRows.filter((r) => r.unitId !== 'all');
  const observations: Observation[] = [];
  for (const row of unitRows) observations.push(...deriveFromRow(row));

  // pool per period (periodStart+periodEnd identifies the period uniquely)
  const byPeriod = new Map<string, RawPeriodRow[]>();
  for (const row of unitRows) {
    const key = `${row.grain}|${row.periodStart}|${row.periodEnd}`;
    const g = byPeriod.get(key) ?? [];
    g.push(row);
    byPeriod.set(key, g);
  }
  for (const rows of byPeriod.values()) {
    const pooled = poolRowsForAllUnit(rows);
    if (pooled) observations.push(...deriveFromRow(pooled));
  }
  return observations;
}
