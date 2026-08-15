import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DOMAINS } from '@/data/domains';
import { METRIC_MAP, formatMetricValue } from '@/data/metrics';
import type { SPCPoint } from '@/types/dcl';

type CellStatus = 'stable' | 'watch' | 'special' | 'none';

function statusOf(points: SPCPoint[]): { status: CellStatus; value: number | null } {
  const latest = points.at(-1);
  if (!latest) return { status: 'none', value: null };
  if (latest.signal === 'special-cause') return { status: 'special', value: latest.value };
  const recent = points.slice(-8);
  if (recent.some((p) => p.signal)) return { status: 'watch', value: latest.value };
  return { status: 'stable', value: latest.value };
}

function StatusSymbol({ status }: { status: CellStatus }) {
  switch (status) {
    case 'stable':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#34C759]/15" title="Stable / favorable">
          <Check className="h-3 w-3 text-[#1F7A38]" strokeWidth={3} />
        </span>
      );
    case 'watch':
      return <span className="h-3.5 w-3.5 rounded-full border-[3px] border-[#FFCC00]" title="Watch / run rule" />;
    case 'special':
      return <span className="h-3.5 w-3.5 rounded-full bg-[#FF3B30]" title="Special cause" />;
    default:
      return <Minus className="h-4 w-4 text-[var(--dcl-ink-400)]" aria-label="No valid data" />;
  }
}

/**
 * Cross-domain signal map (insights.md section 4): a semantic 5×N table of
 * domains × metrics. Column count follows the widest domain's metric list in
 * domains.ts (shorter domains leave trailing cells empty). Each cell shows a
 * status symbol and latest value; click / Enter navigates to the metric on
 * its domain page.
 */
export function SignalMap({ seriesByMetric }: { seriesByMetric: Record<string, SPCPoint[]> }) {
  const navigate = useNavigate();
  const maxCols = Math.max(...DOMAINS.map((d) => d.metricIds.length));
  const totalKpis = DOMAINS.reduce((n, d) => n + d.metricIds.length, 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.28 }}
      className="dcl-card rounded-[24px] p-6"
    >
      <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--dcl-ink-900)]">Signal map</h2>
      <p className="mt-0.5 text-[13px] text-[var(--dcl-ink-500)]">
        Scan all {totalKpis} KPIs. Select a cell to open its metric detail.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-1.5">
          <caption className="sr-only">Signal status for every metric by domain</caption>
          <thead>
            <tr>
              <th scope="col" className="w-36 px-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-400)]">
                Domain
              </th>
              {Array.from({ length: maxCols }, (_, i) => (
                <th key={i} scope="col" className="px-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-400)]">
                  KPI {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOMAINS.map((domain, row) => (
              <tr key={domain.id}>
                <th scope="row" className="px-2 text-left">
                  <span className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--dcl-ink-900)]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: domain.color }} />
                    {domain.name}
                  </span>
                </th>
                {domain.metricIds.map((metricId, col) => {
                  const metric = METRIC_MAP[metricId];
                  const { status, value } = statusOf(seriesByMetric[metricId] ?? []);
                  const delay = Math.min((row * maxCols + col) * 0.012, 0.4);
                  return (
                    <td key={metricId} className="p-0">
                      <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.2, delay }}
                        whileHover={{ scale: 1.04 }}
                        onClick={() => navigate(`${domain.route}?metric=${metricId}`)}
                        title={`${metric.name}: ${value === null ? 'no valid data' : formatMetricValue(metric, value)}${
                          metric.target !== null ? ` · target ${formatMetricValue(metric, metric.target)}` : ''
                        }`}
                        aria-label={`${metric.name}, ${status === 'special' ? 'special cause' : status === 'watch' ? 'watch' : status === 'stable' ? 'stable' : 'no valid data'}, value ${value === null ? 'none' : formatMetricValue(metric, value)}`}
                        className={cn(
                          'flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] transition-shadow',
                          status === 'special' && 'border-[#FF3B30]/40 bg-[#FF3B30]/[0.06]',
                          status === 'watch' && 'border-[#FFCC00]/50 bg-[#FFCC00]/[0.08]',
                        )}
                      >
                        <StatusSymbol status={status} />
                        <span className="font-num text-[11px] font-semibold text-[var(--dcl-ink-700)]">
                          {value === null ? '—' : formatMetricValue(metric, value)}
                        </span>
                        <span className="max-w-full truncate px-1 text-[10px] text-[var(--dcl-ink-400)]">{metric.shortName}</span>
                      </motion.button>
                    </td>
                  );
                })}
                {Array.from({ length: maxCols - domain.metricIds.length }, (_, i) => (
                  <td key={`pad-${i}`} className="p-0" aria-hidden="true" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11.5px] text-[var(--dcl-ink-500)]">
        <span className="flex items-center gap-1.5"><StatusSymbol status="stable" /> Stable / favorable</span>
        <span className="flex items-center gap-1.5"><StatusSymbol status="watch" /> Watch / run rule</span>
        <span className="flex items-center gap-1.5"><StatusSymbol status="special" /> Special cause</span>
        <span className="flex items-center gap-1.5"><StatusSymbol status="none" /> No valid data</span>
      </div>
    </motion.section>
  );
}
