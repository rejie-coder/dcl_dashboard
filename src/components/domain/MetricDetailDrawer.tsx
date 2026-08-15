import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, FileImage, Plus, X } from 'lucide-react';
import type { SPCPoint } from '@/types/dcl';
import { METRIC_MAP, formatMetricValue } from '@/data/metrics';
import { unitName } from '@/data/units';
import { useSPC } from '@/hooks/useSPC';
import { useFilterStore } from '@/stores/filter-store';
import { SPCChart } from '@/components/charts/SPCChart';
import { cn } from '@/lib/utils';
import {
  GRAIN_LABEL,
  RULE_LABELS,
  SignalChip,
  exportSeriesCSV,
  metricStatus,
  polarityLabel,
  targetLabel,
} from './domain-shared';
import { metricFormula } from './metric-formulas';

/**
 * MetricDetailDrawer (design.md 6.5): right-side 480px drawer (full-screen on
 * mobile) with metric metadata, target/polarity, full SPC chart, signal
 * timeline, last-12-observations table, local action notes, and PNG/CSV
 * export. Generic across all registered metrics; driven by metricId + filters.
 */

interface Note {
  id: string;
  text: string;
  at: string;
}

function loadNotes(metricId: string): Note[] {
  try {
    const raw = localStorage.getItem(`dcl-notes-${metricId}`);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

function saveNotes(metricId: string, notes: Note[]) {
  try {
    localStorage.setItem(`dcl-notes-${metricId}`, JSON.stringify(notes));
  } catch {
    /* storage unavailable — notes stay session-local */
  }
}

export function MetricDetailDrawer({
  metricId,
  accent,
  ownerLabel,
  onClose,
}: {
  metricId: string | null;
  accent: string;
  ownerLabel?: string;
  onClose: () => void;
}) {
  const open = metricId !== null;
  const metric = metricId ? METRIC_MAP[metricId] : undefined;
  const { points, insufficientBaseline, grain } = useSPC(metricId ?? '');
  const unitId = useFilterStore((s) => s.unitId);

  const chartWrapRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (open && metricId) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      setNotes(loadNotes(metricId));
      setDraft('');
      const t = setTimeout(() => closeRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, metricId]);

  const handleClose = useCallback(() => {
    onClose();
    restoreFocusRef.current?.focus?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  const latest = points.at(-1);
  const last12 = points.slice(-12).reverse();
  const signalPoints = points.filter((p) => p.signal).slice(-10).reverse();

  const exportPNG = () => {
    const canvas = chartWrapRef.current?.querySelector('canvas');
    if (!canvas || !metric) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${metric.id}-spc.png`;
    a.click();
  };

  const addNote = () => {
    const text = draft.trim();
    if (!text || !metricId) return;
    const next = [{ id: `${Date.now()}`, text, at: new Date().toISOString() }, ...notes];
    setNotes(next);
    saveNotes(metricId, next);
    setDraft('');
  };

  return (
    <AnimatePresence>
      {open && metric && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.24 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-black"
            onClick={handleClose}
            aria-hidden="true"
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${metric.name} details`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col bg-[var(--dcl-surface-raised)] shadow-[-24px_0_64px_rgba(15,23,42,.18)] sm:w-[480px]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[var(--dcl-line)] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: accent }}>
                  Metric detail
                </p>
                <h2 className="font-display mt-0.5 truncate text-[19px] font-semibold tracking-[-0.02em] text-[var(--dcl-ink-900)]">
                  {metric.name}
                </h2>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="font-num text-[22px] font-semibold leading-none text-[var(--dcl-ink-900)]">
                    {formatMetricValue(metric, latest?.value ?? null)}
                  </span>
                  <SignalChip status={insufficientBaseline ? 'no-data' : metricStatus(points)} />
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={handleClose}
                aria-label="Close metric details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--dcl-ink-500)] transition hover:bg-[var(--dcl-surface-tint)] hover:text-[var(--dcl-ink-900)]"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055 } } }}
                className="flex flex-col gap-5"
              >
                {/* Metadata */}
                <motion.section variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-2xl bg-[var(--dcl-surface-tint)] p-4 text-[12.5px]">
                    {[
                      ['Polarity', polarityLabel(metric)],
                      ['Target', targetLabel(metric)],
                      ['SPC method', metric.spcMethod],
                      ['Unit', metric.unitLabel],
                      ['Owner', ownerLabel ?? 'Domain lead'],
                      ['Grain', GRAIN_LABEL[grain] ?? grain],
                      ['Scope', unitName(unitId)],
                      ['Baseline', 'First 20 completed periods'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--dcl-ink-400)]">{k}</dt>
                        <dd className="mt-0.5 font-medium text-[var(--dcl-ink-700)]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {metric.description && (
                    <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--dcl-ink-500)]">{metric.description}</p>
                  )}
                  {/* Plain-language derivation from raw data-entry rows */}
                  <p className="mt-2 rounded-xl border border-dashed border-[var(--dcl-line-strong)] px-3 py-2 text-[11.5px] leading-relaxed text-[var(--dcl-ink-500)]">
                    <span className="font-semibold text-[var(--dcl-ink-700)]">Calculated from raw entries:</span>{' '}
                    <span className="font-num">{metricFormula(metric)}</span>
                  </p>
                </motion.section>

                {/* Full SPC chart */}
                <motion.section variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <h3 className="font-display mb-2 text-[13.5px] font-semibold text-[var(--dcl-ink-900)]">SPC chart</h3>
                  <div ref={chartWrapRef} className="h-[260px] rounded-2xl border border-[var(--dcl-line)] bg-white p-3">
                    {points.length > 0 ? (
                      <SPCChart title={metric.shortName} points={points} accent={accent} metric={metric} />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2">
                        <img src={`${import.meta.env.BASE_URL}no-data-chart.svg`} alt="" className="h-24 object-contain" />
                        <p className="text-[12px] font-medium text-[var(--dcl-ink-500)]">
                          {insufficientBaseline ? 'Insufficient baseline — 12 periods required' : 'No valid observations'}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.section>

                {/* Signal timeline */}
                <motion.section variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <h3 className="font-display mb-2 text-[13.5px] font-semibold text-[var(--dcl-ink-900)]">Signal timeline</h3>
                  {signalPoints.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {signalPoints.map((p) => (
                        <li
                          key={p.periodStart}
                          className="flex items-center gap-2.5 rounded-xl border border-[var(--dcl-line)] px-3 py-2 text-[12px]"
                        >
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              p.signal === 'special-cause' ? 'bg-[#FF3B30]' : 'bg-[#FFCC00] ring-1 ring-[#B45309]/40',
                            )}
                          />
                          <span className="font-num font-medium text-[var(--dcl-ink-900)]">{p.label}</span>
                          <span className="font-num text-[var(--dcl-ink-500)]">{formatMetricValue(metric, p.value)}</span>
                          <span className="ml-auto text-right text-[11px] text-[var(--dcl-ink-500)]">
                            {p.rules.map((r) => RULE_LABELS[r] ?? r).join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl bg-[var(--dcl-surface-tint)] px-3 py-2.5 text-[12px] text-[var(--dcl-ink-500)]">
                      No signals in this period range — variation is consistent with the baseline.
                    </p>
                  )}
                </motion.section>

                {/* Last 12 observations */}
                <motion.section variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <h3 className="font-display mb-2 text-[13.5px] font-semibold text-[var(--dcl-ink-900)]">
                    Last 12 observations
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-[var(--dcl-line)]">
                    <table className="w-full text-left text-[11.5px]">
                      <thead>
                        <tr className="border-b border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]">
                          <th className="px-3 py-2 font-semibold">Period</th>
                          <th className="px-3 py-2 text-right font-semibold">Value</th>
                          <th className="px-3 py-2 text-right font-semibold">n / d</th>
                          <th className="px-3 py-2 text-right font-semibold">CL</th>
                          <th className="px-3 py-2 text-right font-semibold">Signal</th>
                        </tr>
                      </thead>
                      <tbody className="font-num">
                        {last12.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-[var(--dcl-ink-400)]">
                              No observations
                            </td>
                          </tr>
                        )}
                        {last12.map((p: SPCPoint) => (
                          <tr key={p.periodStart} className="border-b border-[var(--dcl-line)]/60 last:border-0">
                            <td className="px-3 py-1.5 text-[var(--dcl-ink-700)]">{p.label}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-[var(--dcl-ink-900)]">
                              {formatMetricValue(metric, p.value)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-[var(--dcl-ink-500)]">
                              {p.numerator != null && p.denominator != null
                                ? `${p.numerator.toLocaleString()} / ${p.denominator.toLocaleString()}`
                                : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right text-[var(--dcl-ink-500)]">
                              {formatMetricValue(metric, p.cl)}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {p.signal ? (
                                <span
                                  className={cn(
                                    'font-sans text-[10.5px] font-semibold',
                                    p.signal === 'special-cause' ? 'text-[#B42318]' : 'text-[#B45309]',
                                  )}
                                >
                                  {p.signal === 'special-cause' ? 'Special' : 'Run rule'}
                                </span>
                              ) : (
                                <span className="font-sans text-[10.5px] text-[var(--dcl-ink-400)]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.section>

                {/* Notes / action log */}
                <motion.section variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <h3 className="font-display mb-2 text-[13.5px] font-semibold text-[var(--dcl-ink-900)]">
                    Notes & action log
                  </h3>
                  <div className="flex gap-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addNote()}
                      placeholder="Add a local note…"
                      className="h-9 flex-1 rounded-xl border border-[var(--dcl-line)] bg-white px-3 text-[12.5px] outline-none transition focus:border-[var(--dcl-line-strong)]"
                    />
                    <button
                      type="button"
                      onClick={addNote}
                      disabled={!draft.trim()}
                      className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold text-white transition disabled:opacity-40"
                      style={{ backgroundColor: accent }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                  {notes.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {notes.map((n) => (
                        <motion.li
                          key={n.id}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.22 }}
                          className="rounded-xl border border-[var(--dcl-line)] px-3 py-2 text-[12px] text-[var(--dcl-ink-700)]"
                        >
                          {n.text}
                          <span className="mt-0.5 block text-[10.5px] text-[var(--dcl-ink-400)]">
                            {new Date(n.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </motion.section>
              </motion.div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-2 border-t border-[var(--dcl-line)] px-5 py-3.5">
              <button
                type="button"
                onClick={() => exportSeriesCSV(metric, unitId, points)}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--dcl-line)] text-[12.5px] font-semibold text-[var(--dcl-ink-700)] transition hover:bg-[var(--dcl-surface-tint)]"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
              <button
                type="button"
                onClick={exportPNG}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--dcl-line)] text-[12.5px] font-semibold text-[var(--dcl-ink-700)] transition hover:bg-[var(--dcl-surface-tint)]"
              >
                <FileImage className="h-3.5 w-3.5" /> Export PNG
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
