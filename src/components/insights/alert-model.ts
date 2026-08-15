import type { Metric, SPCPoint } from '@/types/dcl';
import type { PriorityAlert } from '@/lib/alerts';
import { METRIC_MAP } from '@/data/metrics';
import { unitName } from '@/data/units';

/**
 * Enriched alert model for the Insights feed: adds favorability, the SPC
 * point that triggered the alert, and display metadata.
 */
export interface AlertItem extends PriorityAlert {
  metric: Metric;
  unitLabel: string;
  /** the SPC point that triggered the alert (matched by periodEnd) */
  point: SPCPoint | null;
  /**
   * Whether the signal direction is favorable given the metric polarity.
   * `null` = neutral (volume indicators carry no good/bad direction).
   */
  favorable: boolean | null;
}

export function isFavorablePoint(metric: Metric, p: SPCPoint): boolean | null {
  switch (metric.polarity) {
    case 'volume':
      // Volume/amount indicators are neutral: no favorable/unfavorable coloring.
      return null;
    case 'higher':
      return p.value > p.cl;
    case 'lower':
      return p.value < p.cl;
    case 'zero':
      return Math.abs(p.value - (metric.target ?? 0)) <= Math.abs(p.cl - (metric.target ?? 0));
    case 'range': {
      const min = metric.targetMin ?? -Infinity;
      const max = metric.targetMax ?? Infinity;
      return p.value >= min && p.value <= max;
    }
  }
}

export function enrichAlerts(
  alerts: PriorityAlert[],
  seriesByMetric: Record<string, SPCPoint[]>,
  unitId: string,
): AlertItem[] {
  const label = unitName(unitId);
  return alerts.flatMap((a) => {
    const metric = METRIC_MAP[a.metricId];
    if (!metric) return [];
    const points = seriesByMetric[a.metricId] ?? [];
    const point = points.find((p) => p.periodEnd === a.periodEnd && p.signal) ?? points.at(-1) ?? null;
    return [
      {
        ...a,
        metric,
        unitLabel: label,
        point,
        favorable: point ? isFavorablePoint(metric, point) : null,
      },
    ];
  });
}

/** Plain-language "why this matters" note per signal rule. */
export function whyItMatters(alert: AlertItem): string {
  const name = alert.metric.name;
  const rule = alert.id.split(':').at(-1) ?? '';
  if (rule === 'beyond-limits') {
    return `${name} moved beyond the range its own history says is normal. Common-cause noise rarely produces a point like this, so a specific, findable cause is likely — check staffing, case mix, coding, or a process change in that period.`;
  }
  if (rule === 'shift') {
    return `Eight consecutive points on one side of the center line means the process average has moved. This is a sustained change in how ${name} behaves, not a one-off spike — confirm whether it is deliberate improvement or drift.`;
  }
  if (rule === 'trend') {
    return `Six consecutive periods moving in one direction indicates a steady drift in ${name}. Trends rarely stop by themselves; early intervention is cheaper than late correction.`;
  }
  return `Two of the last three points sit near the same control limit. The pattern suggests the process is operating at the edge of its normal range and may cross it soon.`;
}

/** Suggested next step per alert. */
export function suggestedStep(alert: AlertItem): string {
  if (alert.favorable) {
    return `Verify the improvement is real, document what changed, and consider rebaselining after two more confirming periods.`;
  }
  switch (alert.metric.domainId) {
    case 'patient-safety':
      return 'Review unit-level rounding and incident reports for the flagged period, then log an action with the ward manager.';
    case 'financial-efficiency':
      return 'Reconcile the flagged period against budget coding and purchasing records before adjusting forecasts.';
    case 'clinical-outcome':
      return 'Audit case mix and discharge criteria for the flagged period with the clinical lead.';
    case 'operational-efficiency':
      return 'Check scheduling, staffing rosters, and demand anomalies for the flagged period.';
    default:
      return 'Confirm data quality first, then schedule a review with the metric owner.';
  }
}
