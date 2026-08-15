import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Domain, DomainScore, SPCPoint } from '@/types/dcl';
import { METRIC_MAP, formatMetricValue } from '@/data/metrics';
import { SPCMiniChart } from '@/components/charts/SPCMiniChart';

const STATUS_CHIP: Record<DomainScore['status'], { label: string; className: string }> = {
  'in-control': { label: 'In control', className: 'bg-[#34C759]/12 text-[#1F7A38] ring-[#34C759]/30' },
  watch: { label: 'Watch', className: 'bg-[#FFCC00]/15 text-[#713F12] ring-[#FFCC00]/40' },
  'action-needed': { label: 'Action needed', className: 'bg-[#FF3B30]/10 text-[#B42318] ring-[#FF3B30]/30' },
  'no-signal': { label: 'No signal', className: 'bg-[#8E8E93]/10 text-[var(--dcl-ink-500)] ring-[#8E8E93]/25' },
};

export interface MetricChipData {
  metricId: string;
  value: number | null;
  /** direction of latest change: 1 up, -1 down, 0 flat */
  direction: 1 | -1 | 0;
  /** whether the latest move is favorable given polarity */
  favorable: boolean | null;
}

/**
 * Level 1 composite domain card (design.md 6.3 / home.md section 3).
 */
export function DomainCard({
  domain,
  score,
  series,
  chips,
  index = 0,
}: {
  domain: Domain;
  score: DomainScore;
  series: SPCPoint[];
  chips: MetricChipData[];
  index?: number;
}) {
  const navigate = useNavigate();
  const chip = STATUS_CHIP[score.status];
  const pseudoMetric = METRIC_MAP[domain.metricIds[0]];
  const deltaPositive = score.delta >= 0;
  const targetProgress = Math.min(score.score, 100);
  // Domains now carry 4–8 KPIs; keep cards compact with an expand affordance.
  const CHIP_PREVIEW_COUNT = 4;
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const visibleChips = chipsExpanded ? chips : chips.slice(0, CHIP_PREVIEW_COUNT);
  const hiddenChipCount = chips.length - CHIP_PREVIEW_COUNT;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, delay: index * 0.055, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      onClick={() => navigate(domain.route)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(domain.route);
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`${domain.name}: composite score ${score.score}. View details.`}
      className="dcl-card dcl-card-hover group flex min-h-[310px] cursor-pointer flex-col gap-4 rounded-[28px] p-6"
      style={{ ['--domain-accent' as string]: domain.color, ['--domain-accent-soft' as string]: domain.colorSoft }}
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: `linear-gradient(135deg, ${domain.color}, ${domain.gradientTo})` }}
        >
          <span className="font-display text-[15px] font-bold">{domain.name.slice(0, 1)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">
            {domain.name}
          </h3>
          <p className="truncate text-[12.5px] text-[var(--dcl-ink-500)]">{domain.outcomeSentence}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1', chip.className)}>
          {chip.label}
        </span>
      </div>

      {/* Score row */}
      <div className="flex items-end gap-3">
        <span className="font-num text-[44px] font-semibold leading-none tracking-[-0.03em] text-[var(--dcl-ink-900)]">
          {score.score}
        </span>
        <span
          className={cn(
            'mb-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
            deltaPositive ? 'bg-[#34C759]/12 text-[#1F7A38]' : 'bg-[#FF3B30]/10 text-[#B42318]',
          )}
        >
          {deltaPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {deltaPositive ? '+' : ''}
          {score.delta.toFixed(1)} pts
        </span>
        <span className="mb-1.5 text-[11px] font-medium text-[var(--dcl-ink-400)]">vs prior period</span>
      </div>

      {/* Mini SPC */}
      {series.length > 0 && pseudoMetric ? (
        <div className="rounded-2xl bg-[var(--dcl-surface-tint)] p-2 transition-transform duration-200 group-hover:scale-[1.015]">
          <SPCMiniChart points={series} accent={domain.color} metric={{ ...pseudoMetric, name: `${domain.name} composite` }} height={92} />
        </div>
      ) : (
        <div className="flex h-[108px] items-center justify-center rounded-2xl bg-[var(--dcl-surface-tint)]">
          <img src={`${import.meta.env.BASE_URL}no-data-chart.svg`} alt="No valid observations" className="h-full object-contain" />
        </div>
      )}

      {/* Target progress */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-[var(--dcl-ink-500)]">
          <span>Target progress</span>
          <span className="font-num">{Math.round(targetProgress)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--dcl-line)]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${domain.color}, ${domain.gradientTo})` }}
            initial={{ width: 0 }}
            animate={{ width: `${targetProgress}%` }}
            transition={{ duration: 0.7, delay: 0.2 + index * 0.055, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Metric chips */}
      <div className="grid grid-cols-2 gap-1.5">
        {visibleChips.map((c) => {
          const metric = METRIC_MAP[c.metricId];
          if (!metric) return null;
          const Arrow = c.direction === 0 ? Minus : c.direction === 1 ? TrendingUp : TrendingDown;
          const arrowColor =
            c.favorable === null ? 'text-[var(--dcl-ink-400)]' : c.favorable ? 'text-[#1F7A38]' : 'text-[#B42318]';
          return (
            <div
              key={c.metricId}
              className="flex items-center justify-between gap-2 rounded-lg bg-[var(--dcl-surface-tint)] px-2.5 py-1.5"
              title={metric.name}
            >
              <span className="truncate text-[11.5px] font-medium text-[var(--dcl-ink-700)]">{metric.shortName}</span>
              <span className="flex items-center gap-1">
                <span className="font-num text-[11.5px] font-medium text-[var(--dcl-ink-900)]">
                  {formatMetricValue(metric, c.value)}
                </span>
                <Arrow className={cn('h-3 w-3', arrowColor)} />
              </span>
            </div>
          );
        })}
        {hiddenChipCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setChipsExpanded((v) => !v);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            aria-expanded={chipsExpanded}
            className="col-span-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--dcl-line-strong)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--dcl-ink-500)] transition-colors hover:bg-[var(--dcl-surface-tint)] hover:text-[var(--dcl-ink-700)]"
          >
            {chipsExpanded ? 'Show fewer' : `+${hiddenChipCount} more KPI${hiddenChipCount === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-[var(--dcl-line)] pt-3 text-[12px] font-medium text-[var(--dcl-ink-500)]">
        <span>{chips.length} KPIs · updated Dec 2024</span>
        <span className="flex items-center gap-0.5 transition-colors" style={{ color: domain.color }}>
          View details
          <ChevronRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
        </span>
      </div>
    </motion.article>
  );
}
