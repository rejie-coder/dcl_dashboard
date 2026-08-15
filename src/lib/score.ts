import type { Domain, DomainId, DomainScore, DomainStatus, Grain, Metric, SPCPoint } from '@/types/dcl';
import { DOMAINS } from '@/data/domains';
import { METRIC_MAP } from '@/data/metrics';
import { buildSPCSeries } from '@/lib/spc/calculate-limits';
import { periodLabel, type RolledPeriod } from '@/lib/spc/aggregate';

/** Pseudo i-chart metric used to derive limits for composite score series. */
const COMPOSITE_METRIC: Metric = {
  id: 'composite-score',
  domainId: 'clinical-outcome',
  name: 'Composite score',
  shortName: 'Composite',
  unitLabel: 'pts',
  polarity: 'higher',
  target: 100,
  spcMethod: 'i-chart',
  precision: 0,
  active: true,
};

/**
 * Build a composite-score time series for a domain: at each period, the
 * weighted mean of its four metric scores, wrapped with i-chart limits so it
 * can be drawn as a mini SPC sparkline.
 */
export function compositeSeries(domain: Domain, seriesByMetric: Record<string, SPCPoint[]>, grain: Grain): SPCPoint[] {
  const seriesList = domain.metricIds.map((id) => seriesByMetric[id] ?? []).filter((s) => s.length > 0);
  if (seriesList.length === 0) return [];
  const length = Math.min(...seriesList.map((s) => s.length));

  const periods: RolledPeriod[] = [];
  for (let i = 0; i < length; i++) {
    let sum = 0;
    let weight = 0;
    for (const metricId of domain.metricIds) {
      const metric = METRIC_MAP[metricId];
      const pts = seriesByMetric[metricId] ?? [];
      const w = metric.weight ?? 1;
      weight += w;
      sum += metricScore(metric, pts[i]?.value ?? null) * w;
    }
    const ref = seriesList[0][i];
    periods.push({
      periodStart: ref.periodStart,
      periodEnd: ref.periodEnd,
      value: weight > 0 ? sum / weight : 0,
      numerator: null,
      denominator: null,
    });
  }

  const points = buildSPCSeries(periods, COMPOSITE_METRIC, grain);
  // Re-label using the domain grain (labels already derived from periodStart)
  return points.map((p, i) => ({ ...p, label: periodLabel(periods[i].periodStart, grain) }));
}

/**
 * Composite domain scoring (design.md section 8).
 * Each metric normalizes to 0–100 using target, polarity and current value;
 * the domain score is the weighted mean of its four metric scores.
 * Special-cause signals override the badge to "Action needed".
 */

export function metricScore(metric: Metric, value: number | null): number {
  if (value === null || Number.isNaN(value)) return 0;
  const clamp100 = (v: number) => Math.min(Math.max(v, 0), 100);
  switch (metric.polarity) {
    case 'volume': {
      // pure volume/amount indicator: excluded from composite scores
      // (carries weight 0 in the registry); scored neutrally as 0 here.
      return 0;
    }
    case 'lower': {
      const target = metric.target ?? 0;
      if (target <= 0) return value <= 0 ? 100 : 0;
      return clamp100((100 * target) / Math.max(value, 1e-9));
    }
    case 'higher': {
      const target = metric.target ?? 1;
      return clamp100((100 * value) / Math.max(target, 1e-9));
    }
    case 'zero': {
      // closest to zero; full score inside ±targetMax band, linear falloff to 2× band
      const band = Math.abs(metric.targetMax ?? 3);
      const dev = Math.abs(value);
      if (dev <= band) return 100;
      return clamp100(100 * (1 - (dev - band) / band));
    }
    case 'range': {
      const min = metric.targetMin ?? 0;
      const max = metric.targetMax ?? 100;
      if (value >= min && value <= max) return 100;
      const bandWidth = Math.max(max - min, 1e-9);
      const dev = value < min ? min - value : value - max;
      return clamp100(100 * (1 - dev / bandWidth));
    }
  }
}

export function statusFromSignals(points: SPCPoint[], score: number): DomainStatus {
  const recent = points.slice(-8);
  if (recent.some((p) => p.signal === 'special-cause')) return 'action-needed';
  if (recent.some((p) => p.signal === 'run-rule')) return 'watch';
  if (points.length === 0) return 'no-signal';
  return score > 0 ? 'in-control' : 'no-signal';
}

/**
 * Compute composite scores for all five domains from per-metric SPC series.
 * `seriesByMetric` maps metricId → SPC points under the current filters.
 */
export function computeDomainScores(seriesByMetric: Record<string, SPCPoint[]>): DomainScore[] {
  return DOMAINS.map((domain) => {
    let weightSum = 0;
    let scoreSum = 0;
    let activeSignals = 0;
    let worstStatus: DomainStatus = 'in-control';
    const metricScores: DomainScore['metricScores'] = [];

    for (const metricId of domain.metricIds) {
      const metric = METRIC_MAP[metricId];
      const points = seriesByMetric[metricId] ?? [];
      const latest = points.at(-1)?.value ?? null;
      const score = metricScore(metric, latest);
      const weight = metric.weight ?? 1;
      weightSum += weight;
      scoreSum += score * weight;
      const status = statusFromSignals(points, score);
      if (status === 'action-needed') {
        activeSignals += 1;
        worstStatus = 'action-needed';
      } else if (status === 'watch' && worstStatus !== 'action-needed') {
        worstStatus = 'watch';
      } else if (status === 'no-signal' && worstStatus === 'in-control') {
        worstStatus = 'no-signal';
      }
      metricScores.push({ metricId, score, value: latest });
    }

    // delta vs previous period: recompute score using the previous point
    let prevSum = 0;
    let prevWeight = 0;
    for (const metricId of domain.metricIds) {
      const metric = METRIC_MAP[metricId];
      const points = seriesByMetric[metricId] ?? [];
      const prev = points.length >= 2 ? points[points.length - 2].value : null;
      const w = metric.weight ?? 1;
      prevWeight += w;
      prevSum += metricScore(metric, prev) * w;
    }

    const score = weightSum > 0 ? scoreSum / weightSum : 0;
    const prevScore = prevWeight > 0 ? prevSum / prevWeight : score;

    return {
      domainId: domain.id as DomainId,
      score: Math.round(score),
      delta: Math.round((score - prevScore) * 10) / 10,
      status: worstStatus,
      metricScores,
      activeSignals,
    };
  });
}

/** Overall composite health = mean of domain scores. */
export function computeGlobalHealth(scores: DomainScore[]): { score: number; delta: number } {
  if (scores.length === 0) return { score: 0, delta: 0 };
  const score = scores.reduce((s, d) => s + d.score, 0) / scores.length;
  const delta = scores.reduce((s, d) => s + d.delta, 0) / scores.length;
  return { score: Math.round(score), delta: Math.round(delta * 10) / 10 };
}
