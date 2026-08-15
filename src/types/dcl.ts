/**
 * DCL Pulse — TypeScript types matching the JSON schema in design.md section 9.
 *
 * Data model (v2): the source of truth is RAW data-entry rows
 * (`RawPeriodRow` — one row per unit per reporting period, mirroring the
 * Excel monthly-return template). All KPI `Observation`s are DERIVED from
 * raw rows by `src/lib/indicators/derive.ts`.
 */

export type DomainId =
  | 'clinical-outcome'
  | 'patient-safety'
  | 'financial-efficiency'
  | 'operational-efficiency'
  | 'hr-development';

export type Grain = 'week' | 'month' | 'year';
export type TimeScale = Grain;

/**
 * 'volume' = pure activity/amount indicator (surgery counts, LKR spend,
 * training programmes): plotted on an i-chart for context but EXCLUDED from
 * composite scores (weight 0; `metricScore` returns 0).
 */
export type Polarity = 'lower' | 'higher' | 'range' | 'zero' | 'volume';
export type SPCMethod = 'p-chart' | 'u-chart' | 'i-chart';
export type QualityFlag = 'ok' | 'estimated' | 'missing-denominator' | 'outlier-reviewed';
export type ObservationSource = 'sample' | 'import';

export type DomainStatus = 'in-control' | 'watch' | 'action-needed' | 'no-signal';
export type SignalKind = 'special-cause' | 'run-rule';

export interface Hospital {
  id: string;
  name: string;
  currency: string;
  timezone?: string;
}

export interface Unit {
  id: string; // 'all' | 'ed' | 'icu' | 'medical' | 'surgical' | 'maternity' | 'outpatient'
  name: string;
  active: boolean;
}

export interface Domain {
  id: DomainId;
  name: string;
  order: number;
  color: string;
  colorSoft: string;
  gradientTo: string;
  outcomeSentence: string;
  route: string;
  metricIds: string[];
}

export interface Metric {
  id: string;
  domainId: DomainId;
  name: string;
  shortName: string;
  description?: string;
  unitLabel: string;
  polarity: Polarity;
  target: number | null;
  targetMin?: number | null;
  targetMax?: number | null;
  spcMethod: SPCMethod;
  precision: number;
  weight?: number;
  /**
   * How weekly values roll up to month/year for i-chart metrics WITHOUT a
   * numerator/denominator: 'sum' for raw amounts/counts (LKR spend, surgery
   * counts, programmes), 'mean' (default) for averaged measures.
   * Ratio metrics always re-derive from pooled numerator/denominator.
   */
  rollup?: 'sum' | 'mean';
  active: boolean;
}

export interface Observation {
  metricId: string;
  unitId: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  grain: Grain;
  value: number;
  numerator?: number | null;
  denominator?: number | null;
  source: ObservationSource;
  qualityFlag?: QualityFlag;
}

export interface ImportBatch {
  id: string;
  importedAt: string;
  fileName: string;
  rowCount: number;
  status: 'validated' | 'committed' | 'rejected';
  /** what the batch carried: raw data-entry rows (v2) or legacy precomputed observations */
  kind?: 'raw-rows' | 'observations';
}

/**
 * One row of RAW data entry per unit per reporting period — maps 1:1 to a
 * row of the Excel monthly-return template. All numeric fields are optional
 * (a unit may not report every section every period); identifiers, dates and
 * daysInPeriod are always required. All monetary fields are LKR.
 *
 * Derived relationship: surgeriesAll = surgeriesMajor + surgeriesMinor +
 * surgeriesCataract + surgeriesOther (computed by the deriver, not stored).
 */
export interface RawPeriodRow {
  // ── Identity / period ──────────────────────────────────────────────
  unitId: string;
  /** ISO date the data was entered */
  entryDate: string;
  /** calendar month of the period, e.g. '2026-01' */
  month: string;
  /** human label, e.g. 'Week 1, Jan 2026' */
  periodLabel: string;
  grain: 'week' | 'month';
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  daysInPeriod: number;

  // ── Clinical activity ──────────────────────────────────────────────
  totalAdmissions?: number;
  totalDischarges?: number;
  totalDeaths?: number;
  totalInpatientDays?: number;
  readmissions30d?: number;
  surgeriesMajor?: number;
  surgeriesMinor?: number;
  surgeriesCataract?: number;
  surgeriesOther?: number;
  surgicalSiteInfections?: number;

  // ── Patient safety ─────────────────────────────────────────────────
  patientFalls?: number;
  adverseDrugReactions?: number;
  newPressureUlcers?: number;
  patientsAtRiskUlcers?: number;
  medicationErrors?: number;
  totalDosesAdministered?: number;
  needleStickInjuries?: number;
  totalStaffShifts?: number;

  // ── Financial (all LKR) ────────────────────────────────────────────
  pettyCashAllocation?: number;
  pettyCashExpenditure?: number;
  localPurchaseExpenditure?: number;
  fuelExpenditure?: number;
  electricityBill?: number;
  waterBill?: number;
  otherOperatingExpenses?: number;
  /** sum of the expense lines; may be provided explicitly by the return */
  totalOperatingExpenses?: number;
  totalBudgetedExpenditure?: number;
  totalActualExpenditure?: number;
  totalRevenue?: number;
  daysWithZeroStock?: number;

  // ── Operational ────────────────────────────────────────────────────
  availableBeds?: number;
  theatreHoursUsed?: number;
  theatreHoursAvailable?: number;
  totalOpdWaitMinutes?: number;
  totalOpdPatients?: number;
  totalDiagnosticTatMinutes?: number;
  totalDiagnosticsOrdered?: number;

  // ── HR & development ───────────────────────────────────────────────
  trainingProgramsConducted?: number;
  collectiveCpdPoints?: number;
  staffTrainedDoctors?: number;
  staffTrainedNurses?: number;
  staffTrainedAdmin?: number;
  totalStaffDoctors?: number;
  totalStaffNurses?: number;
  totalStaffAdmin?: number;
  staffTrainedCompliance?: number;
  totalStaffRequiredToTrain?: number;
  staffLeft?: number;
  avgTotalStaffCount?: number;
  approvedCadre?: number;
  sickLeaveDays?: number;
  totalScheduledWorkingDays?: number;
  staffWithValidCpd?: number;
  totalClinicalStaff?: number;

  /** provenance; defaults to 'sample' when omitted */
  source?: ObservationSource;
}

export interface PerformanceDataset {
  schemaVersion: '1.0.0';
  generatedAt: string;
  hospital: Hospital;
  units: Unit[];
  domains: Domain[];
  metrics: Metric[];
  /** RAW data-entry rows — the source of truth */
  rawRows: RawPeriodRow[];
  /** KPI observations DERIVED from rawRows via deriveObservations() */
  observations: Observation[];
  importBatches?: ImportBatch[];
}

/** A computed SPC series point (one period). */
export interface SPCPoint {
  label: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  numerator: number | null;
  denominator: number | null;
  cl: number;
  ucl: number;
  lcl: number;
  /** signal classification for this point */
  signal: SignalKind | null;
  /** matched rule ids, e.g. ['beyond-limits', 'shift'] */
  rules: string[];
}

export interface SPCResult {
  points: SPCPoint[];
  cl: number | null;
  ucl: number | null; // nominal (limits may vary per point for p/u charts)
  lcl: number | null;
  sigma: number | null;
  baselineCount: number;
  insufficientBaseline: boolean;
}

/** Composite score status for a domain card. */
export interface DomainScore {
  domainId: DomainId;
  score: number; // 0-100
  delta: number; // pts vs previous period
  status: DomainStatus;
  metricScores: { metricId: string; score: number; value: number | null }[];
  activeSignals: number;
}
