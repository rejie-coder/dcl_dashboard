import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from 'lucide-react';
import type { Domain, SPCPoint } from '@/types/dcl';
import { METRIC_MAP, formatMetricValue } from '@/data/metrics';
import { metricScore } from '@/lib/score';
import { cn } from '@/lib/utils';
import { SignalChip, deltaInfo, metricStatus, polarityLabel, targetLabel } from './domain-shared';

/**
 * Pulse summary tiles (per-domain design section 2): one tile per KPI with
 * current value, polarity label, target, delta vs prior period, target
 * progress bar, status chip, and period tag. Clicking a tile scrolls to and
 * outlines the matching chart; "Details" opens the MetricDetailDrawer.
 */
export function KPISummaryTiles({
  domain,
  seriesByMetric,
  highlightedMetric,
  onSelect,
  onOpenDetails,
}: {
  domain: Domain;
  seriesByMetric: Record<string, SPCPoint[]>;
  highlightedMetric: string | null;
  onSelect: (metricId: string) => void;
  onOpenDetails: (metricId: string) => void;
}) {
  return (
    <section aria-label={`${domain.name} summary`} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {domain.metricIds.map((metricId, i) => {
        const metric = METRIC_MAP[metricId];
        const points = seriesByMetric[metricId] ?? [];
        const latest = points.at(-1);
        const latestPeriod = latest?.label ?? null;
        if (!metric) return null;

        const status = metricStatus(points);
        const delta = deltaInfo(metric, points);
        const progress = Math.min(Math.max(metricScore(metric, latest?.value ?? null), 0), 100);
        const improving = status === 'run-rule' && delta.favorable === true;
        const highlighted = highlightedMetric === metricId;

        return (
          <motion.article
            key={metricId}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'dcl-card flex cursor-pointer flex-col gap-2.5 rounded-[20px] p-4 transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,.10)]',
              highlighted && 'ring-2 ring-offset-2',
            )}
            style={highlighted ? ({ ['--tw-ring-color' as string]: domain.color } as React.CSSProperties) : undefined}
            onClick={() => onSelect(metricId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(metricId);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`${metric.name}: ${formatMetricValue(metric, latest?.value ?? null)}. Target ${targetLabel(metric)}.`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">
                  {metric.name}
                </h3>
                <p className="text-[11px] font-medium text-[var(--dcl-ink-400)]">{polarityLabel(metric)}</p>
              </div>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: domain.colorSoft }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: domain.color }} />
              </span>
            </div>

            <div className="flex items-end justify-between gap-2">
              <span className="font-num text-[26px] font-semibold leading-none tracking-[-0.02em] text-[var(--dcl-ink-900)]">
                {formatMetricValue(metric, latest?.value ?? null)}
              </span>
              <SignalChip status={status} />
            </div>

            <p className="text-[11.5px] text-[var(--dcl-ink-500)]">
              Target <span className="font-num font-semibold text-[var(--dcl-ink-700)]">{targetLabel(metric)}</span>
            </p>

            {/* Progress toward target */}
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--dcl-surface-tint)]" role="presentation">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.08, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: progress >= 100 ? '#34C759' : domain.color }}
              />
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span
                className={cn(
                  'flex min-w-0 items-center gap-1 font-medium',
                  delta.favorable === true && 'text-[#1F7A38]',
                  delta.favorable === false && 'text-[#B42318]',
                  delta.favorable === null && 'text-[var(--dcl-ink-500)]',
                )}
              >
                {delta.direction === 1 ? (
                  <ArrowUpRight className="h-3 w-3 shrink-0" />
                ) : delta.direction === -1 ? (
                  <ArrowDownRight className="h-3 w-3 shrink-0" />
                ) : (
                  <Minus className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">{delta.text}</span>
              </span>
              {improving && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-[#34C759]/12 px-2 py-0.5 text-[10px] font-semibold text-[#1F7A38]"
                >
                  <Sparkles className="h-2.5 w-2.5" /> Improving
                </motion.span>
              )}
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--dcl-line)]/70 pt-2">
              <span className="text-[10.5px] font-medium text-[var(--dcl-ink-400)]">
                {latestPeriod ? `Latest · ${latestPeriod}` : 'No periods'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetails(metricId);
                }}
                className="text-[11px] font-semibold transition hover:underline"
                style={{ color: domain.color }}
              >
                Details
              </button>
            </div>
          </motion.article>
        );
      })}
    </section>
  );
}
