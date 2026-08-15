import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Domain, DomainScore, SPCPoint } from '@/types/dcl';
import { METRIC_MAP, formatMetricValue } from '@/data/metrics';
import { buildBoardSummary } from './domain-shared';
import { formatMetricTick } from './metric-formulas';
import { ActionQueueCard, CopySummaryButton, MethodologyFooter, RailCard, SignalListCard } from './rail-shared';

/**
 * Financial Efficiency domain sections (financial-efficiency.md):
 * Section 4 — Financial Driver Insight Rail (signals, period expenditure
 * breakdown across the LKR spend lines, action log) and Section 5 —
 * methodology + audit footer. All monetary values are LKR.
 */

/* ── Period expenditure breakdown (LKR spend lines) ────────────────── */

const EXPENDITURE_IDS = [
  'local-purchase-expenditure',
  'fuel-expenditure',
  'electricity-bill',
  'water-bill',
] as const;

function ExpenditureBreakdown({
  accent,
  seriesByMetric,
  onOpenMetric,
}: {
  accent: string;
  seriesByMetric: Record<string, SPCPoint[]>;
  onOpenMetric: (metricId: string) => void;
}) {
  const costMetric = METRIC_MAP['cost-per-patient-day'];
  const costPoints = seriesByMetric['cost-per-patient-day'] ?? [];

  const rows = useMemo(
    () =>
      EXPENDITURE_IDS.map((id) => {
        const metric = METRIC_MAP[id];
        const points = seriesByMetric[id] ?? [];
        const latest = points.at(-1);
        return metric && latest ? { metric, value: latest.value, label: latest.label } : null;
      }).filter((r): r is NonNullable<typeof r> => r !== null),
    [seriesByMetric],
  );

  const costLatest = costPoints.at(-1);
  const periodLabel = rows[0]?.label ?? costLatest?.label ?? null;

  if (rows.length === 0 || !costMetric) {
    return (
      <RailCard title="Period expenditure breakdown" delay={0.08}>
        <p className="rounded-xl bg-[var(--dcl-surface-tint)] px-3 py-2.5 text-[12px] text-[var(--dcl-ink-500)]">
          No expenditure observations for this selection.
        </p>
      </RailCard>
    );
  }

  const maxVal = Math.max(...rows.map((r) => r.value), 1);
  const barPct = (v: number) => `${Math.max((v / maxVal) * 100, 2)}%`;

  const narrative = costLatest
    ? `Cost per patient day is ${formatMetricValue(costMetric, costLatest.value)}${
        costMetric.target != null ? ` vs target ≤ ${formatMetricValue(costMetric, costMetric.target)}` : ''
      }. Expenditure lines are volume indicators — they inform spend reviews but stay out of the composite score.`
    : 'Expenditure lines are volume indicators — they inform spend reviews but stay out of the composite score.';

  return (
    <RailCard title={`Expenditure breakdown${periodLabel ? ` — ${periodLabel}` : ''}`} delay={0.08}>
      <div className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <button
            key={row.metric.id}
            type="button"
            onClick={() => onOpenMetric(row.metric.id)}
            className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-[var(--dcl-surface-tint)]"
            title={`${row.metric.name}: ${formatMetricValue(row.metric, row.value)} — open metric detail`}
          >
            <span className="w-24 shrink-0 truncate text-[11px] font-medium text-[var(--dcl-ink-500)]">
              {row.metric.shortName}
            </span>
            <div className="h-6 flex-1 overflow-hidden rounded-md bg-[var(--dcl-surface-tint)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: barPct(row.value) }}
                transition={{ duration: 0.45, delay: 0.06 * (i + 1), ease: 'easeOut' }}
                className="h-full rounded-md"
                style={{ backgroundColor: accent }}
              />
            </div>
            <span className="font-num w-20 shrink-0 text-right text-[11px] font-semibold text-[var(--dcl-ink-700)]">
              {formatMetricTick(row.metric, row.value)}
            </span>
          </button>
        ))}
      </div>
      <p className="rounded-xl bg-[var(--dcl-surface-tint)] px-3 py-2 text-[12px] leading-snug text-[var(--dcl-ink-700)]">
        {narrative}
      </p>
    </RailCard>
  );
}

/* ── Rail + footer exports ─────────────────────────────────────────── */

export function FinancialDriverRail({
  domain,
  seriesByMetric,
  score,
  onOpenMetric,
}: {
  domain: Domain;
  seriesByMetric: Record<string, SPCPoint[]>;
  score: DomainScore;
  onOpenMetric: (metricId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">
        Financial drivers
      </h2>
      <SignalListCard title="Financial signals" domain={domain} seriesByMetric={seriesByMetric} onOpenMetric={onOpenMetric} />
      <ExpenditureBreakdown accent={domain.color} seriesByMetric={seriesByMetric} onOpenMetric={onOpenMetric} />
      <ActionQueueCard
        title="Action log"
        ctaLabel="Add finance note"
        storageKey="dcl-actions-financial-efficiency"
        delay={0.16}
        seedActions={[
          { text: 'Review agency staffing premium', owner: 'Finance Business Partner' },
          { text: 'Confirm stock-out coding changes', owner: 'Procurement' },
        ]}
      />
      <CopySummaryButton
        label="Copy board summary"
        text={buildBoardSummary(domain, score, seriesByMetric)}
        accent={domain.color}
      />
    </div>
  );
}

export function FinanceMethodologyFooter({ domain }: { domain: Domain }) {
  return (
    <MethodologyFooter
      heading="How financial limits are calculated"
      copy="Cost per patient day, petty cash utilization, and the LKR expenditure lines (local purchases, fuel, electricity, water) use individuals charts. Stock-out proportion uses a p-chart. Targets are management thresholds and are not control limits."
      formula="i-chart: CL = x̄, UCL/LCL = x̄ ± 2.66 · MR̄ (MR̄ / 1.128 sigma estimate). p-chart: CL = p̄, UCL/LCL = p̄ ± 3√(p̄(1−p̄)/n). Baseline: first 20 completed periods; LCL floored at zero for non-negative metrics. Cost per patient day = Total Operating Expenses ÷ Total Inpatient Days; petty cash utilization = Petty Cash Expenditure ÷ Petty Cash Allocation × 100. All amounts are Sri Lankan rupees."
      auditItems={[
        { label: 'Dataset', value: 'Sample FY2022–FY2024' },
        { label: 'Completeness', value: '99.1%' },
        { label: 'Currency', value: 'LKR' },
      ]}
      domainId={domain.id}
      accent={domain.color}
    />
  );
}
