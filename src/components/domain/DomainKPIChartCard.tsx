import { motion } from 'framer-motion';
import { Download, Maximize2 } from 'lucide-react';
import { METRIC_MAP, formatMetricValue } from '@/data/metrics';
import { useSPC } from '@/hooks/useSPC';
import { useFilterStore } from '@/stores/filter-store';
import { SPCChart } from '@/components/charts/SPCChart';
import { cn } from '@/lib/utils';
import { SignalChip, exportSeriesCSV, polarityLabel, targetLabel } from './domain-shared';

/**
 * Level 2 KPI SPC chart card (per-domain design section 3). Same visual
 * contract as KPIChartCard, plus helper copy, an "Open details" button that
 * opens the MetricDetailDrawer, and a per-series CSV export. Reacts to global
 * filters via useSPC.
 */
export function DomainKPIChartCard({
  metricId,
  accent,
  index = 0,
  highlighted = false,
  onOpenDetails,
}: {
  metricId: string;
  accent: string;
  index?: number;
  highlighted?: boolean;
  onOpenDetails: (metricId: string) => void;
}) {
  const metric = METRIC_MAP[metricId];
  const unitId = useFilterStore((s) => s.unitId);
  const { points, insufficientBaseline } = useSPC(metricId);

  if (!metric) return null;

  const latest = points.at(-1);
  const status = insufficientBaseline ? 'no-data' : latest?.signal ?? 'in-control';

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      aria-label={metric.name}
      className={cn('dcl-card flex h-[340px] flex-col rounded-[24px] p-5', highlighted && 'ring-2 ring-offset-2')}
      style={highlighted ? ({ ['--tw-ring-color' as string]: accent } as React.CSSProperties) : undefined}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display truncate text-[15.5px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">
            {metric.name}
          </h3>
          <p className="text-[12px] text-[var(--dcl-ink-500)]">
            {polarityLabel(metric)} · Target {targetLabel(metric)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-num text-[20px] font-semibold leading-none text-[var(--dcl-ink-900)]">
            {formatMetricValue(metric, latest?.value ?? null)}
          </span>
          <SignalChip status={status} className={insufficientBaseline ? '' : undefined} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {points.length > 0 ? (
          <SPCChart title={metric.shortName} points={points} accent={accent} metric={metric} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl bg-[var(--dcl-surface-tint)]">
            <img src={`${import.meta.env.BASE_URL}no-data-chart.svg`} alt="" className="h-32 object-contain" />
            <p className="text-[13px] font-medium text-[var(--dcl-ink-500)]">
              {insufficientBaseline ? 'Insufficient baseline — 12 periods required' : 'No valid observations'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--dcl-line)]/70 pt-2">
        <p className="truncate text-[11px] text-[var(--dcl-ink-400)]">{metric.description}</p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Export ${metric.name} CSV`}
            title="Export CSV"
            onClick={() => exportSeriesCSV(metric, unitId, points)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--dcl-ink-400)] transition hover:bg-[var(--dcl-surface-tint)] hover:text-[var(--dcl-ink-900)]"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onOpenDetails(metricId)}
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold transition hover:underline"
            style={{ color: accent }}
          >
            <Maximize2 className="h-3 w-3" /> Open details
          </button>
        </div>
      </div>
    </motion.section>
  );
}
