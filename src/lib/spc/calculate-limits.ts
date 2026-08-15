import type { Metric, SPCPoint } from '@/types/dcl';
import { periodLabel, type RolledPeriod } from './aggregate';
import type { Grain } from '@/types/dcl';
import { detectSignals } from './detect-signals';

/**
 * SPC control limit calculation (design.md section 8).
 * - p-chart: limits vary by denominator; CL = pooled proportion.
 * - u-chart: limits vary by exposure; CL = pooled rate.
 * - i-chart: CL = mean; sigma estimated from mean moving range (MR̄ / 1.128).
 * Baseline = first 20 periods (min 12 required). LCL floored at 0 for
 * naturally non-negative metrics.
 */

export const BASELINE_SIZE = 20;
export const MIN_BASELINE = 12;

export interface LimitPoint {
  cl: number;
  ucl: number;
  lcl: number;
  sigma: number; // per-point sigma ((ucl - cl) / 3)
}

export interface Limits {
  cl: number;
  points: LimitPoint[];
  insufficientBaseline: boolean;
  baselineCount: number;
}

function isNonNegativeMetric(metric: Metric): boolean {
  return metric.polarity !== 'zero';
}

function floorLcl(lcl: number, metric: Metric): number {
  return isNonNegativeMetric(metric) ? Math.max(0, lcl) : lcl;
}

export function calculateLimits(periods: RolledPeriod[], metric: Metric): Limits {
  const baseline = periods.slice(0, BASELINE_SIZE);
  if (baseline.length < MIN_BASELINE) {
    return { cl: NaN, points: [], insufficientBaseline: true, baselineCount: baseline.length };
  }

  const floor = (v: number) => floorLcl(v, metric);

  if (metric.spcMethod === 'p-chart' && baseline.every((p) => p.denominator)) {
    // values are stored in percent (0–100)
    const sumN = baseline.reduce((s, p) => s + (p.numerator ?? 0), 0);
    const sumD = baseline.reduce((s, p) => s + (p.denominator ?? 0), 0);
    const pBar = sumD > 0 ? sumN / sumD : 0; // proportion
    const cl = pBar * 100;
    const points = periods.map((p) => {
      const d = p.denominator ?? sumD / baseline.length;
      const sigmaProp = Math.sqrt((pBar * (1 - pBar)) / Math.max(d, 1));
      const sigma = sigmaProp * 100;
      return { cl, ucl: cl + 3 * sigma, lcl: floor(cl - 3 * sigma), sigma };
    });
    return { cl, points, insufficientBaseline: false, baselineCount: baseline.length };
  }

  if (metric.spcMethod === 'u-chart' && baseline.every((p) => p.denominator)) {
    // values stored as rate per 1,000 exposure units
    const sumN = baseline.reduce((s, p) => s + (p.numerator ?? 0), 0);
    const sumD = baseline.reduce((s, p) => s + (p.denominator ?? 0), 0);
    const uBar = sumD > 0 ? sumN / sumD : 0; // per exposure unit
    const cl = uBar * 1000;
    const points = periods.map((p) => {
      const d = p.denominator ?? sumD / baseline.length;
      const sigma = Math.sqrt(uBar / Math.max(d, 1)) * 1000;
      return { cl, ucl: cl + 3 * sigma, lcl: floor(cl - 3 * sigma), sigma };
    });
    return { cl, points, insufficientBaseline: false, baselineCount: baseline.length };
  }

  // i-chart (also fallback for p/u without denominators)
  const cl = baseline.reduce((s, p) => s + p.value, 0) / baseline.length;
  const mrs: number[] = [];
  for (let i = 1; i < baseline.length; i++) mrs.push(Math.abs(baseline[i].value - baseline[i - 1].value));
  const mrBar = mrs.length > 0 ? mrs.reduce((s, v) => s + v, 0) / mrs.length : 0;
  const sigma = mrBar / 1.128;
  const points = periods.map(() => ({
    cl,
    ucl: cl + 3 * sigma,
    lcl: floor(cl - 3 * sigma),
    sigma,
  }));
  return { cl, points, insufficientBaseline: false, baselineCount: baseline.length };
}

/** Build the full annotated SPC series (limits + signal detection) for a metric. */
export function buildSPCSeries(periods: RolledPeriod[], metric: Metric, grain: Grain): SPCPoint[] {
  const limits = calculateLimits(periods, metric);
  if (limits.insufficientBaseline) return [];

  const signals = detectSignals(
    periods.map((p, i) => ({ value: p.value, cl: limits.points[i].cl, ucl: limits.points[i].ucl, lcl: limits.points[i].lcl, sigma: limits.points[i].sigma })),
  );

  return periods.map((p, i) => ({
    label: periodLabel(p.periodStart, grain),
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    value: p.value,
    numerator: p.numerator,
    denominator: p.denominator,
    cl: limits.points[i].cl,
    ucl: limits.points[i].ucl,
    lcl: limits.points[i].lcl,
    signal: signals[i].signal,
    rules: signals[i].rules,
  }));
}
