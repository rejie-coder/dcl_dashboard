import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, ClipboardCopy, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Domain, SPCPoint } from '@/types/dcl';
import { unitName } from '@/data/units';
import { usePersistentFilters } from '@/hooks/usePersistentFilters';
import { deriveAlerts } from '@/lib/alerts';
import { ActionNoteList, type ActionNote } from '@/components/domain/ActionNoteList';

/**
 * Safety Investigation Rail (patient-safety.md section 4):
 * active signals, editable event context (local only, no identifiers),
 * and an action log with status changes.
 */

const SEED_ACTIONS: ActionNote[] = [
  {
    id: 'seed-rounding',
    text: 'Add hourly rounding audit',
    owner: 'Ward Manager',
    status: 'open',
    createdAt: '2024-12-19T09:00:00.000Z',
  },
  {
    id: 'seed-protocol',
    text: 'Review high-risk medication protocol',
    owner: 'Pharmacy Lead',
    status: 'in-progress',
    createdAt: '2024-12-21T09:00:00.000Z',
  },
];

const CONTEXT_KEY = 'dcl-safety-context';
const CONTEXT_FIELDS = ['Shift', 'Ward', 'Patient-day denominator', 'Related actions'] as const;

function loadContext(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

export function SafetyInsightRail({
  domain,
  seriesByMetric,
  onOpenMetric,
}: {
  domain: Domain;
  seriesByMetric: Record<string, SPCPoint[]>;
  onOpenMetric: (metricId: string) => void;
}) {
  const { unitId } = usePersistentFilters();
  const [context, setContext] = useState<Record<string, string>>(loadContext);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
    } catch {
      /* storage unavailable */
    }
  }, [context]);

  const alerts = useMemo(
    () => deriveAlerts(seriesByMetric, unitName(unitId)).slice(0, 5),
    [seriesByMetric, unitId],
  );

  const copySummary = async () => {
    const lines = [
      `Safety investigation summary — ${domain.name} (${unitName(unitId)})`,
      '',
      'Active signals:',
      ...(alerts.length > 0 ? alerts.map((a) => `- ${a.headline} [${a.periodLabel}]`) : ['- None']),
      '',
      'Event context:',
      ...CONTEXT_FIELDS.map((f) => `- ${f}: ${context[f] || '—'}`),
      '',
      'Reminder: no patient names, record numbers, or staff identifiers.',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4 min-[1440px]:sticky min-[1440px]:top-24"
      aria-label="Safety investigation"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">
          Safety investigation
        </h2>
        <button
          type="button"
          onClick={copySummary}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--dcl-line)] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--dcl-ink-700)] transition-colors hover:bg-[var(--dcl-surface-tint)]"
        >
          {copied ? <Check className="h-3 w-3 text-[#1F7A38]" /> : <ClipboardCopy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy investigation summary'}
        </button>
      </div>

      {/* Active signals */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.2 }}
        className={cn('dcl-card rounded-2xl p-4', alerts.some((a) => a.kind === 'special-cause') && 'border-[#FF3B30]/35')}
      >
        <h3 className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--dcl-ink-900)]">
          <AlertTriangle className="h-3.5 w-3.5" style={{ color: domain.color }} />
          Active signals
        </h3>
        {alerts.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <button
                  type="button"
                  onClick={() => onOpenMetric(alert.metricId)}
                  className="flex w-full items-start gap-2 rounded-xl border border-[var(--dcl-line)] px-3 py-2 text-left transition-colors hover:bg-[var(--dcl-surface-tint)]"
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      alert.kind === 'special-cause' ? 'bg-[#FF3B30]' : 'bg-[#FFCC00]',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-[var(--dcl-ink-900)]">
                      {alert.headline}
                    </span>
                    <span className="block text-[11px] text-[var(--dcl-ink-500)]">
                      {alert.periodLabel} · {alert.kind === 'special-cause' ? 'Special cause' : 'Run rule'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--dcl-line-strong)] px-3 py-3 text-[12.5px] text-[var(--dcl-ink-400)]">
            No active signals for this selection.
          </p>
        )}
      </motion.section>

      {/* Event context */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.25 }}
        className="dcl-card rounded-2xl p-4"
      >
        <h3 className="mb-1 text-[12.5px] font-semibold text-[var(--dcl-ink-900)]">Event context</h3>
        <p className="mb-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--dcl-ink-500)]">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" style={{ color: domain.color }} />
          Saved locally on this device. Do not enter patient names, record numbers, or staff identifiers.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 min-[1440px]:grid-cols-1">
          {CONTEXT_FIELDS.map((field) => (
            <label key={field} className="block">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--dcl-ink-400)]">
                {field}
              </span>
              <input
                value={context[field] ?? ''}
                onChange={(e) => setContext((prev) => ({ ...prev, [field]: e.target.value }))}
                placeholder="—"
                className="h-8 w-full rounded-lg border border-[var(--dcl-line)] bg-white px-2.5 py-1.5 text-[12.5px] text-[var(--dcl-ink-900)] placeholder:text-[var(--dcl-ink-400)] focus:border-transparent"
              />
            </label>
          ))}
        </div>
      </motion.section>

      {/* Action log */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.3 }}
        className="dcl-card rounded-2xl p-4"
      >
        <h3 className="mb-2.5 text-[12.5px] font-semibold text-[var(--dcl-ink-900)]">Action log</h3>
        <ActionNoteList storageKey="dcl-actions-patient-safety" seed={SEED_ACTIONS} addLabel="Create action note" />
      </motion.section>
    </motion.aside>
  );
}
