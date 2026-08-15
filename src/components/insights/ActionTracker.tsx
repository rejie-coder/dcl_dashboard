import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ClipboardList, Download, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadCsv } from '@/lib/excel/to-csv';
import { useInsightsStore, type ActionItem, type ActionStatus } from './action-store';

const STATUS_LABEL: Record<ActionStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  done: 'Done',
};

const STATUS_STYLE: Record<ActionStatus, string> = {
  open: 'bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-700)]',
  'in-progress': 'bg-[#EAF3FF] text-[#0057B8]',
  done: 'bg-[#34C759]/12 text-[#1F7A38]',
};

const NEXT_STATUS: Record<ActionStatus, ActionStatus> = {
  open: 'in-progress',
  'in-progress': 'done',
  done: 'open',
};

function isOverdue(a: ActionItem): boolean {
  return a.status !== 'done' && a.dueDate < new Date().toISOString().slice(0, 10);
}

function dueThisWeek(a: ActionItem): boolean {
  if (a.status === 'done') return false;
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400e3).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  return a.dueDate >= today && a.dueDate <= weekAhead;
}

/**
 * Action tracker (insights.md section 5): browser-local action table linked
 * to metric signals, with workload summary, status transitions, filtering
 * and CSV export.
 */
export function ActionTracker() {
  const actions = useInsightsStore((s) => s.actions);
  const addAction = useInsightsStore((s) => s.addAction);
  const setActionStatus = useInsightsStore((s) => s.setActionStatus);
  const removeAction = useInsightsStore((s) => s.removeAction);

  const [statusFilter, setStatusFilter] = useState<'all' | ActionStatus>('all');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', metricName: '', owner: '', dueDate: '' });

  const owners = useMemo(() => [...new Set(actions.map((a) => a.owner))].sort(), [actions]);

  const visible = useMemo(
    () =>
      actions.filter(
        (a) =>
          (statusFilter === 'all' || a.status === statusFilter) &&
          (ownerFilter === '' || a.owner === ownerFilter),
      ),
    [actions, statusFilter, ownerFilter],
  );

  const open = actions.filter((a) => a.status !== 'done');
  const workload = `${open.length} open · ${open.filter(dueThisWeek).length} due this week · ${open.filter(isOverdue).length} overdue`;

  const exportCsv = () =>
    downloadCsv(
      ['action', 'metric', 'owner', 'dueDate', 'status', 'updated'],
      actions.map((a) => [a.title, a.metricName, a.owner, a.dueDate, STATUS_LABEL[a.status], a.updatedAt.slice(0, 10)]),
      'dcl-action-tracker.csv',
    );

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.26 }}
      className="grid grid-cols-1 gap-5 lg:grid-cols-12"
    >
      {/* Workload summary (first on mobile) */}
      <div className="dcl-card order-first flex flex-col rounded-[24px] p-6 lg:order-last lg:col-span-4">
        <h3 className="font-display text-[16px] font-semibold text-[var(--dcl-ink-900)]">Workload</h3>
        <p className="font-num mt-2 text-[22px] font-semibold leading-[1.2] text-[var(--dcl-ink-900)]">{workload}</p>
        <div className="mt-4 flex flex-col gap-2">
          {(['open', 'in-progress', 'done'] as const).map((s) => {
            const count = actions.filter((a) => a.status === s).length;
            return (
              <div key={s} className="flex items-center justify-between rounded-xl bg-[var(--dcl-surface-tint)] px-3 py-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_STYLE[s])}>{STATUS_LABEL[s]}</span>
                <span className="font-num text-[13px] font-semibold text-[var(--dcl-ink-900)]">{count}</span>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={actions.length === 0}
          className="mt-4 flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--dcl-line)] text-[12.5px] font-medium text-[var(--dcl-ink-700)] hover:bg-[var(--dcl-surface-tint)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Export actions CSV
        </button>
      </div>

      {/* Action table */}
      <div className="dcl-card rounded-[24px] p-6 lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--dcl-ink-900)]">Action tracker</h2>
            <p className="mt-0.5 text-[13px] text-[var(--dcl-ink-500)]">
              Actions are stored in this browser and linked to metric signals.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-[#007AFF] px-3.5 text-[12.5px] font-semibold text-white hover:bg-[#0066D6]"
          >
            <Plus className="h-3.5 w-3.5" /> Add action
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-full border border-[var(--dcl-line)] p-0.5" role="group" aria-label="Filter by status">
            {(['all', 'open', 'in-progress', 'done'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                  statusFilter === s ? 'bg-[#111827] text-white' : 'text-[var(--dcl-ink-500)] hover:text-[var(--dcl-ink-900)]',
                )}
              >
                {s === 'all' ? 'All' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {owners.length > 0 && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              aria-label="Filter by owner"
              className="h-8 rounded-full border border-[var(--dcl-line)] bg-white px-3 text-[12px] font-medium text-[var(--dcl-ink-700)]"
            >
              <option value="">All owners</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
        </div>

        <AnimatePresence>
          {adding && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.title.trim()) return;
                addAction({
                  alertId: null,
                  metricId: '',
                  metricName: draft.metricName.trim() || 'General',
                  title: draft.title.trim(),
                  owner: draft.owner.trim() || 'Unassigned',
                  dueDate: draft.dueDate || new Date(Date.now() + 7 * 86400e3).toISOString().slice(0, 10),
                });
                setDraft({ title: '', metricName: '', owner: '', dueDate: '' });
                setAdding(false);
              }}
            >
              <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] p-3 sm:grid-cols-4">
                <input
                  autoFocus
                  required
                  placeholder="Action (e.g. Review fall-prevention rounding)"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  className="h-9 rounded-lg border border-[var(--dcl-line)] bg-white px-2.5 text-[12.5px] sm:col-span-2"
                />
                <input
                  placeholder="Metric"
                  value={draft.metricName}
                  onChange={(e) => setDraft((d) => ({ ...d, metricName: e.target.value }))}
                  className="h-9 rounded-lg border border-[var(--dcl-line)] bg-white px-2.5 text-[12.5px]"
                />
                <input
                  placeholder="Owner"
                  value={draft.owner}
                  onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
                  className="h-9 rounded-lg border border-[var(--dcl-line)] bg-white px-2.5 text-[12.5px]"
                />
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                  className="font-num h-9 rounded-lg border border-[var(--dcl-line)] bg-white px-2.5 text-[12.5px]"
                />
                <div className="flex gap-2 sm:col-span-3 sm:justify-end">
                  <button type="button" onClick={() => setAdding(false)} className="h-9 rounded-full px-3 text-[12px] font-medium text-[var(--dcl-ink-500)]">
                    Cancel
                  </button>
                  <button type="submit" className="h-9 rounded-full bg-[#007AFF] px-4 text-[12px] font-semibold text-white hover:bg-[#0066D6]">
                    Save action
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {visible.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-[var(--dcl-surface-tint)] p-5 text-[13px] text-[var(--dcl-ink-500)]">
            <ClipboardList className="h-5 w-5 text-[var(--dcl-ink-400)]" />
            {actions.length === 0
              ? 'No actions yet. Add one here or from a selected alert above.'
              : 'No actions match the active filters.'}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--dcl-line)]">
            <table className="w-full min-w-[680px] text-left text-[12.5px]">
              <thead>
                <tr className="bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]">
                  {['Action', 'Metric', 'Owner', 'Due date', 'Status', 'Updated', ''].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--dcl-line)]">
                <AnimatePresence initial={false}>
                  {visible.map((a) => {
                    const overdue = isOverdue(a);
                    return (
                      <motion.tr
                        key={a.id}
                        layout
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22 }}
                      >
                        <td className={cn('max-w-[240px] px-3 py-2.5 font-medium', overdue ? 'text-[#B42318]' : 'text-[var(--dcl-ink-900)]')}>
                          {a.title}
                          {overdue && (
                            <span className="ml-2 rounded-full bg-[#FF3B30]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#B42318]">
                              Overdue
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--dcl-ink-700)]">{a.metricName}</td>
                        <td className="px-3 py-2.5 text-[var(--dcl-ink-700)]">{a.owner}</td>
                        <td className={cn('font-num px-3 py-2.5', overdue ? 'font-semibold text-[#B42318]' : 'text-[var(--dcl-ink-700)]')}>
                          {new Date(a.dueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setActionStatus(a.id, NEXT_STATUS[a.status])}
                            title="Click to advance status"
                            className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150', STATUS_STYLE[a.status])}
                          >
                            {a.status === 'done' && <Check className="mr-1 inline h-3 w-3" />}
                            {STATUS_LABEL[a.status]}
                          </button>
                        </td>
                        <td className="font-num px-3 py-2.5 text-[var(--dcl-ink-500)]">{a.updatedAt.slice(0, 10)}</td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => removeAction(a.id)}
                            aria-label={`Delete action ${a.title}`}
                            className="text-[var(--dcl-ink-400)] transition-colors hover:text-[#FF3B30]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.section>
  );
}
