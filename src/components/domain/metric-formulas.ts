import type { Metric } from '@/types/dcl';

/**
 * Plain-language derivation lines for every KPI, mirroring the formulas in
 * src/lib/indicators/derive.ts (which this UI layer must not edit). Shown in
 * the MetricDetailDrawer as a "Calculated from raw entries" caption so users
 * can trace each indicator back to the Excel monthly-return fields.
 */
const METRIC_FORMULAS: Record<string, string> = {
  // ── Clinical Outcome ───────────────────────────────────────────────
  'mortality-rate': 'Total Deaths ÷ Total Discharges × 100',
  'hospital-daily-deaths': 'Total Deaths ÷ Days in Period',
  'readmission-rate': '30-day Readmissions ÷ Total Discharges × 100',
  'avg-length-of-stay': 'Total Inpatient Days ÷ Total Discharges',
  'ssi-rate': 'Surgical Site Infections ÷ All Surgeries (major + minor + cataract + other) × 100',
  'surgeries-major': 'Major Surgeries as entered (count)',
  'surgeries-minor': 'Minor Surgeries as entered (count)',
  'surgeries-cataract': 'Cataract Surgeries as entered (count)',
  // ── Patient Safety ─────────────────────────────────────────────────
  'medication-error-rate': 'Medication Errors ÷ Doses Administered × 1,000',
  'patient-fall-rate': 'Patient Falls ÷ Inpatient Days × 1,000',
  'pressure-ulcer-incidence': 'New Pressure Ulcers ÷ At-risk Patients × 100',
  'needle-stick-injury-rate': 'Needle Stick Injuries ÷ Staff Shifts × 1,000',
  // ── Financial Efficiency (LKR) ─────────────────────────────────────
  'cost-per-patient-day': 'Total Operating Expenses ÷ Total Inpatient Days (LKR)',
  'petty-cash-utilization': 'Petty Cash Expenditure ÷ Petty Cash Allocation × 100',
  'local-purchase-expenditure': 'Local Purchase Expenditure as entered (LKR)',
  'fuel-expenditure': 'Fuel Expenditure as entered (LKR)',
  'electricity-bill': 'Electricity Bill as entered (LKR)',
  'water-bill': 'Water Bill as entered (LKR)',
  'stock-out-rate': 'Days with Zero Stock ÷ Days in Period × 100',
  // ── Operational Efficiency ─────────────────────────────────────────
  'bed-occupancy-rate': 'Total Inpatient Days ÷ (Available Beds × Days in Period) × 100',
  'theatre-utilization-rate': 'Theatre Hours Used ÷ Theatre Hours Available × 100',
  'opd-avg-wait-time': 'Total OPD Wait Minutes ÷ OPD Patients',
  'diagnostic-turnaround-time': 'Diagnostic Turnaround Minutes ÷ Diagnostics Ordered',
  // ── HR Development ─────────────────────────────────────────────────
  'training-programs-conducted': 'Training Programmes Conducted as entered (count)',
  'staff-turnover-rate': 'Staff Left ÷ Average Headcount × 100 (per staff-week)',
  'absenteeism-rate': 'Sick-leave Days ÷ Scheduled Working Days × 100',
  'cpd-participation-rate': 'Staff with Valid CPD ÷ Total Clinical Staff × 100',
};

/** Plain-language derivation line for a metric; undefined-safe fallback. */
export function metricFormula(metric: Metric): string {
  return METRIC_FORMULAS[metric.id] ?? 'Derived from raw period rows';
}

/**
 * Compact axis-tick formatting for UI-owned charts: LKR amounts compact to
 * e.g. 'LKR 2.4M', large counts to '12k'. Full precision stays in tooltips
 * via formatMetricValue from the data core.
 */
export function formatMetricTick(metric: Metric, value: number): string {
  const abs = Math.abs(value);
  const compact = (div: number, suffix: string) =>
    `${(value / div).toLocaleString('en-LK', { maximumFractionDigits: 1 })}${suffix}`;
  if (metric.unitLabel === 'LKR') {
    if (abs >= 1_000_000) return `LKR ${compact(1_000_000, 'M')}`;
    if (abs >= 10_000) return `LKR ${compact(1_000, 'k')}`;
    return `LKR ${value.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
  }
  if (abs >= 1_000_000) return compact(1_000_000, 'M');
  if (abs >= 10_000) return compact(1_000, 'k');
  return value.toLocaleString('en-LK', {
    minimumFractionDigits: metric.precision,
    maximumFractionDigits: metric.precision,
  });
}
