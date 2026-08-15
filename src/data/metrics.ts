import type { Metric } from '@/types/dcl';

/**
 * The DCL performance metrics — 27 KPIs derived from raw data-entry rows
 * (see src/lib/indicators/derive.ts). District General Hospital, Sri Lanka:
 * all monetary values are LKR.
 *
 * Volume/amount indicators (surgery counts, LKR spend lines, training
 * programmes) use polarity 'volume' + weight 0: they render as i-charts for
 * context but are excluded from composite domain scores.
 */
export const METRICS: Metric[] = [
  // ── Clinical Outcome (8) ───────────────────────────────────────────
  {
    id: 'mortality-rate', domainId: 'clinical-outcome', name: 'Mortality Rate', shortName: 'Mortality',
    description: 'In-hospital deaths as a percentage of discharges.',
    unitLabel: '%', polarity: 'lower', target: 2.4, spcMethod: 'p-chart', precision: 2, weight: 1, active: true,
  },
  {
    id: 'hospital-daily-deaths', domainId: 'clinical-outcome', name: 'Hospital Daily Deaths', shortName: 'Deaths/day',
    description: 'In-hospital deaths per day, averaged over the reporting period.',
    unitLabel: 'deaths/day', polarity: 'lower', target: 0.6, spcMethod: 'i-chart', precision: 2, weight: 1, active: true,
  },
  {
    id: 'readmission-rate', domainId: 'clinical-outcome', name: 'Readmission Rate', shortName: 'Readmission',
    description: '30-day unplanned readmissions as a percentage of discharges.',
    unitLabel: '%', polarity: 'lower', target: 8.0, spcMethod: 'p-chart', precision: 1, weight: 1, active: true,
  },
  {
    id: 'avg-length-of-stay', domainId: 'clinical-outcome', name: 'Avg Length of Stay', shortName: 'Stay length',
    description: 'Average inpatient length of stay in days.',
    unitLabel: 'days', polarity: 'lower', target: 4.5, spcMethod: 'i-chart', precision: 1, weight: 1, active: true,
  },
  {
    id: 'ssi-rate', domainId: 'clinical-outcome', name: 'Surgical Site Infection Rate', shortName: 'SSI',
    description: 'Surgical site infections as a percentage of all procedures.',
    unitLabel: '%', polarity: 'lower', target: 1.8, spcMethod: 'p-chart', precision: 2, weight: 1, active: true,
  },
  {
    id: 'surgeries-major', domainId: 'clinical-outcome', name: 'Major Surgeries', shortName: 'Major surg.',
    description: 'Number of major surgical procedures performed (volume indicator).',
    unitLabel: 'surgeries', polarity: 'volume', target: null, spcMethod: 'i-chart', precision: 0, weight: 0, rollup: 'sum', active: true,
  },
  {
    id: 'surgeries-minor', domainId: 'clinical-outcome', name: 'Minor Surgeries', shortName: 'Minor surg.',
    description: 'Number of minor surgical procedures performed (volume indicator).',
    unitLabel: 'surgeries', polarity: 'volume', target: null, spcMethod: 'i-chart', precision: 0, weight: 0, rollup: 'sum', active: true,
  },
  {
    id: 'surgeries-cataract', domainId: 'clinical-outcome', name: 'Cataract Surgeries', shortName: 'Cataract',
    description: 'Number of cataract procedures performed (volume indicator).',
    unitLabel: 'surgeries', polarity: 'volume', target: null, spcMethod: 'i-chart', precision: 0, weight: 0, rollup: 'sum', active: true,
  },
  // ── Patient Safety (4) ─────────────────────────────────────────────
  {
    id: 'medication-error-rate', domainId: 'patient-safety', name: 'Medication Error Rate', shortName: 'Med errors',
    description: 'Medication errors per 1,000 doses administered.',
    unitLabel: 'per 1,000 doses', polarity: 'lower', target: 2.0, spcMethod: 'u-chart', precision: 2, weight: 1, active: true,
  },
  {
    id: 'patient-fall-rate', domainId: 'patient-safety', name: 'Patient Fall Rate', shortName: 'Falls',
    description: 'Patient falls per 1,000 patient days.',
    unitLabel: 'per 1,000 patient days', polarity: 'lower', target: 3.0, spcMethod: 'u-chart', precision: 2, weight: 1, active: true,
  },
  {
    id: 'pressure-ulcer-incidence', domainId: 'patient-safety', name: 'Pressure Ulcer Incidence', shortName: 'Ulcers',
    description: 'Hospital-acquired pressure ulcers as a percentage of at-risk patients.',
    unitLabel: '%', polarity: 'lower', target: 1.5, spcMethod: 'p-chart', precision: 2, weight: 1, active: true,
  },
  {
    id: 'needle-stick-injury-rate', domainId: 'patient-safety', name: 'Needle Stick Injury Rate', shortName: 'Needle-stick',
    description: 'Needle stick injuries per 1,000 staff shifts.',
    unitLabel: 'per 1,000 shifts', polarity: 'lower', target: 0.8, spcMethod: 'u-chart', precision: 2, weight: 1, active: true,
  },
  // ── Financial Efficiency (7, all LKR) ──────────────────────────────
  {
    id: 'cost-per-patient-day', domainId: 'financial-efficiency', name: 'Cost per Patient Day', shortName: 'Cost/day',
    description: 'Total operating expenditure divided by inpatient days (LKR).',
    unitLabel: 'LKR', polarity: 'lower', target: 12000, spcMethod: 'i-chart', precision: 0, weight: 1, active: true,
  },
  {
    id: 'petty-cash-utilization', domainId: 'financial-efficiency', name: 'Petty Cash Utilization', shortName: 'Petty cash',
    description:
      'Petty cash expenditure as a percentage of the period allocation (i-chart: utilization is overdispersed relative to the binomial model, so moving-range limits are used).',
    unitLabel: '%', polarity: 'lower', target: 100, spcMethod: 'i-chart', precision: 1, weight: 1, active: true,
  },
  {
    id: 'local-purchase-expenditure', domainId: 'financial-efficiency', name: 'Local Purchase Expenditure', shortName: 'Local purch.',
    description: 'Expenditure on local purchases (LKR, volume/cost indicator).',
    unitLabel: 'LKR', polarity: 'volume', target: null, spcMethod: 'i-chart', precision: 0, weight: 0, rollup: 'sum', active: true,
  },
  {
    id: 'fuel-expenditure', domainId: 'financial-efficiency', name: 'Fuel Expenditure', shortName: 'Fuel',
    description: 'Fuel expenditure (LKR, volume/cost indicator).',
    unitLabel: 'LKR', polarity: 'volume', target: null, spcMethod: 'i-chart', precision: 0, weight: 0, rollup: 'sum', active: true,
  },
  {
    id: 'electricity-bill', domainId: 'financial-efficiency', name: 'Electricity Bill', shortName: 'Electricity',
    description: 'Electricity expenditure (LKR, volume/cost indicator).',
    unitLabel: 'LKR', polarity: 'volume', target: null, spcMethod: 'i-chart', precision: 0, weight: 0, rollup: 'sum', active: true,
  },
  {
    id: 'water-bill', domainId: 'financial-efficiency', name: 'Water Bill', shortName: 'Water',
    description: 'Water expenditure (LKR, volume/cost indicator).',
    unitLabel: 'LKR', polarity: 'volume', target: null, spcMethod: 'i-chart', precision: 0, weight: 0, rollup: 'sum', active: true,
  },
  {
    id: 'stock-out-rate', domainId: 'financial-efficiency', name: 'Stock-out Rate', shortName: 'Stock-outs',
    description: 'Days with at least one critical item at zero stock, as a percentage of days in the period.',
    unitLabel: '%', polarity: 'lower', target: 5.0, spcMethod: 'p-chart', precision: 1, weight: 1, active: true,
  },
  // ── Operational Efficiency (4) ─────────────────────────────────────
  {
    id: 'bed-occupancy-rate', domainId: 'operational-efficiency', name: 'Bed Occupancy Rate', shortName: 'Occupancy',
    description: 'Occupied bed days as a percentage of available bed days.',
    unitLabel: '%', polarity: 'range', target: null, targetMin: 75, targetMax: 88, spcMethod: 'p-chart', precision: 1, weight: 1, active: true,
  },
  {
    id: 'theatre-utilization-rate', domainId: 'operational-efficiency', name: 'Theatre Utilization Rate', shortName: 'Theatre',
    description: 'Used theatre hours as a percentage of available theatre hours.',
    unitLabel: '%', polarity: 'range', target: null, targetMin: 70, targetMax: 85, spcMethod: 'p-chart', precision: 1, weight: 1, active: true,
  },
  {
    id: 'opd-avg-wait-time', domainId: 'operational-efficiency', name: 'OPD Avg Wait Time', shortName: 'OPD wait',
    description: 'Average outpatient waiting time in minutes.',
    unitLabel: 'min', polarity: 'lower', target: 30, spcMethod: 'i-chart', precision: 0, weight: 1, active: true,
  },
  {
    id: 'diagnostic-turnaround-time', domainId: 'operational-efficiency', name: 'Diagnostic Turnaround Time', shortName: 'Turnaround',
    description: 'Average minutes from diagnostic order to verified result.',
    unitLabel: 'min', polarity: 'lower', target: 120, spcMethod: 'i-chart', precision: 0, weight: 1, active: true,
  },
  // ── HR Development (4) ─────────────────────────────────────────────
  {
    id: 'training-programs-conducted', domainId: 'hr-development', name: 'Training Programs Conducted', shortName: 'Training prog.',
    description: 'Number of training programmes conducted in the period (volume indicator).',
    unitLabel: 'programs', polarity: 'volume', target: null, spcMethod: 'i-chart', precision: 0, weight: 0, rollup: 'sum', active: true,
  },
  {
    id: 'staff-turnover-rate', domainId: 'hr-development', name: 'Staff Turnover Rate', shortName: 'Turnover',
    description:
      'Leavers as a percentage of average headcount per staff-week (grain-independent; ×52 ≈ annualised, e.g. 0.17% ≈ 9%/yr).',
    unitLabel: '%', polarity: 'lower', target: 0.2, spcMethod: 'p-chart', precision: 2, weight: 1, active: true,
  },
  {
    id: 'absenteeism-rate', domainId: 'hr-development', name: 'Absenteeism Rate', shortName: 'Absence',
    description: 'Sick-leave days as a percentage of scheduled working days.',
    unitLabel: '%', polarity: 'lower', target: 4, spcMethod: 'p-chart', precision: 1, weight: 1, active: true,
  },
  {
    id: 'cpd-participation-rate', domainId: 'hr-development', name: 'CPD Participation Rate', shortName: 'CPD',
    description: 'Clinical staff with valid CPD as a percentage of all clinical staff.',
    unitLabel: '%', polarity: 'higher', target: 75, spcMethod: 'p-chart', precision: 1, weight: 1, active: true,
  },
];

export const METRIC_MAP: Record<string, Metric> = Object.fromEntries(METRICS.map((m) => [m.id, m]));

export function metricById(id: string): Metric | undefined {
  return METRIC_MAP[id];
}

/** Format a metric value with its precision and unit label (currency: LKR). */
export function formatMetricValue(metric: Metric, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const formatted = value.toLocaleString('en-LK', {
    minimumFractionDigits: metric.precision,
    maximumFractionDigits: metric.precision,
  });
  if (metric.unitLabel === '%') return `${formatted}%`;
  if (metric.unitLabel === 'LKR') return `LKR ${formatted}`;
  return `${formatted} ${metric.unitLabel}`;
}
