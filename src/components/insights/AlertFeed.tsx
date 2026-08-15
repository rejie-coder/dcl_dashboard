import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router';
import {
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  ListFilter,
  Search,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DOMAINS } from '@/data/domains';
import type { DomainId, SPCPoint } from '@/types/dcl';
import { formatMetricValue } from '@/data/metrics';
import { SPCMiniChart } from '@/components/charts/SPCMiniChart';
import { suggestedStep, whyItMatters, type AlertItem } from './alert-model';
import { useInsightsStore } from './action-store';

export type CounterFilter = 'all' | 'special-cause' | 'run-rule' | 'reviewed';
type Severity = 'all' | 'special-cause' | 'run-rule' | 'favorable';
type SortKey = 'impact' | 'newest' | 'domain';

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'special-cause', label: 'Special cause' },
  { value: 'run-rule', label: 'Run rule' },
  { value: 'favorable', label: 'Favorable' },
];

function SeverityIcon({ alert }: { alert: AlertItem }) {
  // Volume-indicator signals are neutral: no favorable/adverse coloring.
  const neutral = alert.favorable === null;
  if (alert.kind === 'special-cause') {
    return alert.favorable === true ? (
      <TrendingUp className="h-4 w-4 text-[#1F7A38]" aria-label="Favorable special cause" />
    ) : neutral ? (
      <CircleAlert className="h-4 w-4 text-[var(--dcl-ink-400)]" aria-label="Special cause (volume indicator, neutral)" />
    ) : (
      <CircleAlert className="h-4 w-4 text-[#FF3B30]" aria-label="Special cause" />
    );
  }
  return alert.favorable === true ? (
    <TrendingUp className="h-4 w-4 text-[#1F7A38]" aria-label="Favorable run rule" />
  ) : neutral ? (
    <CircleAlert className="h-4 w-4 text-[var(--dcl-ink-400)]" aria-label="Run rule (volume indicator, neutral)" />
  ) : (
    <CircleAlert className="h-4 w-4 text-[#B45309]" aria-label="Run rule" />
  );
}

/** Inline action composer in the detail rail. */
function ActionComposer({ alert, onDone }: { alert: AlertItem; onDone: () => void }) {
  const addAction = useInsightsStore((s) => s.addAction);
  const [title, setTitle] = useState(`Investigate ${alert.metric.shortName} signal`);
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');

  return (
    <form
      className="mt-3 flex flex-col gap-2 rounded-xl border border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        addAction({
          alertId: alert.id,
          metricId: alert.metricId,
          metricName: alert.metric.name,
          title: title.trim() || `Investigate ${alert.metric.name} signal`,
          owner: owner.trim() || 'Unassigned',
          dueDate: dueDate || new Date(Date.now() + 7 * 86400e3).toISOString().slice(0, 10),
        });
        onDone();
      }}
    >
      <label className="text-[11.5px] font-medium text-[var(--dcl-ink-500)]">
        Action
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 h-9 w-full rounded-lg border border-[var(--dcl-line)] bg-white px-2.5 text-[12.5px] text-[var(--dcl-ink-900)]"
        />
      </label>
      <div className="flex gap-2">
        <label className="flex-1 text-[11.5px] font-medium text-[var(--dcl-ink-500)]">
          Owner
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="e.g. Ward Manager"
            className="mt-1 h-9 w-full rounded-lg border border-[var(--dcl-line)] bg-white px-2.5 text-[12.5px] text-[var(--dcl-ink-900)]"
          />
        </label>
        <label className="flex-1 text-[11.5px] font-medium text-[var(--dcl-ink-500)]">
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="font-num mt-1 h-9 w-full rounded-lg border border-[var(--dcl-line)] bg-white px-2.5 text-[12.5px] text-[var(--dcl-ink-900)]"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="h-8 rounded-full px-3 text-[12px] font-medium text-[var(--dcl-ink-500)] hover:text-[var(--dcl-ink-900)]"
        >
          Cancel
        </button>
        <button type="submit" className="h-8 rounded-full bg-[#007AFF] px-3.5 text-[12px] font-semibold text-white hover:bg-[#0066D6]">
          Save action
        </button>
      </div>
    </form>
  );
}

export function AlertFeed({
  alerts,
  seriesByMetric,
  counterFilter,
  onCounterFilterChange,
}: {
  alerts: AlertItem[];
  seriesByMetric: Record<string, SPCPoint[]>;
  counterFilter: CounterFilter;
  onCounterFilterChange: (f: CounterFilter) => void;
}) {
  const navigate = useNavigate();
  const acknowledged = useInsightsStore((s) => s.acknowledged);
  const acknowledge = useInsightsStore((s) => s.acknowledge);
  const acknowledgeAll = useInsightsStore((s) => s.acknowledgeAll);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [domainIds, setDomainIds] = useState<DomainId[]>([]);
  const [severity, setSeverity] = useState<Severity>('all');
  const [sortKey, setSortKey] = useState<SortKey>('impact');
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 150);
    return () => window.clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    let list = [...alerts];
    // header counter override
    if (counterFilter === 'special-cause' || counterFilter === 'run-rule') {
      list = list.filter((a) => a.kind === counterFilter);
    } else if (counterFilter === 'reviewed') {
      list = list.filter((a) => acknowledged[a.id]);
    }
    if (domainIds.length > 0) list = list.filter((a) => domainIds.includes(a.domainId));
    if (severity !== 'all') {
      list =
        severity === 'favorable' ? list.filter((a) => a.favorable) : list.filter((a) => a.kind === severity);
    }
    if (onlyUnreviewed) list = list.filter((a) => !acknowledged[a.id]);
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.metric.name.toLowerCase().includes(q) ||
          a.unitLabel.toLowerCase().includes(q) ||
          a.headline.toLowerCase().includes(q) ||
          a.domainName.toLowerCase().includes(q),
      );
    }
    switch (sortKey) {
      case 'newest':
        list.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
        break;
      case 'domain':
        list.sort((a, b) => a.domainName.localeCompare(b.domainName) || b.strength - a.strength);
        break;
      default:
        list.sort((a, b) => b.strength - a.strength);
    }
    return list;
  }, [alerts, counterFilter, domainIds, severity, onlyUnreviewed, debouncedSearch, sortKey, acknowledged]);

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  const filtersActive =
    domainIds.length > 0 || severity !== 'all' || onlyUnreviewed || debouncedSearch.trim() !== '' || counterFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setDomainIds([]);
    setSeverity('all');
    setOnlyUnreviewed(false);
    onCounterFilterChange('all');
  };

  const allVisibleReviewed = filtered.length > 0 && filtered.every((a) => acknowledged[a.id]);

  const toggleDomain = (id: DomainId) =>
    setDomainIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));

  return (
    <div>
      {/* ── Controls (insights.md section 2) ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="dcl-card flex flex-col gap-3 rounded-[24px] p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dcl-ink-400)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search metric, unit, or signal"
              className="h-10 w-full rounded-full border border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] pl-9 pr-3 text-[13px] text-[var(--dcl-ink-900)] placeholder:text-[var(--dcl-ink-400)]"
            />
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by domain">
            {DOMAINS.map((d) => {
              const active = domainIds.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDomain(d.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150',
                    active ? 'text-white' : 'border-[var(--dcl-line)] text-[var(--dcl-ink-500)] hover:bg-[var(--dcl-surface-tint)]',
                  )}
                  style={active ? { backgroundColor: d.color, borderColor: d.color } : undefined}
                >
                  <motion.span animate={{ rotate: active ? 90 : 0 }} transition={{ duration: 0.16 }}>
                    {active ? <X className="h-3 w-3" /> : <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />}
                  </motion.span>
                  {d.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-0.5 rounded-full border border-[var(--dcl-line)] p-0.5" role="group" aria-label="Filter by severity">
            {SEVERITY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setSeverity(o.value)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
                  severity === o.value ? 'bg-[#111827] text-white' : 'text-[var(--dcl-ink-500)] hover:text-[var(--dcl-ink-900)]',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort alerts"
            className="h-9 rounded-full border border-[var(--dcl-line)] bg-white px-3 text-[12.5px] font-medium text-[var(--dcl-ink-700)]"
          >
            <option value="impact">Sort: Impact</option>
            <option value="newest">Sort: Newest</option>
            <option value="domain">Sort: Domain</option>
          </select>

          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-[var(--dcl-ink-700)]">
            <input
              type="checkbox"
              checked={onlyUnreviewed}
              onChange={(e) => setOnlyUnreviewed(e.target.checked)}
              className="h-4 w-4 accent-[#007AFF]"
            />
            Only unreviewed
          </label>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-[12.5px] font-semibold text-[#007AFF] hover:underline"
            >
              <ListFilter className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}

          <span className="font-num ml-auto text-[12px] text-[var(--dcl-ink-500)]" aria-live="polite">
            {filtered.length} alert{filtered.length === 1 ? '' : 's'}
          </span>

          {allVisibleReviewed && filtered.length > 0 && (
            <span className="flex items-center gap-1 text-[12px] font-medium text-[#1F7A38]">
              <CheckCheck className="h-3.5 w-3.5" /> All reviewed
            </span>
          )}
          {!allVisibleReviewed && filtered.length > 0 && (
            <button
              type="button"
              onClick={() => acknowledgeAll(filtered.map((a) => a.id))}
              className="text-[12px] font-semibold text-[#007AFF] hover:underline"
            >
              Mark all reviewed
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Feed + preview rail (insights.md section 3) ──────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-8">
          {filtered.length === 0 && (
            <div className="dcl-card flex items-center gap-3 rounded-[20px] p-6 text-[13.5px] text-[var(--dcl-ink-500)]">
              <ShieldCheck className="h-5 w-5 text-[#34C759]" />
              {alerts.length === 0 ? 'No active SPC signals under the current filters.' : 'No alerts match the active filters.'}
            </div>
          )}
          {filtered.map((alert, i) => {
            const domain = DOMAINS.find((d) => d.id === alert.domainId);
            const isSelected = selected?.id === alert.id;
            const reviewed = Boolean(acknowledged[alert.id]);
            return (
              <motion.button
                key={alert.id}
                type="button"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: Math.min(i, 8) * 0.045 }}
                onClick={() => {
                  setSelectedId(alert.id);
                  setComposerOpen(false);
                }}
                className={cn(
                  'dcl-card flex w-full items-center gap-3.5 rounded-[20px] border-l-4 p-4 text-left transition-all duration-150',
                  isSelected ? 'border-2 border-l-4 shadow-[0_8px_24px_rgba(15,23,42,.10)] -translate-y-0.5' : '',
                )}
                style={{ borderLeftColor: domain?.color ?? 'var(--dcl-line)' }}
                aria-current={isSelected}
              >
                {!reviewed && (
                  <motion.span
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.35, 1] }}
                    transition={{ duration: 0.5, delay: 0.2 + Math.min(i, 8) * 0.05 }}
                    className={cn('h-2 w-2 shrink-0 rounded-full', alert.kind === 'special-cause' ? 'bg-[#FF3B30]' : 'bg-[#FFCC00]')}
                    aria-label="Unreviewed"
                  />
                )}
                <SeverityIcon alert={alert} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-[var(--dcl-ink-900)]">
                    {alert.headline}
                  </span>
                  <span className="block text-[12px] text-[var(--dcl-ink-500)]">
                    {alert.domainName} · {alert.periodLabel} · {alert.detail}
                  </span>
                  {alert.point && (
                    <span className="font-num mt-0.5 block text-[11.5px] text-[var(--dcl-ink-400)]">
                      {formatMetricValue(alert.metric, alert.point.value)} vs UCL{' '}
                      {formatMetricValue(alert.metric, alert.point.ucl)} / LCL {formatMetricValue(alert.metric, alert.point.lcl)}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    reviewed
                      ? 'bg-[#34C759]/10 text-[#1F7A38]'
                      : alert.favorable === true
                        ? 'bg-[#EAF3FF] text-[#0057B8]'
                        : 'bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]',
                  )}
                >
                  {reviewed ? 'Reviewed' : alert.favorable === true ? 'Favorable' : alert.favorable === null ? 'Neutral' : 'Unreviewed'}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--dcl-ink-400)]" />
              </motion.button>
            );
          })}
        </div>

        {/* Detail preview rail */}
        <div className="lg:col-span-4">
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="dcl-card sticky top-24 rounded-[24px] p-5"
                aria-live="polite"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: DOMAINS.find((d) => d.id === selected.domainId)?.color }}>
                  {selected.domainName}
                </p>
                <h3 className="font-display mt-1 text-[16px] font-semibold leading-[1.3] text-[var(--dcl-ink-900)]">
                  {selected.metric.name}
                </h3>
                <p className="mt-0.5 text-[12.5px] text-[var(--dcl-ink-500)]">
                  {selected.kind === 'special-cause' ? 'Special cause' : 'Run rule'} · {selected.periodLabel} ·{' '}
                  {selected.unitLabel}
                </p>

                <div className="mt-3">
                  <SPCMiniChart
                    points={(seriesByMetric[selected.metricId] ?? []).slice(-16)}
                    accent={DOMAINS.find((d) => d.id === selected.domainId)?.color ?? '#007AFF'}
                    metric={selected.metric}
                    height={110}
                  />
                </div>

                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dcl-ink-400)]">
                  Why this matters
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--dcl-ink-700)]">{whyItMatters(selected)}</p>
                <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dcl-ink-400)]">
                  Suggested next step
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--dcl-ink-700)]">{suggestedStep(selected)}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`${DOMAINS.find((d) => d.id === selected.domainId)?.route ?? '/'}?metric=${selected.metricId}`)
                    }
                    className="flex h-9 items-center gap-1.5 rounded-full bg-[#007AFF] px-3.5 text-[12px] font-semibold text-white hover:bg-[#0066D6]"
                  >
                    Open metric <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => acknowledge(selected.id)}
                    disabled={Boolean(acknowledged[selected.id])}
                    className={cn(
                      'flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-semibold transition-colors duration-200',
                      acknowledged[selected.id]
                        ? 'border-[#34C759]/40 bg-[#34C759]/10 text-[#1F7A38]'
                        : 'border-[var(--dcl-line)] text-[var(--dcl-ink-700)] hover:bg-[var(--dcl-surface-tint)]',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {acknowledged[selected.id] ? 'Acknowledged' : 'Acknowledge'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerOpen((o) => !o)}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--dcl-line)] px-3.5 text-[12px] font-semibold text-[var(--dcl-ink-700)] hover:bg-[var(--dcl-surface-tint)]"
                  >
                    <ClipboardList className="h-3.5 w-3.5" /> Add action
                  </button>
                </div>

                <AnimatePresence>
                  {composerOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <ActionComposer alert={selected} onDone={() => setComposerOpen(false)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
