import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { METRICS } from '@/data/metrics';
import { unitName } from '@/data/units';
import { useDataset } from '@/hooks/useDataset';
import { usePersistentFilters } from '@/hooks/usePersistentFilters';
import { computeSPC } from '@/hooks/useSPC';
import { deriveAlerts } from '@/lib/alerts';
import { computeDomainScores } from '@/lib/score';
import { AlertFeed, type CounterFilter } from '@/components/insights/AlertFeed';
import { SignalMap } from '@/components/insights/SignalMap';
import { ActionTracker } from '@/components/insights/ActionTracker';
import { SPCRuleGuide } from '@/components/insights/SPCRuleGuide';
import { ExecutiveExport } from '@/components/insights/ExecutiveExport';
import { enrichAlerts } from '@/components/insights/alert-model';
import { useInsightsStore } from '@/components/insights/action-store';

/** easeOutExpo count-up (500ms) for header counters. */
function useCountUp(target: number, duration = 500): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t);
      setValue(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

function Counter({
  label,
  value,
  active,
  accent,
  onClick,
  delay,
}: {
  label: string;
  value: number;
  active: boolean;
  accent: string;
  onClick: () => void;
  delay: number;
}) {
  const animated = useCountUp(value);
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay }}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'dcl-card relative min-w-[104px] rounded-2xl px-4 py-3 text-left transition-shadow',
        active && 'shadow-[0_8px_24px_rgba(15,23,42,.10)]',
      )}
    >
      <span className="font-num block text-[24px] font-semibold leading-none" style={{ color: accent }}>
        {animated}
      </span>
      <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-500)]">
        {label}
      </span>
      {active && (
        <motion.span
          layoutId="counter-underline"
          className="absolute inset-x-4 -bottom-px h-0.5 rounded-full"
          style={{ backgroundColor: accent }}
          transition={{ duration: 0.18 }}
        />
      )}
    </motion.button>
  );
}

/**
 * Insights & Alerts page (insights.md): cross-domain SPC alert feed, signal
 * map, action tracker, SPC rule guide, and executive export. Respects the
 * global time-scale and unit filters.
 */
export default function InsightsPage() {
  const { dataset, isImported } = useDataset();
  const { timeScale, unitId } = usePersistentFilters();
  const acknowledged = useInsightsStore((s) => s.acknowledged);
  const [counterFilter, setCounterFilter] = useState<CounterFilter>('all');

  useEffect(() => {
    document.title = 'DCL Pulse — Insights & Alerts';
  }, []);

  // SPC series for every registered metric (27 KPIs) under the current global filters
  const seriesByMetric = useMemo(
    () => Object.fromEntries(METRICS.map((m) => [m.id, computeSPC(dataset, m.id, unitId, timeScale)])),
    [dataset, unitId, timeScale],
  );
  const alerts = useMemo(
    () => enrichAlerts(deriveAlerts(seriesByMetric, unitName(unitId)), seriesByMetric, unitId),
    [seriesByMetric, unitId],
  );
  const domainScores = useMemo(() => computeDomainScores(seriesByMetric), [seriesByMetric]);

  const specialCount = alerts.filter((a) => a.kind === 'special-cause' && !a.favorable).length;
  const runRuleCount = alerts.filter((a) => a.kind === 'run-rule' && !a.favorable).length;
  const favorableCount = alerts.filter((a) => a.favorable).length;
  const reviewedCount = alerts.filter((a) => acknowledged[a.id]).length;

  const interpretation = useMemo(() => {
    const parts: string[] = [];
    const needing = specialCount + runRuleCount;
    if (needing > 0) {
      parts.push(`${needing} active signal${needing === 1 ? '' : 's'} require${needing === 1 ? 's' : ''} review.`);
    } else {
      parts.push('No active signals require review.');
    }
    if (favorableCount > 0) {
      parts.push(`${favorableCount} favorable improvement${favorableCount === 1 ? ' is' : 's are'} worth sustaining.`);
    }
    return parts.join(' ');
  }, [specialCount, runRuleCount, favorableCount]);

  const toggleCounter = (f: CounterFilter) => setCounterFilter((cur) => (cur === f ? 'all' : f));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Section 1: Header + alert summary ────────────────────────── */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--dcl-ink-500)]"
          >
            SPC signal triage
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="font-display mt-1 text-[32px] font-bold leading-[1.12] tracking-[-0.035em] text-[var(--dcl-ink-900)]"
          >
            Insights &amp; Alerts
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, delay: 0.08 }}
            className="mt-2 max-w-xl text-[14.5px] leading-[1.55] text-[var(--dcl-ink-500)]"
          >
            Statistically meaningful changes across all five domains.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, delay: 0.12 }}
            className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--dcl-ink-700)]"
          >
            <Activity className="h-3.5 w-3.5 text-[#007AFF]" />
            {interpretation}
          </motion.p>
          <p className="mt-1.5 text-[11.5px] text-[var(--dcl-ink-400)]">
            Source: {isImported ? 'imported dataset' : 'sample data'} · {unitName(unitId)} · grain: {timeScale}
          </p>
        </div>

        <div className="flex gap-2.5">
          <Counter
            label="Special causes"
            value={specialCount}
            accent="#FF3B30"
            active={counterFilter === 'special-cause'}
            onClick={() => toggleCounter('special-cause')}
            delay={0.1}
          />
          <Counter
            label="Run rules"
            value={runRuleCount}
            accent="#B45309"
            active={counterFilter === 'run-rule'}
            onClick={() => toggleCounter('run-rule')}
            delay={0.16}
          />
          <Counter
            label="Reviewed"
            value={reviewedCount}
            accent="#1F7A38"
            active={counterFilter === 'reviewed'}
            onClick={() => toggleCounter('reviewed')}
            delay={0.22}
          />
        </div>
      </section>

      {/* ── Sections 2 + 3: controls + ranked alert feed + preview rail ── */}
      {alerts.length === 0 ? (
        <div className="dcl-card flex flex-col items-center gap-3 rounded-[24px] p-10 text-center">
          <ShieldCheck className="h-8 w-8 text-[#34C759]" />
          <p className="font-display text-[17px] font-semibold text-[var(--dcl-ink-900)]">No active SPC signals</p>
          <p className="max-w-md text-[13px] text-[var(--dcl-ink-500)]">
            All {METRICS.length} KPIs are within expected variation under the current filters. The signal map and rule
            guide below remain available for reference.
          </p>
        </div>
      ) : (
        <AlertFeed
          alerts={alerts}
          seriesByMetric={seriesByMetric}
          counterFilter={counterFilter}
          onCounterFilterChange={setCounterFilter}
        />
      )}

      {/* ── Section 4: Cross-domain signal map ───────────────────────── */}
      <SignalMap seriesByMetric={seriesByMetric} />

      {/* ── Section 5: Action tracker ────────────────────────────────── */}
      <ActionTracker />

      {/* ── Section 6: SPC rule guide ────────────────────────────────── */}
      <SPCRuleGuide />

      {/* ── Section 7: Executive report export ───────────────────────── */}
      <ExecutiveExport alerts={alerts} domainScores={domainScores} unitId={unitId} />

      {/* ARIA live region for alert selection announcements */}
      <div aria-live="polite" className="sr-only">
        {alerts.length === 0
          ? 'No active SPC signals.'
          : `${alerts.length} active alerts. ${specialCount} special causes, ${runRuleCount} run rules.`}
      </div>
    </div>
  );
}
