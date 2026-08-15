import { z } from 'zod';
import { UNIT_MAP } from '@/data/units';
import type { DomainId, RawPeriodRow } from '@/types/dcl';

/**
 * Zod schema for the RAW data-entry import (v2 data core).
 *
 * One imported row = one `RawPeriodRow` (one unit × one week or month).
 * All KPI indicators are DERIVED from these rows by
 * `src/lib/indicators/derive.ts` — importers never enter indicator values.
 *
 * Structural validation lives here; soft semantic checks (deaths >
 * discharges, occupancy > 100%, …) live in
 * `src/lib/excel/normalize-rows.ts` so they can emit warnings instead of
 * blocking the row.
 */

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const grainSchema = z.enum(['week', 'month']);

// ── Field specification (drives the template, aliases and docs) ─────────────

export interface RawFieldSpec {
  /** exact RawPeriodRow field name */
  field: keyof RawPeriodRow;
  /** friendly Excel header */
  header: string;
  group: 'identity' | DomainId;
  groupLabel: string;
  type: 'text' | 'integer' | 'number' | 'currency' | 'date' | 'month' | 'enum';
  required: boolean;
  example: string;
  rules: string;
}

const IDENTITY = 'Unit & period';
const GROUP_LABELS: Record<RawFieldSpec['group'], string> = {
  identity: IDENTITY,
  'clinical-outcome': '1. Clinical Outcome',
  'patient-safety': '2. Patient Safety',
  'financial-efficiency': '3. Financial Efficiency (LKR)',
  'operational-efficiency': '4. Operational Efficiency',
  'hr-development': '5. HR Development',
};

type SpecInput = Omit<RawFieldSpec, 'groupLabel'>;

const SPEC_INPUT: SpecInput[] = [
  // ── Identity / period ──────────────────────────────────────────────
  { field: 'unitId', header: 'Unit of the Institution', group: 'identity', type: 'enum', required: true, example: 'surgical', rules: 'Dropdown. One of: ed, icu, medical, surgical, maternity, outpatient (unit names also accepted). Never "all" — the all-units view is calculated automatically.' },
  { field: 'entryDate', header: 'Date of Data Entry', group: 'identity', type: 'date', required: false, example: '2026-02-02', rules: 'YYYY-MM-DD. The day this return was filled in. Defaults to the period end if left blank.' },
  { field: 'month', header: 'Month', group: 'identity', type: 'month', required: true, example: 'Jan 2026', rules: 'Calendar month of the period, e.g. "Jan 2026" or 2026-01. When Period Start/End are left blank, they are derived as the first–last day of this month.' },
  { field: 'periodLabel', header: 'Reporting Period (e.g. Week 1, Jan 2026)', group: 'identity', type: 'text', required: false, example: 'Week 1, Jan 2026', rules: 'Human-readable label. Auto-filled from the dates when blank.' },
  { field: 'grain', header: 'Grain (Week/Month)', group: 'identity', type: 'enum', required: true, example: 'Month', rules: 'Dropdown: Week or Month. Weekly and monthly rows may be mixed in one file.' },
  { field: 'periodStart', header: 'Period Start (YYYY-MM-DD)', group: 'identity', type: 'date', required: true, example: '2026-01-01', rules: 'YYYY-MM-DD. Week periods start on Monday. May be left blank when Month is given (derived as the 1st of the month).' },
  { field: 'periodEnd', header: 'Period End (YYYY-MM-DD)', group: 'identity', type: 'date', required: true, example: '2026-01-31', rules: 'YYYY-MM-DD, on or after Period Start. May be left blank when Month is given (derived as the last day of the month).' },
  { field: 'daysInPeriod', header: 'Days in Period', group: 'identity', type: 'integer', required: true, example: '31', rules: 'Whole number 1–31, matching the period length (7 for a week, 28–31 for a month).' },

  // ── 1. Clinical Outcome ────────────────────────────────────────────
  { field: 'totalAdmissions', header: 'Total Admissions', group: 'clinical-outcome', type: 'integer', required: false, example: '520', rules: 'Number of patients admitted in the period.' },
  { field: 'totalDischarges', header: 'Total Discharges', group: 'clinical-outcome', type: 'integer', required: false, example: '515', rules: 'Number of patients discharged (including deaths).' },
  { field: 'totalDeaths', header: 'Total Deaths', group: 'clinical-outcome', type: 'integer', required: false, example: '12', rules: 'In-hospital deaths in the period. Should not exceed Total Discharges.' },
  { field: 'totalInpatientDays', header: 'Total Inpatient Days', group: 'clinical-outcome', type: 'integer', required: false, example: '2266', rules: 'Sum of bed-days occupied. Should not exceed Available Beds × Days in Period.' },
  { field: 'readmissions30d', header: 'Patients Readmitted (30 Days)', group: 'clinical-outcome', type: 'integer', required: false, example: '38', rules: 'Unplanned readmissions within 30 days of discharge.' },
  { field: 'surgeriesMajor', header: 'Total Surgeries (Major)', group: 'clinical-outcome', type: 'integer', required: false, example: '85', rules: 'Major surgical procedures.' },
  { field: 'surgeriesMinor', header: 'Total Surgeries (Minor)', group: 'clinical-outcome', type: 'integer', required: false, example: '140', rules: 'Minor surgical procedures.' },
  { field: 'surgeriesCataract', header: 'Total Surgeries (Cataract)', group: 'clinical-outcome', type: 'integer', required: false, example: '60', rules: 'Cataract procedures (incl. camps).' },
  { field: 'surgeriesOther', header: 'Total Surgeries (Other)', group: 'clinical-outcome', type: 'integer', required: false, example: '25', rules: 'Procedures not classed major/minor/cataract.' },
  { field: 'surgicalSiteInfections', header: 'Surgical Site Infections', group: 'clinical-outcome', type: 'integer', required: false, example: '3', rules: 'SSIs detected; should not exceed total surgeries.' },

  // ── 2. Patient Safety ──────────────────────────────────────────────
  { field: 'patientFalls', header: 'Total Patient Falls', group: 'patient-safety', type: 'integer', required: false, example: '4', rules: 'Inpatient falls in the period.' },
  { field: 'adverseDrugReactions', header: 'Adverse Drug Reactions', group: 'patient-safety', type: 'integer', required: false, example: '9', rules: 'ADRs reported in the period.' },
  { field: 'newPressureUlcers', header: 'New Pressure Ulcers', group: 'patient-safety', type: 'integer', required: false, example: '2', rules: 'Hospital-acquired pressure ulcers.' },
  { field: 'patientsAtRiskUlcers', header: 'Patients at Risk for Ulcers', group: 'patient-safety', type: 'integer', required: false, example: '120', rules: 'Patients assessed at risk (denominator for ulcer incidence).' },
  { field: 'medicationErrors', header: 'Medication Errors', group: 'patient-safety', type: 'integer', required: false, example: '18', rules: 'Medication errors reported.' },
  { field: 'totalDosesAdministered', header: 'Total Doses Administered', group: 'patient-safety', type: 'integer', required: false, example: '45,000', rules: 'Total medication doses given (denominator for error rate).' },
  { field: 'needleStickInjuries', header: 'Needle Stick Injuries', group: 'patient-safety', type: 'integer', required: false, example: '1', rules: 'Sharps injuries among staff.' },
  { field: 'totalStaffShifts', header: 'Total Staff Shifts', group: 'patient-safety', type: 'integer', required: false, example: '620', rules: 'Staff shifts worked (denominator for needle-stick rate).' },

  // ── 3. Financial Efficiency (LKR) ──────────────────────────────────
  { field: 'pettyCashAllocation', header: 'Petty Cash Allocation (LKR)', group: 'financial-efficiency', type: 'currency', required: false, example: '150,000', rules: 'LKR. Petty cash allocated for the period.' },
  { field: 'pettyCashExpenditure', header: 'Petty Cash Expenditure (LKR)', group: 'financial-efficiency', type: 'currency', required: false, example: '142,500', rules: 'LKR. Petty cash actually spent (≈ allocation expected).' },
  { field: 'localPurchaseExpenditure', header: 'Local Purchase Expenditure (LKR)', group: 'financial-efficiency', type: 'currency', required: false, example: '850,000', rules: 'LKR spent on local purchases.' },
  { field: 'fuelExpenditure', header: 'Fuel Expenditure (LKR)', group: 'financial-efficiency', type: 'currency', required: false, example: '420,000', rules: 'LKR spent on fuel (generators, vehicles).' },
  { field: 'electricityBill', header: 'Electricity Bill (LKR)', group: 'financial-efficiency', type: 'currency', required: false, example: '1,250,000', rules: 'LKR electricity charges.' },
  { field: 'waterBill', header: 'Water Bill (LKR)', group: 'financial-efficiency', type: 'currency', required: false, example: '380,000', rules: 'LKR water charges.' },
  { field: 'otherOperatingExpenses', header: 'Other Operating Expenses (LKR)', group: 'financial-efficiency', type: 'currency', required: false, example: '950,000', rules: 'LKR other recurrent operating costs.' },
  { field: 'totalOperatingExpenses', header: 'Total Operating Expenses (LKR)', group: 'financial-efficiency', type: 'currency', required: false, example: '27,190,000', rules: 'LKR. Total recurrent operating expenditure (used for Cost per Patient Day).' },
  { field: 'totalBudgetedExpenditure', header: 'Total Budgeted Expenditure (LKR)', group: 'financial-efficiency', type: 'currency', required: false, example: '28,500,000', rules: 'LKR. Budgeted expenditure for the period.' },
  { field: 'totalActualExpenditure', header: 'Total Actual Expenditure (LKR)', group: 'financial-efficiency', type: 'currency', required: false, example: '28,200,000', rules: 'LKR. Actual expenditure for the period.' },
  { field: 'totalRevenue', header: 'Total Revenue (LKR)', group: 'financial-efficiency', type: 'currency', required: false, example: '3,100,000', rules: 'LKR collected (payments, lab fees, etc.).' },
  { field: 'daysWithZeroStock', header: 'Days with Zero Stock', group: 'financial-efficiency', type: 'integer', required: false, example: '1', rules: 'Days on which at least one critical item was out of stock (0–days in period).' },

  // ── 4. Operational Efficiency ──────────────────────────────────────
  { field: 'availableBeds', header: 'Available Beds', group: 'operational-efficiency', type: 'integer', required: false, example: '30', rules: 'Functional beds in the unit during the period.' },
  { field: 'theatreHoursUsed', header: 'Theatre Hours Used', group: 'operational-efficiency', type: 'number', required: false, example: '96', rules: 'Hours of theatre time actually used.' },
  { field: 'theatreHoursAvailable', header: 'Total Theatre Hours Available', group: 'operational-efficiency', type: 'number', required: false, example: '120', rules: 'Rostered theatre hours.' },
  { field: 'totalOpdWaitMinutes', header: 'Total OPD Wait Time (Minutes)', group: 'operational-efficiency', type: 'number', required: false, example: '36,000', rules: 'Sum of outpatient waiting minutes (used with Total OPD Patients).' },
  { field: 'totalOpdPatients', header: 'Total OPD Patients', group: 'operational-efficiency', type: 'integer', required: false, example: '1,800', rules: 'Outpatient visits in the period.' },
  { field: 'totalDiagnosticTatMinutes', header: 'Total Diagnostic Turnaround Time (Minutes)', group: 'operational-efficiency', type: 'number', required: false, example: '180,000', rules: 'Sum of order-to-result minutes across diagnostics.' },
  { field: 'totalDiagnosticsOrdered', header: 'Total Diagnostics Ordered', group: 'operational-efficiency', type: 'integer', required: false, example: '1,500', rules: 'Diagnostic tests ordered in the period.' },

  // ── 5. HR Development ──────────────────────────────────────────────
  { field: 'trainingProgramsConducted', header: 'Training Programs Conducted', group: 'hr-development', type: 'integer', required: false, example: '2', rules: 'Training programmes run in the period.' },
  { field: 'collectiveCpdPoints', header: 'Collective CPD Points', group: 'hr-development', type: 'number', required: false, example: '45', rules: 'Total CPD points earned by staff.' },
  { field: 'staffTrainedDoctors', header: 'Staff Trained - Doctors', group: 'hr-development', type: 'integer', required: false, example: '8', rules: 'Doctors who completed training.' },
  { field: 'staffTrainedNurses', header: 'Staff Trained - Nurses', group: 'hr-development', type: 'integer', required: false, example: '22', rules: 'Nurses who completed training.' },
  { field: 'staffTrainedAdmin', header: 'Staff Trained - Admin', group: 'hr-development', type: 'integer', required: false, example: '3', rules: 'Admin/allied staff who completed training.' },
  { field: 'totalStaffDoctors', header: 'Total Staff - Doctors', group: 'hr-development', type: 'integer', required: false, example: '12', rules: 'Doctors in post.' },
  { field: 'totalStaffNurses', header: 'Total Staff - Nurses', group: 'hr-development', type: 'integer', required: false, example: '45', rules: 'Nurses in post.' },
  { field: 'totalStaffAdmin', header: 'Total Staff - Admin', group: 'hr-development', type: 'integer', required: false, example: '10', rules: 'Admin/allied staff in post.' },
  { field: 'staffTrainedCompliance', header: 'Staff Trained (Compliance)', group: 'hr-development', type: 'integer', required: false, example: '30', rules: 'Staff compliant with mandatory training.' },
  { field: 'totalStaffRequiredToTrain', header: 'Total Staff Required to Train', group: 'hr-development', type: 'integer', required: false, example: '60', rules: 'Staff who must complete mandatory training.' },
  { field: 'staffLeft', header: 'Staff Left/Resigned', group: 'hr-development', type: 'integer', required: false, example: '1', rules: 'Leavers/resignations/transfers out in the period.' },
  { field: 'avgTotalStaffCount', header: 'Average Total Staff Count', group: 'hr-development', type: 'number', required: false, example: '67', rules: 'Average headcount over the period.' },
  { field: 'approvedCadre', header: 'Approved Cadre Requirement', group: 'hr-development', type: 'integer', required: false, example: '75', rules: 'Approved cadre for the unit.' },
  { field: 'sickLeaveDays', header: 'Sick Leave Days', group: 'hr-development', type: 'integer', required: false, example: '45', rules: 'Staff sick-leave days taken.' },
  { field: 'totalScheduledWorkingDays', header: 'Total Scheduled Working Days', group: 'hr-development', type: 'integer', required: false, example: '1,742', rules: 'Scheduled staff working days (denominator for absenteeism).' },
  { field: 'staffWithValidCpd', header: 'Staff with Valid CPD', group: 'hr-development', type: 'integer', required: false, example: '40', rules: 'Clinical staff holding valid CPD.' },
  { field: 'totalClinicalStaff', header: 'Total Clinical Staff', group: 'hr-development', type: 'integer', required: false, example: '57', rules: 'Clinical staff in post (denominator for CPD participation).' },
];

export const FIELD_SPECS: RawFieldSpec[] = SPEC_INPUT.map((s) => ({ ...s, groupLabel: GROUP_LABELS[s.group] }));

/** Canonical raw-row fields in template column order. */
export const RAW_FIELDS = FIELD_SPECS.map((s) => s.field);

export type RawField = (typeof RAW_FIELDS)[number];

/** The 54 numeric data-entry fields (everything except identity/period). */
export const DATA_FIELDS = FIELD_SPECS.filter(
  (s) => s.group !== 'identity' && (s.type === 'integer' || s.type === 'number' || s.type === 'currency'),
).map((s) => s.field);

/** LKR-denominated fields (for '#,##0' formatting + docs). */
export const CURRENCY_FIELDS = FIELD_SPECS.filter((s) => s.type === 'currency').map((s) => s.field);

/** Columns that must be mappable before any row can validate. */
export const REQUIRED_FIELDS: RawField[] = ['unitId', 'grain', 'daysInPeriod'];

/** Field groups for the schema preview / quality dashboard. */
export const FIELD_GROUPS: { group: RawFieldSpec['group']; label: string; fields: RawFieldSpec[] }[] = (
  ['identity', 'clinical-outcome', 'patient-safety', 'financial-efficiency', 'operational-efficiency', 'hr-development'] as const
).map((group) => ({
  group,
  label: GROUP_LABELS[group],
  fields: FIELD_SPECS.filter((s) => s.group === group),
}));

// ── Row schema ────────────────────────────────────────────────────────────────

const dataValue = (label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .finite(`${label} must be a finite number`)
    .min(0, `${label} cannot be negative`)
    .optional();

function daysBetweenInclusive(start: string, end: string): number {
  const ms = Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z');
  return Math.round(ms / 86400000) + 1;
}

const dataFieldShape = Object.fromEntries(DATA_FIELDS.map((f) => [f, dataValue(f)]));

export const rawRowSchema = z
  .object({
    unitId: z.string().trim().min(1, 'Unit of the Institution is required'),
    grain: grainSchema,
    entryDate: z.string().trim().regex(ISO_DATE_RE, 'Date of Data Entry must be YYYY-MM-DD').optional(),
    month: z.string().trim().regex(MONTH_RE, 'Month must look like "Jan 2026" or 2026-01').optional(),
    periodLabel: z.string().trim().optional(),
    periodStart: z.string().trim().regex(ISO_DATE_RE, 'Period Start must be YYYY-MM-DD (or provide Month)'),
    periodEnd: z.string().trim().regex(ISO_DATE_RE, 'Period End must be YYYY-MM-DD (or provide Month)'),
    daysInPeriod: z
      .number({ error: 'Days in Period must be a number' })
      .int('Days in Period must be a whole number')
      .min(1, 'Days in Period must be at least 1')
      .max(31, 'Days in Period cannot exceed 31'),
    ...dataFieldShape,
  })
  .superRefine((row, ctx) => {
    const unit = UNIT_MAP[row.unitId];
    if (!unit) {
      ctx.addIssue({ code: 'custom', path: ['unitId'], message: `Unknown unit "${row.unitId}"` });
    } else if (unit.id === 'all') {
      ctx.addIssue({
        code: 'custom',
        path: ['unitId'],
        message: '"all" is not a data-entry unit — it is calculated automatically. Enter one row per real unit.',
      });
    }
    if (ISO_DATE_RE.test(row.periodStart) && ISO_DATE_RE.test(row.periodEnd)) {
      if (row.periodEnd < row.periodStart) {
        ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Period End must be on or after Period Start' });
      } else {
        const len = daysBetweenInclusive(row.periodStart, row.periodEnd);
        if (Math.abs(row.daysInPeriod - len) > 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['daysInPeriod'],
            message: `Days in Period (${row.daysInPeriod}) does not match the period length (${len} days from ${row.periodStart} to ${row.periodEnd})`,
          });
        }
      }
    }
    const hasData = DATA_FIELDS.some((f) => typeof (row as Record<string, unknown>)[f] === 'number');
    if (!hasData) {
      ctx.addIssue({
        code: 'custom',
        path: ['daysInPeriod'],
        message: 'Row has no data: fill in at least one numeric data column (or delete the row)',
      });
    }
  });

export type RawRowInput = z.infer<typeof rawRowSchema>;

// ── Derived indicator documentation (auto-calculated by the dashboard) ───────

export interface DerivedIndicatorDoc {
  metricId: string;
  name: string;
  domainId: DomainId;
  formula: string;
  unitLabel: string;
}

export const DERIVED_INDICATORS: DerivedIndicatorDoc[] = [
  // Clinical Outcome
  { metricId: 'mortality-rate', name: 'Mortality Rate', domainId: 'clinical-outcome', formula: 'Total Deaths ÷ Total Discharges × 100', unitLabel: '%' },
  { metricId: 'hospital-daily-deaths', name: 'Hospital Daily Deaths', domainId: 'clinical-outcome', formula: 'Total Deaths ÷ Days in Period', unitLabel: 'deaths/day' },
  { metricId: 'readmission-rate', name: 'Readmission Rate', domainId: 'clinical-outcome', formula: 'Patients Readmitted (30 Days) ÷ Total Discharges × 100', unitLabel: '%' },
  { metricId: 'avg-length-of-stay', name: 'Avg Length of Stay', domainId: 'clinical-outcome', formula: 'Total Inpatient Days ÷ Total Discharges', unitLabel: 'days' },
  { metricId: 'ssi-rate', name: 'Surgical Site Infection Rate', domainId: 'clinical-outcome', formula: 'Surgical Site Infections ÷ (Major + Minor + Cataract + Other Surgeries) × 100', unitLabel: '%' },
  { metricId: 'surgeries-major', name: 'Major Surgeries', domainId: 'clinical-outcome', formula: 'Total Surgeries (Major)', unitLabel: 'surgeries' },
  { metricId: 'surgeries-minor', name: 'Minor Surgeries', domainId: 'clinical-outcome', formula: 'Total Surgeries (Minor)', unitLabel: 'surgeries' },
  { metricId: 'surgeries-cataract', name: 'Cataract Surgeries', domainId: 'clinical-outcome', formula: 'Total Surgeries (Cataract)', unitLabel: 'surgeries' },
  // Patient Safety
  { metricId: 'patient-fall-rate', name: 'Patient Fall Rate', domainId: 'patient-safety', formula: 'Total Patient Falls ÷ Total Inpatient Days × 1,000', unitLabel: 'per 1,000 patient days' },
  { metricId: 'medication-error-rate', name: 'Medication Error Rate', domainId: 'patient-safety', formula: 'Medication Errors ÷ Total Doses Administered × 1,000', unitLabel: 'per 1,000 doses' },
  { metricId: 'pressure-ulcer-incidence', name: 'Pressure Ulcer Incidence', domainId: 'patient-safety', formula: 'New Pressure Ulcers ÷ Patients at Risk for Ulcers × 100', unitLabel: '%' },
  { metricId: 'needle-stick-injury-rate', name: 'Needle Stick Injury Rate', domainId: 'patient-safety', formula: 'Needle Stick Injuries ÷ Total Staff Shifts × 1,000', unitLabel: 'per 1,000 shifts' },
  // Financial Efficiency (LKR)
  { metricId: 'cost-per-patient-day', name: 'Cost per Patient Day', domainId: 'financial-efficiency', formula: 'Total Operating Expenses (LKR) ÷ Total Inpatient Days', unitLabel: 'LKR' },
  { metricId: 'petty-cash-utilization', name: 'Petty Cash Utilization', domainId: 'financial-efficiency', formula: 'Petty Cash Expenditure ÷ Petty Cash Allocation × 100', unitLabel: '%' },
  { metricId: 'local-purchase-expenditure', name: 'Local Purchase Expenditure', domainId: 'financial-efficiency', formula: 'Local Purchase Expenditure (LKR)', unitLabel: 'LKR' },
  { metricId: 'fuel-expenditure', name: 'Fuel Expenditure', domainId: 'financial-efficiency', formula: 'Fuel Expenditure (LKR)', unitLabel: 'LKR' },
  { metricId: 'electricity-bill', name: 'Electricity Bill', domainId: 'financial-efficiency', formula: 'Electricity Bill (LKR)', unitLabel: 'LKR' },
  { metricId: 'water-bill', name: 'Water Bill', domainId: 'financial-efficiency', formula: 'Water Bill (LKR)', unitLabel: 'LKR' },
  { metricId: 'stock-out-rate', name: 'Stock-out Rate', domainId: 'financial-efficiency', formula: 'Days with Zero Stock ÷ Days in Period × 100', unitLabel: '%' },
  // Operational Efficiency
  { metricId: 'bed-occupancy-rate', name: 'Bed Occupancy Rate', domainId: 'operational-efficiency', formula: 'Total Inpatient Days ÷ (Available Beds × Days in Period) × 100', unitLabel: '%' },
  { metricId: 'theatre-utilization-rate', name: 'Theatre Utilization Rate', domainId: 'operational-efficiency', formula: 'Theatre Hours Used ÷ Total Theatre Hours Available × 100', unitLabel: '%' },
  { metricId: 'opd-avg-wait-time', name: 'OPD Avg Wait Time', domainId: 'operational-efficiency', formula: 'Total OPD Wait Time (Minutes) ÷ Total OPD Patients', unitLabel: 'min' },
  { metricId: 'diagnostic-turnaround-time', name: 'Diagnostic Turnaround Time', domainId: 'operational-efficiency', formula: 'Total Diagnostic Turnaround Time (Minutes) ÷ Total Diagnostics Ordered', unitLabel: 'min' },
  // HR Development
  { metricId: 'training-programs-conducted', name: 'Training Programs Conducted', domainId: 'hr-development', formula: 'Training Programs Conducted', unitLabel: 'programs' },
  { metricId: 'staff-turnover-rate', name: 'Staff Turnover Rate', domainId: 'hr-development', formula: 'Staff Left/Resigned ÷ Average Total Staff Count × 100', unitLabel: '%' },
  { metricId: 'absenteeism-rate', name: 'Absenteeism Rate', domainId: 'hr-development', formula: 'Sick Leave Days ÷ Total Scheduled Working Days × 100', unitLabel: '%' },
  { metricId: 'cpd-participation-rate', name: 'CPD Participation Rate', domainId: 'hr-development', formula: 'Staff with Valid CPD ÷ Total Clinical Staff × 100', unitLabel: '%' },
];
