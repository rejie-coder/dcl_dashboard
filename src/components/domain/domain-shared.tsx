import type { Domain, DomainScore, Metric, SPCPoint } from '@/types/dcl';
import { METRIC_MAP, formatMetricValue } from '@/data/metrics';
import { cn } from '@/lib/utils';

/**
 * Shared helpers for Level 2 domain pages (labels, deltas, CSV export,
 * status chips, dynamic interpretation sentences). Config-driven so every
 * domain page renders the same structure with its own accent and copy.
 */

export const GRAIN_LABEL: Record<string, string> = { week: 'Week', month: 'Month', year: 'Year' };

export const RULE_LABELS: Record<string, string> = {
  'beyond-limits': 'Point beyond control limits',
  shift: '8 consecutive points on one side of the center line',
  trend: '6 consecutive increasing/decreasing points',
  'zone-2sigma': '2 of 3 points beyond the 2σ zone',
};

export function polarityLabel(metric: Metric): string {
  switch (metric.polarity) {
    case 'lower':
      return 'Lower is better';
    case 'higher':
      return 'Higher is better';
    case 'zero':
      return 'Closest to zero';
    case 'range':
      return 'Optimal band';
    case 'volume':
      return 'Volume indicator';
  }
}

export function targetLabel(metric: Metric): string {
  if (metric.polarity === 'range' && metric.targetMin != null && metric.targetMax != null) {
    const lo = formatMetricValue(metric, metric.targetMin);
    const hi = formatMetricValue(metric, metric.targetMax);
    return `${lo}–${hi}`;
  }
  if (metric.polarity === 'zero') {
    const band = Math.abs(metric.targetMax ?? 0);
    return `±${formatMetricValue(metric, band)}`;
  }
  if (metric.target == null) return 'No target';
  const symbol = metric.polarity === 'higher' ? '≥' : '≤';
  return `${symbol} ${formatMetricValue(metric, metric.target)}`;
}

/** Delta vs previous period for a series, with favorability from polarity. */
export function deltaInfo(
  metric: Metric,
  points: SPCPoint[],
): { text: string; favorable: boolean | null; direction: 1 | -1 | 0 } {
  if (points.length < 2) return { text: 'No prior period', favorable: null, direction: 0 };
  const curr = points[points.length - 1].value;
  const prev = points[points.length - 2].value;
  const diff = curr - prev;
  if (Math.abs(diff) < 1e-9) return { text: 'Unchanged vs prior', favorable: null, direction: 0 };
  const direction = diff > 0 ? 1 : -1;
  const abs = Math.abs(diff).toLocaleString('en-US', {
    minimumFractionDigits: metric.precision,
    maximumFractionDigits: metric.precision,
  });
  let favorable: boolean | null = null;
  if (metric.polarity === 'lower') favorable = direction === -1;
  else if (metric.polarity === 'higher') favorable = direction === 1;
  else if (metric.polarity === 'zero') favorable = Math.abs(curr) <= Math.abs(prev);
  else if (metric.polarity === 'range') {
    const min = metric.targetMin ?? -Infinity;
    const max = metric.targetMax ?? Infinity;
    const dev = (v: number) => (v < min ? min - v : v > max ? v - max : 0);
    favorable = dev(curr) <= dev(prev);
  }
  return {
    text: `${direction === 1 ? 'Up' : 'Down'} ${abs} ${metric.unitLabel === '%' ? 'pts' : metric.unitLabel} vs prior${favorable === null ? '' : favorable ? ' — favorable' : ' — adverse'}`,
    favorable,
    direction,
  };
}

/** Latest-point signal status for a metric series. */
export function metricStatus(points: SPCPoint[]): 'special-cause' | 'run-rule' | 'in-control' | 'no-data' {
  const latest = points.at(-1);
  if (!latest) return 'no-data';
  return latest.signal ?? 'in-control';
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  'special-cause': { label: 'Special cause', className: 'bg-[#FF3B30]/10 text-[#B42318] ring-[#FF3B30]/30' },
  'run-rule': { label: 'Run rule', className: 'bg-[#FFCC00]/15 text-[#713F12] ring-[#FFCC00]/40' },
  'in-control': { label: 'In control', className: 'bg-[#34C759]/12 text-[#1F7A38] ring-[#34C759]/30' },
  'no-data': { label: 'No signal', className: 'bg-[#8E8E93]/10 text-[var(--dcl-ink-500)] ring-[#8E8E93]/25' },
};

export const DOMAIN_STATUS_STYLE: Record<DomainScore['status'], { label: string; className: string }> = {
  'in-control': { label: 'In control', className: 'bg-[#34C759]/12 text-[#1F7A38] ring-[#34C759]/30' },
  watch: { label: 'Watch', className: 'bg-[#FFCC00]/15 text-[#713F12] ring-[#FFCC00]/40' },
  'action-needed': { label: 'Action needed', className: 'bg-[#FF3B30]/10 text-[#B42318] ring-[#FF3B30]/30' },
  'no-signal': { label: 'No signal', className: 'bg-[#8E8E93]/10 text-[var(--dcl-ink-500)] ring-[#8E8E93]/25' },
};

export function SignalChip({ status, className }: { status: string; className?: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE['no-data'];
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1', s.className, className)}>
      {s.label}
    </span>
  );
}

/* ── CSV / text export helpers ─────────────────────────────────────── */

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export one metric's SPC series as CSV (used by cards and the drawer). */
export function exportSeriesCSV(metric: Metric, unitId: string, points: SPCPoint[]) {
  const header = ['metric_id', 'metric_name', 'unit_id', 'period_start', 'period_end', 'value', 'numerator', 'denominator', 'cl', 'ucl', 'lcl', 'signal', 'rules'];
  const rows = points.map((p) =>
    [
      metric.id,
      metric.name,
      unitId,
      p.periodStart,
      p.periodEnd,
      p.value,
      p.numerator,
      p.denominator,
      p.cl,
      p.ucl,
      p.lcl,
      p.signal ?? '',
      p.rules.join('|'),
    ]
      .map(csvEscape)
      .join(','),
  );
  downloadBlob(`${metric.id}-${unitId}.csv`, new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }));
}

/** Export all domain metric series in a single CSV ("Export brief"). */
export function exportDomainCSV(domain: Domain, unitId: string, seriesByMetric: Record<string, SPCPoint[]>) {
  const header = ['metric_id', 'metric_name', 'unit_id', 'period_start', 'period_end', 'value', 'numerator', 'denominator', 'cl', 'ucl', 'lcl', 'signal', 'rules'];
  const rows: string[] = [];
  for (const metricId of domain.metricIds) {
    const metric = METRIC_MAP[metricId];
    if (!metric) continue;
    for (const p of seriesByMetric[metricId] ?? []) {
      rows.push(
        [metric.id, metric.name, unitId, p.periodStart, p.periodEnd, p.value, p.numerator, p.denominator, p.cl, p.ucl, p.lcl, p.signal ?? '', p.rules.join('|')]
          .map(csvEscape)
          .join(','),
      );
    }
  }
  downloadBlob(`${domain.id}-brief-${unitId}.csv`, new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }));
}

export function downloadText(filename: string, text: string) {
  downloadBlob(filename, new Blob([text], { type: 'text/plain;charset=utf-8' }));
}

/** Copy text to clipboard with a safe fallback. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Dynamic one-line interpretation for the domain header, derived from live
 * signals / target-band breaches. Matches the tone of the design examples.
 */
export function buildInterpretation(domain: Domain, score: DomainScore, seriesByMetric: Record<string, SPCPoint[]>): string {
  const issues: string[] = [];
  for (const metricId of domain.metricIds) {
    const metric = METRIC_MAP[metricId];
    const points = seriesByMetric[metricId] ?? [];
    const latest = points.at(-1);
    if (!metric || !latest) continue;
    // Volume indicators carry no good/bad direction — never framed as issues.
    if (metric.polarity === 'volume') continue;
    if (metric.polarity === 'range' && metric.targetMin != null && metric.targetMax != null) {
      if (latest.value > metric.targetMax) issues.push(`${metric.name} is above the preferred operating band`);
      else if (latest.value < metric.targetMin) issues.push(`${metric.name} is below the preferred operating band`);
    } else if (metric.polarity === 'zero' && metric.targetMax != null) {
      if (Math.abs(latest.value) > Math.abs(metric.targetMax))
        issues.push(`${metric.name} is outside the acceptable ±${Math.abs(metric.targetMax)}${metric.unitLabel} band`);
    } else if (metric.polarity === 'lower' && metric.target != null && latest.value > metric.target) {
      issues.push(`${metric.name} is above target`);
    } else if (metric.polarity === 'higher' && metric.target != null && latest.value < metric.target) {
      issues.push(`${metric.name} is below target`);
    } else if (latest.signal === 'special-cause') {
      issues.push(`${metric.name} shows a special-cause signal`);
    }
  }

  const improving = [...domain.metricIds]
    .map((id) => ({ metric: METRIC_MAP[id], points: seriesByMetric[id] ?? [] }))
    .find(({ metric, points }) => {
      const latest = points.at(-1);
      if (!metric || !latest || latest.signal !== 'run-rule') return false;
      return deltaInfo(metric, points).favorable === true;
    });

  let lead: string;
  if (score.status === 'action-needed') lead = 'Action needed.';
  else if (score.status === 'watch') lead = 'Stable overall, with watch signals.';
  else if (score.delta > 0) lead = 'Improving overall.';
  else lead = 'Stable overall.';

  if (issues.length > 0) return `${lead} ${issues[0]}.`;
  if (improving?.metric) return `${lead} ${improving.metric.name} has a run of favorable movement.`;
  return `${lead} All ${domain.metricIds.length} KPIs are within expected variation.`;
}

/** Plain-text executive summary used by "Copy summary" actions. */
export function buildBoardSummary(domain: Domain, score: DomainScore, seriesByMetric: Record<string, SPCPoint[]>): string {
  const lines = [
    `${domain.name} — composite ${score.score}/100 (${DOMAIN_STATUS_STYLE[score.status].label}, ${score.delta >= 0 ? '+' : ''}${score.delta.toFixed(1)} pts vs prior period).`,
    ...domain.metricIds.map((id) => {
      const metric = METRIC_MAP[id];
      const points = seriesByMetric[id] ?? [];
      const latest = points.at(-1);
      if (!metric || !latest) return `- ${metric?.name ?? id}: no data`;
      const status = latest.signal === 'special-cause' ? 'special cause' : latest.signal === 'run-rule' ? 'run rule' : 'in control';
      return `- ${metric.name}: ${formatMetricValue(metric, latest.value)} (target ${targetLabel(metric)}, ${status})`;
    }),
  ];
  return lines.join('\n');
}
