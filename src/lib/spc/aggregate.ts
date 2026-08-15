import type { Grain, Metric, Observation } from '@/types/dcl';

/**
 * Roll up observations from week grain to month or year.
 * - Ratio metrics (rows carrying numerator/denominator — p/u-charts and
 *   ratio-style i-charts like cost-per-patient-day) pool numerators and
 *   denominators and re-derive the value; ratios are never averaged.
 * - Pure i-chart metrics without denominators average values by default,
 *   or SUM them when `metric.rollup === 'sum'` (raw LKR amounts and
 *   volume counts such as surgeries or training programmes).
 */

export interface RolledPeriod {
  periodStart: string;
  periodEnd: string;
  value: number;
  numerator: number | null;
  denominator: number | null;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function yearKey(iso: string): string {
  return iso.slice(0, 4);
}

export function periodLabel(periodStart: string, grain: Grain): string {
  const d = new Date(periodStart + 'T00:00:00Z');
  if (grain === 'year') return periodStart.slice(0, 4);
  if (grain === 'month') {
    return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Aggregate a weekly series to the requested grain.
 * Weekly input is returned as-is (sorted by periodStart).
 * Pass the metric to honour `metric.rollup === 'sum'` for amount/count i-charts.
 */
export function aggregateObservations(obs: Observation[], grain: Grain, metric?: Metric): RolledPeriod[] {
  const sorted = [...obs].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  if (grain === 'week') {
    return sorted
      .filter((o) => o.grain === 'week')
      .map((o) => ({
        periodStart: o.periodStart,
        periodEnd: o.periodEnd,
        value: o.value,
        numerator: o.numerator ?? null,
        denominator: o.denominator ?? null,
      }));
  }

  const weekly = sorted.filter((o) => o.grain === 'week');
  const base = weekly.length > 0 ? weekly : sorted; // fall back to whatever grain exists
  const keyFn = grain === 'month' ? monthKey : yearKey;
  const groups = new Map<string, Observation[]>();
  for (const o of base) {
    const key = keyFn(o.periodStart);
    const g = groups.get(key) ?? [];
    g.push(o);
    groups.set(key, g);
  }

  const out: RolledPeriod[] = [];
  for (const [, rows] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const hasDenom = rows.every((r) => r.denominator !== null && r.denominator !== undefined);
    let value: number;
    let numerator: number | null = null;
    let denominator: number | null = null;
    if (hasDenom) {
      numerator = rows.reduce((s, r) => s + (r.numerator ?? 0), 0);
      denominator = rows.reduce((s, r) => s + (r.denominator ?? 0), 0);
      // values are stored in percent / per-1,000 / plain-ratio units; the
      // ratio recompute is scale-free. Infer the scale from the first row
      // whose numerator is non-zero (rows[0] may legitimately have 0 events).
      const ref = rows.find((r) => (r.numerator ?? 0) > 0 && (r.denominator ?? 0) > 0);
      const scale = ref ? (ref.value * ref.denominator!) / ref.numerator! : 100;
      value = denominator > 0 ? (numerator / denominator) * scale : 0;
    } else {
      const sum = rows.reduce((s, r) => s + r.value, 0);
      value = metric?.rollup === 'sum' ? sum : sum / rows.length;
    }
    out.push({
      periodStart: rows[0].periodStart,
      periodEnd: rows[rows.length - 1].periodEnd,
      value,
      numerator,
      denominator,
    });
  }
  return out;
}
