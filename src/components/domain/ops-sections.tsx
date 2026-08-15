import type { Domain, DomainScore, SPCPoint } from '@/types/dcl';
import { buildBoardSummary } from './domain-shared';
import { ActionQueueCard, CopySummaryButton, DualSeriesMiniChart, MethodologyFooter, SignalListCard } from './rail-shared';

/**
 * Operational Efficiency domain sections (operational-efficiency.md):
 * Section 4 — Flow Bottleneck Insight Rail (active flow signals, occupancy ×
 * turnaround relationship chart, action queue) and Section 5 — operations
 * methodology + data quality footer.
 */

export function FlowBottleneckRail({
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
        Flow bottlenecks
      </h2>
      <SignalListCard title="Active flow signals" domain={domain} seriesByMetric={seriesByMetric} onOpenMetric={onOpenMetric} />
      <DualSeriesMiniChart
        title="Flow relationship"
        metricAId="bed-occupancy-rate"
        metricBId="diagnostic-turnaround-time"
        accentA={domain.color}
        accentB="#64748B"
        insightText="Occupancy above 88% coincides with longer turnaround in recent periods."
        delay={0.08}
      />
      <ActionQueueCard
        title="Action queue"
        ctaLabel="Add operations action"
        storageKey="dcl-actions-operational-efficiency"
        delay={0.16}
        seedActions={[
          { text: 'Review discharge lounge capacity', owner: 'Operations' },
          { text: 'Audit OPD clinic template', owner: 'Outpatient Lead' },
        ]}
      />
      <CopySummaryButton
        label="Copy flow summary"
        text={buildBoardSummary(domain, score, seriesByMetric)}
        accent={domain.color}
      />
    </div>
  );
}

export function OpsMethodologyFooter({ domain }: { domain: Domain }) {
  return (
    <MethodologyFooter
      heading="How operational limits are calculated"
      copy="Utilization percentages use p-chart limits. Wait and turnaround times use individuals charts. Preferred operating bands are management targets, not control limits."
      formula="p-chart: CL = p̄, UCL/LCL = p̄ ± 3√(p̄(1−p̄)/n) with limits varying by denominator. i-chart: CL = x̄, UCL/LCL = x̄ ± 2.66 · MR̄. Preferred bands: bed occupancy 75–88%, theatre utilization 70–85%. Baseline: first 20 completed periods."
      auditItems={[
        { label: 'Completeness', value: '99.4%' },
        { label: 'Blocking errors', value: '0' },
        { label: 'Source', value: 'Sample data' },
      ]}
      domainId={domain.id}
      accent={domain.color}
    />
  );
}
