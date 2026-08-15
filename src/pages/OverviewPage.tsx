import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  CalendarRange,
  Database,
  Download,
  FileSpreadsheet,
  Flame,
  Gauge,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DOMAINS } from '@/data/domains';
import { METRICS } from '@/data/metrics';
import { unitName } from '@/data/units';
import { useDataset } from '@/hooks/useDataset';
import { usePersistentFilters } from '@/hooks/usePersistentFilters';
import { computeSPC } from '@/hooks/useSPC';
import { compositeSeries, computeDomainScores, computeGlobalHealth } from '@/lib/score';
import { buildNarrative, deriveAlerts } from '@/lib/alerts';
import { DomainCard, type MetricChipData } from '@/components/domain/DomainCard';
import { generateTemplateBlob } from '@/lib/export-template';

const GRAIN_LABEL: Record<string, string> = { week: 'Week', month: 'Month', year: 'Year' };

/** easeOutExpo count-up */
function useCountUp(target: number, duration = 800): number {
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

/** Donut ring segmented by the five domain colors. */
function HealthRing({ size = 88 }: { size?: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const seg = c / DOMAINS.length;
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" className="-rotate-90">
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--dcl-line)" strokeWidth="7" />
      {DOMAINS.map((d, i) => (
        <motion.circle
          key={d.id}
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={d.color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${seg - 5} ${c - seg + 5}`}
          initial={{ strokeDashoffset: -i * seg + c / 4, opacity: 0 }}
          animate={{ strokeDashoffset: -i * seg + c / 4, opacity: 1 }}
          transition={{ duration: 0.9, delay: i * 0.06, ease: 'easeOut' }}
        />
      ))}
    </svg>
  );
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const { dataset, isImported, lastSavedAt } = useDataset();
  const { timeScale, unitId } = usePersistentFilters();
  const [ringOpen, setRingOpen] = useState(false);

  useEffect(() => {
    document.title = 'DCL Pulse — Executive Overview';
  }, []);

  // Every registered metric series under current filters (27 KPIs)
  const seriesByMetric = useMemo(
    () => Object.fromEntries(METRICS.map((m) => [m.id, computeSPC(dataset, m.id, unitId, timeScale)])),
    [dataset, unitId, timeScale],
  );

  const domainScores = useMemo(() => computeDomainScores(seriesByMetric), [seriesByMetric]);
  const health = useMemo(() => computeGlobalHealth(domainScores), [domainScores]);
  const animatedScore = useCountUp(health.score);

  // KPIs that contribute to composite scores (volume indicators carry weight 0)
  const scoredKpiCount = useMemo(() => METRICS.filter((m) => (m.weight ?? 1) > 0).length, []);

  const alerts = useMemo(() => deriveAlerts(seriesByMetric, unitName(unitId)), [seriesByMetric, unitId]);
  const narrative = useMemo(() => buildNarrative(alerts), [alerts]);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  const stableCount = useMemo(
    () => METRICS.filter((m) => !(seriesByMetric[m.id]?.at(-1)?.signal)).length,
    [seriesByMetric],
  );
  const signalCount = METRICS.length - stableCount;
  const bestMover = useMemo(
    () => domainScores.reduce((best, d) => (d.delta > best.delta ? d : best), domainScores[0]),
    [domainScores],
  );
  const bestMoverDomain = DOMAINS.find((d) => d.id === bestMover?.domainId);

  const lastPeriod = useMemo(() => {
    const pts = seriesByMetric[METRICS[0].id] ?? [];
    return pts.at(-1);
  }, [seriesByMetric]);

  const actionNeededCount = domainScores.filter((d) => d.status === 'action-needed' || d.status === 'watch').length;

  const periodLabel = lastPeriod
    ? timeScale === 'year'
      ? lastPeriod.periodStart.slice(0, 4)
      : new Date(lastPeriod.periodStart + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    : '—';

  const contextCards = [
    {
      icon: Database,
      label: 'Data coverage',
      value: timeScale === 'week' ? '156 weeks loaded' : timeScale === 'month' ? '36 months loaded' : '3 years loaded',
      sub: `${METRICS.length} active KPIs`,
      onClick: () => navigate('/data'),
    },
    {
      icon: Gauge,
      label: 'Control status',
      value: `${stableCount} stable`,
      sub: `${signalCount} signal${signalCount === 1 ? '' : 's'}`,
      onClick: () => navigate('/insights'),
    },
    {
      icon: Flame,
      label: 'Best mover',
      value: `${bestMoverDomain?.name ?? '—'} ${bestMover && bestMover.delta >= 0 ? '+' : ''}${bestMover?.delta.toFixed(1) ?? '0.0'} pts`,
      sub: 'vs prior period',
      onClick: () => bestMoverDomain && navigate(bestMoverDomain.route),
    },
    {
      icon: CalendarRange,
      label: 'Data freshness',
      value: isImported ? 'Imported dataset' : 'Sample data',
      sub: `updated ${lastSavedAt ? new Date(lastSavedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'Dec 31, 2024'}`,
      onClick: () => navigate('/data'),
    },
  ];

  const handleTemplate = () => {
    const blob = generateTemplateBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dcl-performance-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Section 1: Executive Briefing Header ─────────────────────── */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--dcl-ink-500)]"
          >
            DCL Hospital Performance
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="font-display mt-1 text-[34px] font-bold leading-[1.12] tracking-[-0.035em] text-[var(--dcl-ink-900)]"
          >
            Executive Overview
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, delay: 0.08 }}
            className="mt-2 max-w-xl text-[14.5px] leading-[1.55] text-[var(--dcl-ink-500)]"
          >
            {actionNeededCount === 0
              ? 'Hospital performance is stable overall, with no domains requiring investigation this period.'
              : `Hospital performance is stable overall, with ${actionNeededCount} domain${actionNeededCount === 1 ? '' : 's'} requiring investigation this ${timeScale}.`}
          </motion.p>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, delay: 0.12 }}
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--dcl-line)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--dcl-ink-700)] shadow-sm"
          >
            <CalendarRange className="h-3.5 w-3.5 text-[var(--dcl-ink-400)]" />
            {GRAIN_LABEL[timeScale]} · {periodLabel} · {unitName(unitId)}
          </motion.button>
        </div>

        {/* Global health panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="dcl-card relative w-full max-w-full rounded-[24px] p-5 sm:w-[320px] lg:w-[300px]"
        >
          <button
            type="button"
            onClick={() => setRingOpen((o) => !o)}
            className="flex w-full items-center gap-4 text-left"
            aria-expanded={ringOpen}
            aria-label="Composite health score — view domain contributions"
          >
            <div className="relative">
              <HealthRing />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-num text-[26px] font-semibold text-[var(--dcl-ink-900)]">{animatedScore}</span>
              </div>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--dcl-ink-500)]">Composite Health</p>
              <p className={cn('mt-1 text-[13px] font-semibold', health.delta >= 0 ? 'text-[#1F7A38]' : 'text-[#B42318]')}>
                {health.delta >= 0 ? '+' : ''}
                {health.delta.toFixed(1)} pts vs prior period
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--dcl-ink-400)]">
                Weighted mean of {scoredKpiCount} scored KPIs (volume lines excluded)
              </p>
            </div>
          </button>

          <AnimatePresence>
            {ringOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                className="absolute right-4 top-[calc(100%+6px)] z-30 w-64 rounded-2xl border border-[var(--dcl-line)] bg-white p-3 shadow-xl"
              >
                {domainScores.map((s) => {
                  const d = DOMAINS.find((dom) => dom.id === s.domainId)!;
                  return (
                    <div key={s.domainId} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
                      <span className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--dcl-ink-700)]">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </span>
                      <span className="font-num text-[12.5px] font-semibold text-[var(--dcl-ink-900)]">{s.score}</span>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ── Section 2: Global Context Strip ──────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {contextCards.map((card, i) => (
          <motion.button
            key={card.label}
            type="button"
            onClick={card.onClick}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: 0.15 + i * 0.07 }}
            className="dcl-card group flex items-center gap-3 rounded-[20px] p-4 text-left transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,.10)]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)] transition-colors duration-150 group-hover:bg-[#EAF3FF] group-hover:text-[#007AFF]">
              <card.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-400)]">{card.label}</span>
              <span className="block truncate text-[13.5px] font-semibold text-[var(--dcl-ink-900)]">{card.value}</span>
              <span className="block text-[11.5px] text-[var(--dcl-ink-500)]">{card.sub}</span>
            </span>
          </motion.button>
        ))}
      </section>

      {/* ── Section 3: Five Domain Composite Cards ───────────────────── */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 min-[1440px]:grid-cols-6">
        {DOMAINS.map((domain, i) => {
          const score = domainScores.find((s) => s.domainId === domain.id)!;
          const series = compositeSeries(domain, seriesByMetric, timeScale);
          const chips: MetricChipData[] = domain.metricIds.map((metricId) => {
            const pts = seriesByMetric[metricId] ?? [];
            const latest = pts.at(-1)?.value ?? null;
            const prev = pts.length >= 2 ? pts[pts.length - 2].value : null;
            const direction: 1 | -1 | 0 =
              latest === null || prev === null || latest === prev ? 0 : latest > prev ? 1 : -1;
            const metric = METRICS.find((m) => m.id === metricId)!;
            const favorable =
              direction === 0
                ? null
                : metric.polarity === 'higher'
                  ? direction === 1
                  : metric.polarity === 'lower' || metric.polarity === 'zero'
                    ? direction === -1
                    : null;
            return { metricId, value: latest, direction, favorable };
          });
          const spanClass =
            i < 2
              ? 'min-[1440px]:col-span-3'
              : i === 4
                ? 'md:max-[1439px]:col-span-2 min-[1440px]:col-span-2'
                : 'min-[1440px]:col-span-2';
          return (
            <div key={domain.id} className={spanClass}>
              <DomainCard domain={domain} score={score} series={series} chips={chips} index={i} />
            </div>
          );
        })}
      </section>

      {/* ── Section 4: Priority Attention Panel ──────────────────────── */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.3 }}
          className="dcl-card rounded-[24px] p-6 lg:col-span-8"
        >
          <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--dcl-ink-900)]">Priority attention</h2>
          <p className="mt-0.5 text-[13px] text-[var(--dcl-ink-500)]">Ranked by statistical signal strength and operational impact.</p>

          <div className="mt-4 divide-y divide-[var(--dcl-line)]">
            {alerts.slice(0, 6).map((alert, i) => {
              const domain = DOMAINS.find((d) => d.id === alert.domainId)!;
              const acked = acknowledged.has(alert.id);
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.24, delay: i * 0.05 }}
                  className="flex items-center gap-3 py-3"
                >
                  <motion.span
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.35, 1] }}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.05 }}
                    className={cn('h-2.5 w-2.5 shrink-0 rounded-full', alert.kind === 'special-cause' ? 'bg-[#FF3B30]' : 'bg-[#FFCC00]')}
                  />
                  <button
                    type="button"
                    onClick={() => navigate(domain.route)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className={cn('truncate text-[13.5px] font-medium text-[var(--dcl-ink-900)]', acked && 'opacity-50 line-through')}>
                      {alert.headline}
                    </p>
                    <p className="text-[12px] text-[var(--dcl-ink-500)]">
                      {alert.domainName} · {alert.periodLabel} · {alert.detail}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAcknowledged((prev) => new Set(prev).add(alert.id))}
                    disabled={acked}
                    className={cn(
                      'shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors',
                      acked
                        ? 'border-[#34C759]/40 bg-[#34C759]/10 text-[#1F7A38]'
                        : 'border-[var(--dcl-line)] text-[var(--dcl-ink-500)] hover:bg-[var(--dcl-surface-tint)]',
                    )}
                  >
                    {acked ? 'Reviewed' : 'Acknowledge'}
                  </button>
                </motion.div>
              );
            })}
            {alerts.length === 0 && (
              <div className="flex items-center gap-3 py-6 text-[13.5px] text-[var(--dcl-ink-500)]">
                <ShieldCheck className="h-5 w-5 text-[#34C759]" />
                No active signals. All metrics are within control limits.
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="dcl-card flex flex-col rounded-[24px] p-6 lg:col-span-4"
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#007AFF]" />
            <h3 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">What changed this period?</h3>
          </div>
          <p className="mt-3 text-[13.5px] leading-[1.6] text-[var(--dcl-ink-700)]">{narrative}</p>
          <p className="mt-4 rounded-xl bg-[var(--dcl-surface-tint)] p-3 text-[12px] leading-[1.55] text-[var(--dcl-ink-500)]">
            Control limits show expected variation. A point outside the limits needs investigation—not blame.
          </p>
        </motion.div>
      </section>

      {/* ── Section 5: Data Confidence + Import CTA ──────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.3 }}
        className="dcl-card grid grid-cols-1 gap-6 rounded-[24px] p-6 md:grid-cols-2"
      >
        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">Data confidence</h2>
          <div className="mt-3 flex items-center gap-4">
            <QualityRing value={94} />
            <div>
              <p className="font-num text-[22px] font-semibold text-[var(--dcl-ink-900)]">94% valid</p>
              <p className="text-[12.5px] text-[var(--dcl-ink-500)]">2 warnings · 0 blocking errors</p>
              <p className="text-[12.5px] text-[var(--dcl-ink-500)]">
                Last validated {lastSavedAt ? new Date(lastSavedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'Dec 31, 2024'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/data?step=upload')}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#007AFF] px-5 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0066D6]"
            >
              <Upload className="h-4 w-4" />
              Import performance data
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleTemplate}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--dcl-line)] bg-white px-5 text-[13.5px] font-semibold text-[var(--dcl-ink-700)] shadow-sm transition-colors hover:bg-[var(--dcl-surface-tint)]"
            >
              <FileSpreadsheet className="h-4 w-4 text-[#34C759]" />
              Download Excel template
            </motion.button>
          </div>
          {isImported && (
            <button type="button" onClick={() => navigate('/data')} className="text-left text-[12.5px] font-medium text-[#007AFF] hover:underline">
              Reset to sample data
            </button>
          )}
          <p className="flex items-start gap-1.5 text-[11.5px] leading-[1.5] text-[var(--dcl-ink-400)]">
            <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Files are parsed and stored locally in this browser. Nothing is uploaded.
          </p>
        </div>
      </motion.section>
    </div>
  );
}

/** Data quality ring (fills over 700ms when scrolled into view). */
function QualityRing({ value }: { value: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--dcl-line)" strokeWidth="6" />
      <motion.circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="#34C759"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: c * (1 - value / 100) }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </svg>
  );
}
