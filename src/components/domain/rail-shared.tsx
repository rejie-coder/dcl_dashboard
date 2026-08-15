import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Check, ChevronDown, CircleAlert, Copy, Plus } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import type { Domain, SPCPoint } from '@/types/dcl';
import { METRIC_MAP, formatMetricValue } from '@/data/metrics';
import { useSPC } from '@/hooks/useSPC';
import { cn } from '@/lib/utils';
import { RULE_LABELS, copyToClipboard } from './domain-shared';
import { formatMetricTick } from './metric-formulas';

/**
 * Shared building blocks for the Level 2 insight rails and methodology
 * footers: signal list, action queue, dual-series mini chart, and the
 * two-column methodology/audit panel. All are domain-agnostic.
 */

/* ── Rail card shell ───────────────────────────────────────────────── */

export function RailCard({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.16, 1, 0.3, 1] }}
      className="dcl-card flex flex-col gap-3 rounded-[20px] p-4"
    >
      <h3 className="font-display text-[14px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">{title}</h3>
      {children}
    </motion.section>
  );
}

/* ── Signal list ───────────────────────────────────────────────────── */

interface SignalRow {
  metricId: string;
  label: string;
  text: string;
  kind: 'special-cause' | 'run-rule';
}

export function SignalListCard({
  title,
  domain,
  seriesByMetric,
  onOpenMetric,
  maxRows = 6,
  delay = 0,
}: {
  title: string;
  domain: Domain;
  seriesByMetric: Record<string, SPCPoint[]>;
  onOpenMetric: (metricId: string) => void;
  maxRows?: number;
  delay?: number;
}) {
  const rows = useMemo(() => {
    const out: SignalRow[] = [];
    for (const metricId of domain.metricIds) {
      const metric = METRIC_MAP[metricId];
      const points = seriesByMetric[metricId] ?? [];
      if (!metric) continue;
      // most recent signal per metric
      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        if (p.signal) {
          out.push({
            metricId,
            label: p.label,
            kind: p.signal,
            text: `${metric.name} ${formatMetricValue(metric, p.value)} — ${p.rules
              .map((r) => RULE_LABELS[r] ?? r)
              .join(', ')}`,
          });
          break;
        }
      }
    }
    out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'special-cause' ? -1 : 1));
    return out.slice(0, maxRows);
  }, [domain.metricIds, seriesByMetric, maxRows]);

  return (
    <RailCard title={title} delay={delay}>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-[var(--dcl-surface-tint)] px-3 py-2.5 text-[12px] text-[var(--dcl-ink-500)]">
          No active signals — all metrics are in statistical control.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.metricId}>
              <button
                type="button"
                onClick={() => onOpenMetric(row.metricId)}
                className="flex w-full items-start gap-2.5 rounded-xl border border-[var(--dcl-line)] px-3 py-2 text-left transition hover:bg-[var(--dcl-surface-tint)]"
              >
                <CircleAlert
                  className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', row.kind === 'special-cause' ? 'text-[#FF3B30]' : 'text-[#B45309]')}
                />
                <span className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--dcl-ink-700)]">{row.text}</span>
                <span className="font-num shrink-0 text-[10.5px] text-[var(--dcl-ink-400)]">{row.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </RailCard>
  );
}

/* ── Action queue ──────────────────────────────────────────────────── */

type ActionStatus = 'Open' | 'In progress' | 'Done';

interface ActionItem {
  id: string;
  text: string;
  owner: string;
  status: ActionStatus;
}

const STATUS_ORDER: ActionStatus[] = ['Open', 'In progress', 'Done'];
const STATUS_CLASS: Record<ActionStatus, string> = {
  Open: 'bg-[#8E8E93]/10 text-[var(--dcl-ink-500)] ring-[#8E8E93]/25',
  'In progress': 'bg-[#FFCC00]/15 text-[#713F12] ring-[#FFCC00]/40',
  Done: 'bg-[#34C759]/12 text-[#1F7A38] ring-[#34C759]/30',
};

export function ActionQueueCard({
  title,
  ctaLabel,
  seedActions,
  storageKey,
  delay = 0,
}: {
  title: string;
  ctaLabel: string;
  seedActions: { text: string; owner: string }[];
  storageKey: string;
  delay?: number;
}) {
  const [actions, setActions] = useState<ActionItem[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as ActionItem[];
    } catch {
      /* fall through to seeds */
    }
    return seedActions.map((a, i) => ({ id: `seed-${i}`, text: a.text, owner: a.owner, status: 'Open' as ActionStatus }));
  });
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(actions));
    } catch {
      /* session-local */
    }
  }, [actions, storageKey]);

  const cycle = (id: string) =>
    setActions((prev) => {
      const next = prev.map((a) =>
        a.id === id ? { ...a, status: STATUS_ORDER[(STATUS_ORDER.indexOf(a.status) + 1) % STATUS_ORDER.length] } : a,
      );
      // Completed actions sink to the bottom
      return [...next.filter((a) => a.status !== 'Done'), ...next.filter((a) => a.status === 'Done')];
    });

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setActions((prev) => [{ id: `${Date.now()}`, text, owner: 'Me', status: 'Open' as ActionStatus }, ...prev]);
    setDraft('');
  };

  return (
    <RailCard title={title} delay={delay}>
      <ul className="flex flex-col gap-1.5">
        {actions.map((a) => (
          <motion.li
            key={a.id}
            layout="position"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border border-[var(--dcl-line)] px-3 py-2',
              a.status === 'Done' && 'opacity-60',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                a.status === 'Done' ? 'border-[#34C759] bg-[#34C759] text-white' : 'border-[var(--dcl-line-strong)]',
              )}
            >
              {a.status === 'Done' && <Check className="h-2.5 w-2.5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-[12px] font-medium text-[var(--dcl-ink-900)]', a.status === 'Done' && 'line-through')}>
                {a.text}
              </span>
              <span className="text-[10.5px] text-[var(--dcl-ink-400)]">{a.owner}</span>
            </span>
            <button
              type="button"
              onClick={() => cycle(a.id)}
              className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 transition', STATUS_CLASS[a.status])}
              aria-label={`${a.text}: status ${a.status}. Activate to change status.`}
            >
              {a.status}
            </button>
          </motion.li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={ctaLabel}
          aria-label={ctaLabel}
          className="h-8 flex-1 rounded-lg border border-[var(--dcl-line)] bg-white px-2.5 text-[12px] outline-none transition focus:border-[var(--dcl-line-strong)]"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--dcl-line)] text-[var(--dcl-ink-500)] transition hover:bg-[var(--dcl-surface-tint)] disabled:opacity-40"
          aria-label="Add action"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </RailCard>
  );
}

/* ── Copy summary button ───────────────────────────────────────────── */

export function CopySummaryButton({
  label,
  text,
  accent,
}: {
  label: string;
  text: string;
  accent: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyToClipboard(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }
      }}
      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border text-[12.5px] font-semibold transition hover:bg-[var(--dcl-surface-tint)]"
      style={{ borderColor: accent, color: accent }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/* ── Dual-series mini chart (relationship / capability trend) ──────── */

export function DualSeriesMiniChart({
  title,
  metricAId,
  metricBId,
  accentA,
  accentB,
  insightText,
  delay = 0,
}: {
  title: string;
  metricAId: string;
  metricBId: string;
  accentA: string;
  accentB: string;
  insightText: string;
  delay?: number;
}) {
  const metricA = METRIC_MAP[metricAId];
  const metricB = METRIC_MAP[metricBId];
  const { points: a } = useSPC(metricAId);
  const { points: b } = useSPC(metricBId);
  const chartRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setInView(true), {
      threshold: 0.4,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const data = useMemo(() => {
    const length = Math.min(a.length, b.length);
    return {
      labels: a.slice(-length).map((p) => p.label),
      datasets: [
        {
          label: metricA?.shortName ?? metricAId,
          data: a.slice(-length).map((p) => p.value),
          borderColor: accentA,
          backgroundColor: accentA,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'y',
        },
        {
          label: metricB?.shortName ?? metricBId,
          data: b.slice(-length).map((p) => p.value),
          borderColor: accentB,
          backgroundColor: accentB,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'y1',
        },
      ],
    };
  }, [a, b, metricA, metricB, metricAId, metricBId, accentA, accentB]);

  return (
    <RailCard title={title} delay={delay}>
      <div ref={chartRef} className="h-[150px]">
        {data.labels.length > 0 ? (
          <Line
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              animation: { duration: 500, easing: 'easeOutCubic' },
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { usePointStyle: true, boxWidth: 6, boxHeight: 6, color: '#6B7280', font: { size: 10 } },
                },
                tooltip: {
                  backgroundColor: 'rgba(17, 24, 39, .94)',
                  padding: 10,
                  bodyFont: { family: "'IBM Plex Mono', monospace", size: 10.5 },
                  callbacks: {
                    label: (ctx) =>
                      `${ctx.dataset.label}: ${formatMetricValue(ctx.datasetIndex === 0 ? metricA! : metricB!, Number(ctx.raw))}`,
                  },
                },
              },
              scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: '#9CA3AF', font: { size: 9.5 } } },
                y: {
                  position: 'left',
                  grid: { color: 'rgba(148,163,184,.16)' },
                  ticks: {
                    color: accentA,
                    font: { size: 9.5 },
                    callback: (v) => (metricA ? formatMetricTick(metricA, Number(v)) : Number(v)),
                  },
                },
                y1: {
                  position: 'right',
                  grid: { display: false },
                  ticks: {
                    color: accentB,
                    font: { size: 9.5 },
                    callback: (v) => (metricB ? formatMetricTick(metricB, Number(v)) : Number(v)),
                  },
                },
              },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl bg-[var(--dcl-surface-tint)] text-[12px] text-[var(--dcl-ink-400)]">
            No observations
          </div>
        )}
      </div>
      <p
        className={cn(
          'rounded-xl px-3 py-2 text-[12px] leading-snug text-[var(--dcl-ink-700)] transition-colors duration-200',
          inView ? 'bg-[#FF9F0A]/10' : 'bg-[var(--dcl-surface-tint)]',
        )}
      >
        {insightText}
      </p>
    </RailCard>
  );
}

/* ── Methodology + audit footer ────────────────────────────────────── */

export function MethodologyFooter({
  heading,
  copy,
  formula,
  auditItems,
  domainId,
  accent,
}: {
  heading: string;
  copy: string;
  formula: string;
  auditItems: { label: string; value: string }[];
  domainId: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="dcl-card grid grid-cols-1 gap-6 rounded-[24px] p-6 md:grid-cols-2"
      aria-label={heading}
    >
      <div>
        <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">{heading}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--dcl-ink-500)]">{copy}</p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold transition hover:underline"
          style={{ color: accent }}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} />
          Formulas and baseline rule
        </button>
        <motion.div
          initial={false}
          animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
          transition={{ duration: 0.22 }}
          className="overflow-hidden"
        >
          <p className="font-num mt-2 rounded-xl bg-[var(--dcl-surface-tint)] p-3 text-[11.5px] leading-relaxed text-[var(--dcl-ink-700)]">
            {formula}
          </p>
        </motion.div>
        <button
          type="button"
          onClick={async () => {
            const ok = await copyToClipboard(`${heading}\n${copy}\n${formula}`);
            if (ok) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }
          }}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-[var(--dcl-line)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--dcl-ink-500)] transition hover:bg-[var(--dcl-surface-tint)]"
        >
          {copied ? <Check className="h-3 w-3 text-[#1F7A38]" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy methodology'}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <dl className="flex flex-col gap-2 rounded-2xl bg-[var(--dcl-surface-tint)] p-4">
          {auditItems.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <dt className="text-[var(--dcl-ink-500)]">{item.label}</dt>
              <dd className="font-num font-medium text-[var(--dcl-ink-900)]">{item.value}</dd>
            </div>
          ))}
        </dl>
        <Link
          to={`/data?domain=${domainId}`}
          className="text-[12.5px] font-semibold transition hover:underline"
          style={{ color: accent }}
        >
          View validation report
        </Link>
      </div>
    </motion.section>
  );
}
