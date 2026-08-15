import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import type { Domain, DomainScore, SPCPoint } from '@/types/dcl';
import { buildBoardSummary } from './domain-shared';
import { ActionQueueCard, CopySummaryButton, DualSeriesMiniChart, MethodologyFooter, SignalListCard } from './rail-shared';

/**
 * HR Development domain sections (hr-development.md):
 * Section 4 — People Insight Rail (workforce signals, capability trend,
 * action queue) and Section 5 — methodology + privacy footer.
 */

export function PeopleInsightRail({
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
        People insights
      </h2>
      <SignalListCard title="Workforce signals" domain={domain} seriesByMetric={seriesByMetric} onOpenMetric={onOpenMetric} />
      <DualSeriesMiniChart
        title="Capability trend"
        metricAId="training-programs-conducted"
        metricBId="cpd-participation-rate"
        accentA={domain.color}
        accentB="#64748B"
        insightText="Periods with more training programmes conducted tend to be followed by stronger CPD participation."
        delay={0.08}
      />
      <ActionQueueCard
        title="Action queue"
        ctaLabel="Add people action"
        storageKey="dcl-actions-hr-development"
        delay={0.16}
        seedActions={[
          { text: 'Recognize unit training leads', owner: 'HRBP' },
          { text: 'Review agency cover linked to absence', owner: 'Workforce Planning' },
        ]}
      />
      <CopySummaryButton
        label="Copy workforce summary"
        text={buildBoardSummary(domain, score, seriesByMetric)}
        accent={domain.color}
      />
    </div>
  );
}

export function HRMethodologyFooter({ domain }: { domain: Domain }) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setPrivacyOpen(true)}
        className="dcl-card flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left transition hover:bg-[var(--dcl-surface-tint)]"
      >
        <ShieldAlert className="h-4 w-4 shrink-0" style={{ color: domain.color }} />
        <span className="text-[12.5px] text-[var(--dcl-ink-700)]">
          <span className="font-semibold text-[var(--dcl-ink-900)]">Privacy reminder:</span> Use aggregate workforce data
          only. Do not enter employee names or identifiers.
        </span>
      </button>

      <MethodologyFooter
        heading="How workforce limits are calculated"
        copy="Turnover, absenteeism, and CPD participation use p-chart limits. Training programmes conducted is a volume indicator on an individuals chart and is excluded from the composite score. The baseline uses the first 20 completed periods."
        formula="p-chart: CL = p̄, UCL/LCL = p̄ ± 3√(p̄(1−p̄)/n). i-chart (training programmes): CL = x̄, UCL/LCL = x̄ ± 2.66 · MR̄. Turnover is a per-staff-week rate (×52 ≈ annualised, e.g. 0.17% ≈ 9%/yr). Targets: turnover ≤ 0.2%/staff-week, absenteeism ≤ 4%, CPD ≥ 75%."
        auditItems={[
          { label: 'Completeness', value: '99.6%' },
          { label: 'Blocking errors', value: '0' },
          { label: 'Source', value: 'Sample data' },
        ]}
        domainId={domain.id}
        accent={domain.color}
      />

      {privacyOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/25 p-4"
          onClick={() => setPrivacyOpen(false)}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Local data handling"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[var(--dcl-surface-raised)] p-5 shadow-xl"
          >
            <h3 className="font-display text-[16px] font-semibold text-[var(--dcl-ink-900)]">Local data handling</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--dcl-ink-500)]">
              Workforce metrics are stored and processed only in this browser as aggregate rates. Do not enter employee
              names, identifiers, or case-level details into notes or imports. Files are parsed locally — nothing is
              uploaded.
            </p>
            <button
              type="button"
              onClick={() => setPrivacyOpen(false)}
              className="mt-4 h-9 w-full rounded-xl text-[12.5px] font-semibold text-white"
              style={{ backgroundColor: domain.color }}
            >
              Understood
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
