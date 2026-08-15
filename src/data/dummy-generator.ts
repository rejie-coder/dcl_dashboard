import type { Grain, PerformanceDataset, RawPeriodRow } from '@/types/dcl';
import { DOMAINS } from './domains';
import { METRICS } from './metrics';
import { UNITS } from './units';
import { deriveObservations } from '@/lib/indicators/derive';

/**
 * Deterministic RAW-data generator (v2).
 * Seed: 'DCL-POC-2026'. Weekly raw data-entry rows, Jan 2023 – Dec 2025
 * (156 weeks) for the six real units. The 'all' unit is NOT generated —
 * it is derived by pooling in deriveObservations().
 *
 * Magnitudes model a Sri Lankan District General Hospital (all money LKR).
 * Internally consistent: inpatient days track bed capacity and occupancy,
 * cost backs into totalOperatingExpenses from inpatient days ×
 * cost/patient-day, leavers are integer Poisson events, monthly-return
 * amounts (electricity, water, local purchase, petty cash, cataract camps,
 * training programmes) are prorated to weekly rows around a fixed per-unit
 * base so weekly→monthly rollups are smooth sums.
 * Routine variation is kept near binomial/i-chart sampling noise so control
 * charts stay stable, with annual seasonality, a gentle improvement trend,
 * and 1–2 special-cause events per raw field injected at the raw level.
 */

const SEED = 'DCL-POC-2026';
export const DATASET_START = '2023-01-02'; // first Monday of 2023
export const WEEK_COUNT = 156; // Jan 2023 – Dec 2025
const WEEKS_PER_MONTH = 4.345; // for prorating monthly-return amounts to weeks

/** Deterministic string hash → uint32 */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Approximate standard normal via sum of uniforms (mean 0, sd ~0.577) */
function gaussian(rand: () => number): number {
  return rand() + rand() + rand() + rand() - 2;
}

const REAL_UNITS = UNITS.filter((u) => u.id !== 'all').map((u) => u.id);

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface WeekInfo {
  start: string;
  end: string;
  month: string; // YYYY-MM of periodStart
  label: string; // 'Week N, Jan 2026'
}

const WEEKS: WeekInfo[] = (() => {
  const out: WeekInfo[] = [];
  for (let w = 0; w < WEEK_COUNT; w++) {
    const start = addDays(DATASET_START, w * 7);
    const end = addDays(start, 6);
    const month = start.slice(0, 7);
    const weekOfMonth = out.filter((p) => p.month === month).length + 1;
    const d = new Date(start + 'T00:00:00Z');
    const label = `Week ${weekOfMonth}, ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    out.push({ start, end, month, label });
  }
  return out;
})();

export function weekPeriod(index: number): { start: string; end: string; label: string } {
  const w = WEEKS[index];
  return { start: w.start, end: w.end, label: w.label };
}

// ── Unit profiles (weekly bases unless noted) ──────────────────────────────

interface UnitProfile {
  admissions: number;
  alos: number; // days (drives bed count)
  deaths: number;
  readmitRate: number; // fraction of discharges
  surgMajor: number;
  surgMinor: number;
  surgCataractMonthly: number;
  surgOther: number;
  ssiRate: number;
  fallsPer1kDays: number;
  adrPerWeek: number;
  ulcerRate: number; // fraction of at-risk patients
  atRiskFrac: number; // fraction of admissions at risk of ulcers
  medErrors: number;
  doses: number;
  needlePer1kShifts: number;
  docs: number;
  nurses: number;
  admin: number;
  cppd: number; // LKR cost per patient day
  elecMonthly: [number, number]; // LKR
  waterMonthly: [number, number]; // LKR
  fuelWeekly: [number, number]; // LKR
  pettyMonthly: number; // LKR allocation
  pettyUtil: [number, number]; // fraction of allocation
  localMonthly: [number, number]; // LKR
  stockoutMonthly: [number, number]; // days
  theatreAvail: number; // hours per week
  theatreUtil: [number, number];
  opd: number; // patients per week
  wait: [number, number]; // minutes
  tat: [number, number]; // minutes
  turnoverAnnual: [number, number];
  absenteeism: [number, number];
  cpd: [number, number];
  trainingMonthly: [number, number]; // programmes
  occupancy: number; // target bed occupancy (derives availableBeds)
}

const PROFILES: Record<string, UnitProfile> = {
  ed: {
    admissions: 160, alos: 1.6, deaths: 2.0, readmitRate: 0.07,
    surgMajor: 1, surgMinor: 22, surgCataractMonthly: 0, surgOther: 2, ssiRate: 0.015,
    fallsPer1kDays: 2.6, adrPerWeek: 4, ulcerRate: 0.01, atRiskFrac: 0.10,
    medErrors: 6, doses: 6500, needlePer1kShifts: 1.2,
    docs: 15, nurses: 38, admin: 8,
    cppd: 10000, elecMonthly: [1.5e6, 2.8e6], waterMonthly: [320e3, 650e3],
    fuelWeekly: [120e3, 220e3], pettyMonthly: 150e3, pettyUtil: [0.85, 1.05],
    localMonthly: [1.2e6, 3.0e6], stockoutMonthly: [1, 4],
    theatreAvail: 12, theatreUtil: [0.6, 0.8],
    opd: 1700, wait: [25, 45], tat: [60, 140],
    turnoverAnnual: [0.07, 0.12], absenteeism: [0.035, 0.06], cpd: [0.6, 0.8],
    trainingMonthly: [1, 4], occupancy: 0.78,
  },
  icu: {
    admissions: 24, alos: 5.5, deaths: 2.6, readmitRate: 0.05,
    surgMajor: 1, surgMinor: 2, surgCataractMonthly: 0, surgOther: 1, ssiRate: 0.03,
    fallsPer1kDays: 1.5, adrPerWeek: 3, ulcerRate: 0.06, atRiskFrac: 0.6,
    medErrors: 3, doses: 3200, needlePer1kShifts: 1.3,
    docs: 8, nurses: 32, admin: 4,
    cppd: 13500, elecMonthly: [1.0e6, 1.8e6], waterMonthly: [200e3, 420e3],
    fuelWeekly: [80e3, 150e3], pettyMonthly: 150e3, pettyUtil: [0.85, 1.05],
    localMonthly: [0.8e6, 2.0e6], stockoutMonthly: [1, 3],
    theatreAvail: 6, theatreUtil: [0.6, 0.85],
    opd: 0, wait: [20, 35], tat: [45, 120],
    turnoverAnnual: [0.06, 0.1], absenteeism: [0.03, 0.05], cpd: [0.65, 0.85],
    trainingMonthly: [1, 3], occupancy: 0.85,
  },
  medical: {
    admissions: 220, alos: 4.0, deaths: 4.2, readmitRate: 0.09,
    surgMajor: 2, surgMinor: 6, surgCataractMonthly: 0, surgOther: 1, ssiRate: 0.02,
    fallsPer1kDays: 3.2, adrPerWeek: 3, ulcerRate: 0.02, atRiskFrac: 0.18,
    medErrors: 5, doses: 5500, needlePer1kShifts: 1.1,
    docs: 25, nurses: 60, admin: 12,
    cppd: 11500, elecMonthly: [1.8e6, 3.4e6], waterMonthly: [400e3, 850e3],
    fuelWeekly: [100e3, 200e3], pettyMonthly: 150e3, pettyUtil: [0.85, 1.05],
    localMonthly: [1.5e6, 3.5e6], stockoutMonthly: [1, 4],
    theatreAvail: 6, theatreUtil: [0.55, 0.75],
    opd: 500, wait: [20, 40], tat: [70, 160],
    turnoverAnnual: [0.06, 0.11], absenteeism: [0.03, 0.055], cpd: [0.6, 0.82],
    trainingMonthly: [1, 5], occupancy: 0.82,
  },
  surgical: {
    admissions: 150, alos: 4.5, deaths: 1.5, readmitRate: 0.06,
    surgMajor: 32, surgMinor: 55, surgCataractMonthly: 35, surgOther: 15, ssiRate: 0.022,
    fallsPer1kDays: 2.8, adrPerWeek: 2, ulcerRate: 0.018, atRiskFrac: 0.15,
    medErrors: 4, doses: 4800, needlePer1kShifts: 1.2,
    docs: 20, nurses: 50, admin: 10,
    cppd: 12500, elecMonthly: [1.6e6, 3.2e6], waterMonthly: [350e3, 800e3],
    fuelWeekly: [110e3, 230e3], pettyMonthly: 150e3, pettyUtil: [0.85, 1.05],
    localMonthly: [1.4e6, 3.2e6], stockoutMonthly: [1, 4],
    theatreAvail: 60, theatreUtil: [0.68, 0.85],
    opd: 400, wait: [20, 38], tat: [80, 170],
    turnoverAnnual: [0.06, 0.1], absenteeism: [0.03, 0.05], cpd: [0.62, 0.84],
    trainingMonthly: [1, 5], occupancy: 0.82,
  },
  maternity: {
    admissions: 175, alos: 2.4, deaths: 0.3, readmitRate: 0.04,
    surgMajor: 38, surgMinor: 12, surgCataractMonthly: 0, surgOther: 4, ssiRate: 0.012,
    fallsPer1kDays: 1.2, adrPerWeek: 2, ulcerRate: 0.008, atRiskFrac: 0.08,
    medErrors: 3, doses: 3800, needlePer1kShifts: 1.1,
    docs: 18, nurses: 45, admin: 8,
    cppd: 9000, elecMonthly: [1.2e6, 2.4e6], waterMonthly: [300e3, 700e3],
    fuelWeekly: [90e3, 180e3], pettyMonthly: 150e3, pettyUtil: [0.85, 1.05],
    localMonthly: [1.0e6, 2.6e6], stockoutMonthly: [1, 3],
    theatreAvail: 45, theatreUtil: [0.65, 0.85],
    opd: 600, wait: [20, 35], tat: [60, 150],
    turnoverAnnual: [0.06, 0.1], absenteeism: [0.035, 0.06], cpd: [0.62, 0.85],
    trainingMonthly: [1, 4], occupancy: 0.8,
  },
  outpatient: {
    admissions: 8, alos: 2.0, deaths: 0.05, readmitRate: 0.03,
    surgMajor: 0, surgMinor: 28, surgCataractMonthly: 0, surgOther: 3, ssiRate: 0.008,
    fallsPer1kDays: 1.0, adrPerWeek: 2, ulcerRate: 0.005, atRiskFrac: 0.05,
    medErrors: 2, doses: 3000, needlePer1kShifts: 0.9,
    docs: 10, nurses: 25, admin: 15,
    cppd: 9500, elecMonthly: [1.5e6, 3.0e6], waterMonthly: [350e3, 750e3],
    fuelWeekly: [80e3, 160e3], pettyMonthly: 150e3, pettyUtil: [0.85, 1.05],
    localMonthly: [1.0e6, 2.8e6], stockoutMonthly: [1, 4],
    theatreAvail: 8, theatreUtil: [0.5, 0.75],
    opd: 2600, wait: [22, 45], tat: [60, 180],
    turnoverAnnual: [0.07, 0.12], absenteeism: [0.03, 0.055], cpd: [0.6, 0.8],
    trainingMonthly: [1, 4], occupancy: 0.7,
  },
};

// ── Special-cause events (injected at raw level) ───────────────────────────

const EVENT_FIELDS = [
  'totalAdmissions', 'totalDeaths', 'medicationErrors', 'patientFalls',
  'newPressureUlcers', 'surgicalSiteInfections', 'totalOperatingExpenses',
  'sickLeaveDays', 'daysWithZeroStock', 'pettyCashExpenditure',
] as const;
type EventField = (typeof EVENT_FIELDS)[number];

interface RawEvent {
  field: EventField;
  start: number;
  length: number;
  mult: number;
}

/** adverse multiplier range per field (admissions surges are milder than incident spikes) */
const EVENT_MULT: Record<EventField, [number, number]> = {
  totalAdmissions: [1.15, 1.35],
  totalDeaths: [1.5, 2.2],
  medicationErrors: [1.8, 2.8],
  patientFalls: [1.6, 2.4],
  newPressureUlcers: [1.6, 2.4],
  surgicalSiteInfections: [1.6, 2.4],
  totalOperatingExpenses: [1.04, 1.08],
  sickLeaveDays: [1.5, 2.2],
  daysWithZeroStock: [2.0, 4.0],
  pettyCashExpenditure: [1.04, 1.08],
};

function generateEvents(rand: () => number): RawEvent[] {
  const events: RawEvent[] = [];
  for (const field of EVENT_FIELDS) {
    const count = 1 + Math.floor(rand() * 2); // 1–2 events per raw field
    for (let e = 0; e < count; e++) {
      const start = 20 + Math.floor(rand() * (WEEK_COUNT - 40));
      const length = 2 + Math.floor(rand() * 4); // 2–5 weeks
      // 70% adverse spikes, 30% favorable dips
      const adverse = rand() < 0.7;
      const [lo, hi] = EVENT_MULT[field];
      const mult = adverse ? lo + rand() * (hi - lo) : 0.75 + rand() * 0.15;
      events.push({ field, start, length, mult });
    }
  }
  return events;
}

/** combined event multiplier for a field in week w (1 when no event is active) */
function eventMult(events: RawEvent[], field: EventField, w: number): number {
  let m = 1;
  for (const ev of events) {
    if (ev.field === field && w >= ev.start && w < ev.start + ev.length) m *= ev.mult;
  }
  return m;
}

// ── Row generation ─────────────────────────────────────────────────────────

const between = (rand: () => number, [lo, hi]: [number, number]) => lo + rand() * (hi - lo);
const jitter = (rand: () => number, cv: number) => 1 + gaussian(rand) * cv;
const count = (v: number) => Math.max(0, Math.round(v));
const money = (v: number) => Math.max(0, Math.round(v));

/** Knuth Poisson draw (small lambda) */
function poisson(rand: () => number, lambda: number): number {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > l);
  return k - 1;
}

function generateUnitRows(unitId: string): RawPeriodRow[] {
  const p = PROFILES[unitId];
  const rand = mulberry32(hashSeed(`${SEED}|${unitId}`));
  const events = generateEvents(rand);
  const phase = rand() * Math.PI * 2; // unit-specific seasonality phase
  const beds = Math.max(1, Math.round((p.admissions * p.alos) / 7 / p.occupancy));
  const staffBase = p.docs + p.nurses + p.admin;

  // fixed per-unit bases for monthly-return quantities (prorated to weeks)
  const uElec = between(rand, p.elecMonthly);
  const uWater = between(rand, p.waterMonthly);
  const uLocal = between(rand, p.localMonthly);
  const uPettyUtil = between(rand, p.pettyUtil);
  const uCataract = p.surgCataractMonthly > 0 ? between(rand, [p.surgCataractMonthly * 0.7, p.surgCataractMonthly * 1.3]) : 0;
  const uTrainingLambda = between(rand, p.trainingMonthly) / WEEKS_PER_MONTH;
  const uStockoutLambda = between(rand, p.stockoutMonthly) / WEEKS_PER_MONTH;

  const rows: RawPeriodRow[] = [];
  for (let w = 0; w < WEEK_COUNT; w++) {
    const wk = WEEKS[w];
    const t = w / (WEEK_COUNT - 1); // 0 → 1 over the 3 years
    const season = 1 + 0.04 * Math.sin((w / 52) * Math.PI * 2 + phase);
    const growth = 1 + 0.025 * t; // gentle activity growth

    // ── Clinical activity ──
    const admMult = eventMult(events, 'totalAdmissions', w);
    const admissions = count(p.admissions * season * growth * jitter(rand, 0.035) * admMult);
    const discharges = Math.max(1, count(admissions * (0.96 + rand() * 0.04)));
    const deaths = count(
      p.deaths * (1 - 0.12 * t) * season * jitter(rand, 0.3) * eventMult(events, 'totalDeaths', w),
    );
    // inpatient days track bed capacity: occupancy noise is near-binomial so
    // the p-chart stays stable; occupancy seasonality follows admissions
    // (damped) and admission surges leak in damped (×0.6)
    const occupancy =
      p.occupancy *
      (1 + 0.6 * (season - 1)) *
      (1 - 0.015 * t) *
      jitter(rand, 0.012) *
      (1 + (admMult - 1) * 0.6);
    const inpatientDays = count(beds * 7 * Math.min(occupancy, 1.05));
    const readmissions = count(discharges * p.readmitRate * (1 - 0.1 * t) * jitter(rand, 0.15));
    const surgMajor = count(p.surgMajor * season * jitter(rand, 0.15));
    const surgMinor = count(p.surgMinor * season * jitter(rand, 0.15));
    const surgCataract = count((uCataract / WEEKS_PER_MONTH) * jitter(rand, 0.2));
    const surgOther = count(p.surgOther * jitter(rand, 0.2));
    const surgeriesAll = surgMajor + surgMinor + surgCataract + surgOther;
    const ssi = count(
      surgeriesAll * p.ssiRate * (1 - 0.15 * t) * jitter(rand, 0.35) * eventMult(events, 'surgicalSiteInfections', w),
    );

    // ── Patient safety ──
    const falls = count(
      (inpatientDays / 1000) * p.fallsPer1kDays * (1 - 0.15 * t) * jitter(rand, 0.4) * eventMult(events, 'patientFalls', w),
    );
    const adr = count(p.adrPerWeek * jitter(rand, 0.3));
    const atRisk = count(admissions * p.atRiskFrac);
    const ulcers = count(
      atRisk * p.ulcerRate * (1 - 0.15 * t) * jitter(rand, 0.35) * eventMult(events, 'newPressureUlcers', w),
    );
    const medErrors = count(
      p.medErrors * (1 - 0.2 * t) * jitter(rand, 0.25) * eventMult(events, 'medicationErrors', w),
    );
    const doses = count(p.doses * season * jitter(rand, 0.08));
    const avgStaff = Math.round(staffBase * (1 + 0.02 * t) * 10) / 10;
    const shifts = count(avgStaff * 6);
    const needle = poisson(rand, (shifts / 1000) * p.needlePer1kShifts);

    // ── Financial (LKR) ──
    const fuel = money(between(rand, p.fuelWeekly) * jitter(rand, 0.08));
    const elec = money((uElec / WEEKS_PER_MONTH) * jitter(rand, 0.03));
    const water = money((uWater / WEEKS_PER_MONTH) * jitter(rand, 0.03));
    const local = money((uLocal / WEEKS_PER_MONTH) * jitter(rand, 0.04));
    const pettyAlloc = money(p.pettyMonthly / WEEKS_PER_MONTH);
    const pettyExp = money(
      pettyAlloc * (uPettyUtil + gaussian(rand) * 0.004) * eventMult(events, 'pettyCashExpenditure', w),
    );
    const components = fuel + elec + water + local + pettyExp;
    let totalOpex = inpatientDays * p.cppd * (1 - 0.01 * t) * jitter(rand, 0.015);
    totalOpex *= eventMult(events, 'totalOperatingExpenses', w);
    if (totalOpex < components * 1.3) totalOpex = components * 1.3;
    totalOpex = money(totalOpex);
    const otherOpex = totalOpex - components;
    const budgeted = money(totalOpex * (0.97 + rand() * 0.06));
    const actual = money(totalOpex * (0.98 + rand() * 0.05));
    const revenue = money(totalOpex * (0.08 + rand() * 0.15));
    const stockoutDays = Math.min(
      7,
      count(poisson(rand, uStockoutLambda) * eventMult(events, 'daysWithZeroStock', w)),
    );

    // ── Operational ──
    const availableBeds = beds;
    const theatreAvail = p.theatreAvail;
    const theatreUsed = Math.min(theatreAvail, Math.round(theatreAvail * between(rand, p.theatreUtil) * jitter(rand, 0.04) * 10) / 10);
    const opdPatients = count(p.opd * season * growth * jitter(rand, 0.08));
    const waitMin = between(rand, p.wait) * (1 - 0.15 * t);
    const opdWaitMinutes = count(opdPatients * waitMin);
    const diagOrdered = count(admissions * 3 + opdPatients * 0.35);
    const tatMin = between(rand, p.tat) * (1 - 0.15 * t);
    const diagTatMinutes = count(diagOrdered * tatMin);

    // ── HR ──
    const docs = Math.round(p.docs * (1 + 0.02 * t));
    const nurses = Math.round(p.nurses * (1 + 0.02 * t));
    const admin = Math.round(p.admin * (1 + 0.02 * t));
    const training = poisson(rand, uTrainingLambda);
    const clinicalStaff = docs + nurses;
    const validCpd = Math.min(clinicalStaff, count(clinicalStaff * between(rand, p.cpd) * jitter(rand, 0.04)));
    const scheduledDays = count(avgStaff * 6);
    const sickLeave = count(
      scheduledDays * between(rand, p.absenteeism) * (1 - 0.1 * t) * jitter(rand, 0.15) * eventMult(events, 'sickLeaveDays', w),
    );
    // leavers are integer events: Poisson draw around the weekly rate
    const staffLeft = poisson(rand, (avgStaff * between(rand, p.turnoverAnnual)) / 52);

    rows.push({
      unitId,
      entryDate: addDays(wk.end, 2),
      month: wk.month,
      periodLabel: wk.label,
      grain: 'week',
      periodStart: wk.start,
      periodEnd: wk.end,
      daysInPeriod: 7,
      // clinical
      totalAdmissions: admissions,
      totalDischarges: discharges,
      totalDeaths: deaths,
      totalInpatientDays: inpatientDays,
      readmissions30d: readmissions,
      surgeriesMajor: surgMajor,
      surgeriesMinor: surgMinor,
      surgeriesCataract: surgCataract,
      surgeriesOther: surgOther,
      surgicalSiteInfections: ssi,
      // safety
      patientFalls: falls,
      adverseDrugReactions: adr,
      newPressureUlcers: ulcers,
      patientsAtRiskUlcers: atRisk,
      medicationErrors: medErrors,
      totalDosesAdministered: doses,
      needleStickInjuries: needle,
      totalStaffShifts: shifts,
      // financial (LKR)
      pettyCashAllocation: pettyAlloc,
      pettyCashExpenditure: pettyExp,
      localPurchaseExpenditure: local,
      fuelExpenditure: fuel,
      electricityBill: elec,
      waterBill: water,
      otherOperatingExpenses: otherOpex,
      totalOperatingExpenses: totalOpex,
      totalBudgetedExpenditure: budgeted,
      totalActualExpenditure: actual,
      totalRevenue: revenue,
      daysWithZeroStock: stockoutDays,
      // operational
      availableBeds,
      theatreHoursUsed: theatreUsed,
      theatreHoursAvailable: theatreAvail,
      totalOpdWaitMinutes: opdWaitMinutes,
      totalOpdPatients: opdPatients,
      totalDiagnosticTatMinutes: diagTatMinutes,
      totalDiagnosticsOrdered: diagOrdered,
      // HR
      trainingProgramsConducted: training,
      collectiveCpdPoints: count(validCpd * 18 * jitter(rand, 0.1)),
      staffTrainedDoctors: count(training * 1.5 * rand()),
      staffTrainedNurses: count(training * 4 * rand()),
      staffTrainedAdmin: count(training * 1 * rand()),
      totalStaffDoctors: docs,
      totalStaffNurses: nurses,
      totalStaffAdmin: admin,
      staffTrainedCompliance: count(avgStaff * 0.8),
      totalStaffRequiredToTrain: count(avgStaff),
      staffLeft,
      avgTotalStaffCount: avgStaff,
      approvedCadre: count(avgStaff * 1.12),
      sickLeaveDays: sickLeave,
      totalScheduledWorkingDays: scheduledDays,
      staffWithValidCpd: validCpd,
      totalClinicalStaff: clinicalStaff,
      source: 'sample',
    });
  }
  return rows;
}

let cachedRows: RawPeriodRow[] | null = null;
let cached: PerformanceDataset | null = null;

/** Generate (and memoise) the 3-year sample raw data-entry rows. */
export function generateSampleRawRows(): RawPeriodRow[] {
  if (cachedRows) return cachedRows;
  cachedRows = REAL_UNITS.flatMap((unitId) => generateUnitRows(unitId));
  return cachedRows;
}

/** Generate (and memoise) the full 3-year sample dataset (raw rows + derived observations). */
export function generateDummyDataset(): PerformanceDataset {
  if (cached) return cached;
  const rawRows = generateSampleRawRows();
  cached = {
    schemaVersion: '1.0.0',
    generatedAt: '2025-12-31T23:59:59Z',
    hospital: {
      id: 'dgh-sri-lanka',
      name: 'District General Hospital — Sri Lanka',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
    },
    units: UNITS,
    domains: DOMAINS,
    metrics: METRICS,
    rawRows,
    observations: deriveObservations(rawRows),
    importBatches: [],
  };
  return cached;
}

export const ALL_GRAINS: Grain[] = ['week', 'month', 'year'];
