import type { DomainId, SignalKind, SPCPoint } from '@/types/dcl';
import { METRIC_MAP } from '@/data/metrics';
import { DOMAIN_MAP } from '@/data/domains';

/**
 * Derive ranked priority alerts from per-metric SPC series.
 * Ranked by statistical signal strength (special-cause > run-rule) and recency.
 */

export interface PriorityAlert {
  id: string;
  metricId: string;
  domainId: DomainId;
  domainName: string;
  headline: string;
  detail: string;
  kind: SignalKind;
  periodLabel: string;
  periodEnd: string;
  /** ranking weight: higher = stronger */
  strength: number;
}

export function deriveAlerts(seriesByMetric: Record<string, SPCPoint[]>, unitLabel: string): PriorityAlert[] {
  const alerts: PriorityAlert[] = [];

  for (const [metricId, points] of Object.entries(seriesByMetric)) {
    const metric = METRIC_MAP[metricId];
    if (!metric || points.length === 0) continue;
    const domain = DOMAIN_MAP[metric.domainId];
    const recent = points.slice(-12);

    // keep only the most recent signal of each kind per metric
    const seen = new Set<string>();
    for (let i = recent.length - 1; i >= 0; i--) {
      const p = recent[i];
      if (!p.signal) continue;
      for (const rule of p.rules) {
        const dedupeKey = `${metricId}:${p.signal}:${rule}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        let headline: string;
        if (rule === 'beyond-limits') {
          headline = `${metric.name} ${p.value > p.ucl ? 'above UCL' : 'below LCL'} — ${unitLabel}`;
        } else if (rule === 'shift') {
          headline = `${metric.name} shifted ${p.value > p.cl ? 'above' : 'below'} its center line — ${unitLabel}`;
        } else if (rule === 'trend') {
          const improving =
            metric.polarity === 'higher'
              ? p.value > (recent[i - 1]?.value ?? p.value)
              : p.value < (recent[i - 1]?.value ?? p.value);
          headline = `${metric.name} ${improving ? 'improving' : 'worsening'} for 6 periods — ${unitLabel}`;
        } else {
          headline = `${metric.name} near a control limit — ${unitLabel}`;
        }

        alerts.push({
          id: dedupeKey,
          metricId,
          domainId: metric.domainId,
          domainName: domain?.name ?? metric.domainId,
          headline,
          detail: `${p.label}: ${p.value.toFixed(metric.precision)} vs CL ${p.cl.toFixed(metric.precision)}`,
          kind: p.signal,
          periodLabel: p.label,
          periodEnd: p.periodEnd,
          strength: (p.signal === 'special-cause' ? 1000 : 100) + i,
        });
        break; // one alert per metric per signal kind
      }
    }
  }

  return alerts.sort((a, b) => b.strength - a.strength);
}

/** Build the "What changed this period?" narrative from the top alert. */
export function buildNarrative(alerts: PriorityAlert[]): string {
  const top = alerts[0];
  if (!top) return 'All domains remain within expected variation this period. No special-cause signals are active.';
  const metric = METRIC_MAP[top.metricId];
  if (top.kind === 'special-cause' && metric) {
    return `${top.domainName} requires attention after ${metric.name} crossed the ${top.headline.includes('above') ? 'upper' : 'lower'} control limit. Investigate the cause before resetting expectations.`;
  }
  if (metric) {
    return `${top.domainName} shows a sustained shift: ${top.headline.replace(` — ${top.headline.split(' — ').at(-1)}`, '')}. Monitor for two more periods before rebaselining.`;
  }
  return 'Performance is stable overall; continue routine monitoring.';
}
