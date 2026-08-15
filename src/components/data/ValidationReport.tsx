import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CircleX, CopyCheck, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NormalizedResult, ValidationIssue } from '@/lib/excel/normalize-rows';

/** easeOutExpo count-up for the validation summary numbers (500ms). */
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 500;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return <>{display}</>;
}

type SeverityFilter = 'all' | 'error' | 'warning';

/**
 * Validation report (data.md section 3, step 3): summary cards for valid
 * rows / blocking errors / warnings / duplicates, plus a filterable issue
 * table with row, field, issue, severity and suggested fix.
 */
export function ValidationReport({
  result,
  onJumpToRow,
}: {
  result: NormalizedResult;
  onJumpToRow?: (row: number) => void;
}) {
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const issues = useMemo(() => {
    const all: ValidationIssue[] = [...result.errors, ...result.warnings].sort((a, b) => a.row - b.row);
    return filter === 'all' ? all : all.filter((i) => i.severity === filter);
  }, [result, filter]);

  const cards = [
    { label: 'Valid rows', value: result.valid.length, icon: ShieldCheck, color: '#1F7A38', bg: '#34C759/10' },
    { label: 'Blocking errors', value: result.errors.length, icon: CircleX, color: '#B42318', bg: '#FF3B30/10' },
    { label: 'Warnings', value: result.warnings.length, icon: AlertTriangle, color: '#8A6D00', bg: '#FFCC00/12' },
    { label: 'Duplicates', value: result.duplicates.length, icon: CopyCheck, color: '#007AFF', bg: '#007AFF/10' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: i * 0.06 }}
            className="rounded-2xl border border-[var(--dcl-line)] p-4"
            style={{ backgroundColor: `rgba(${c.bg === '#34C759/10' ? '52,199,89' : c.bg === '#FF3B30/10' ? '255,59,48' : c.bg === '#FFCC00/12' ? '255,204,0' : '0,122,255'},0.08)` }}
          >
            <div className="flex items-center gap-2">
              <c.icon className="h-4 w-4" style={{ color: c.color }} />
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-500)]">
                {c.label}
              </span>
            </div>
            <p className="font-num mt-1.5 text-[26px] font-semibold leading-none" style={{ color: c.color }}>
              <CountUp value={c.value} />
            </p>
          </motion.div>
        ))}
      </div>

      {result.missingRequired.length > 0 && (
        <p className="mt-4 rounded-xl border border-[#FF3B30]/25 bg-[#FF3B30]/5 p-3 text-[12.5px] font-medium text-[#B42318]">
          Required columns are unmapped: {result.missingRequired.join(', ')}. Go back to Map columns and map them
          before validating.
        </p>
      )}

      {result.exampleRowsSkipped > 0 && (
        <p className="mt-4 rounded-xl border border-[#007AFF]/25 bg-[#EAF3FF] p-3 text-[12.5px] font-medium text-[#0057B8]">
          {result.exampleRowsSkipped} template example row{result.exampleRowsSkipped === 1 ? '' : 's'} (unit starting
          with “EXAMPLE”) {result.exampleRowsSkipped === 1 ? 'was' : 'were'} skipped automatically.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-[15px] font-semibold text-[var(--dcl-ink-900)]">Issues</h3>
        <div className="flex gap-1 rounded-full border border-[var(--dcl-line)] p-0.5" role="group" aria-label="Filter by severity">
          {(['all', 'error', 'warning'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-3 py-1 text-[12px] font-medium capitalize transition-colors',
                filter === f ? 'bg-[#111827] text-white' : 'text-[var(--dcl-ink-500)] hover:text-[var(--dcl-ink-900)]',
              )}
            >
              {f === 'all' ? 'All' : `${f}s`}
            </button>
          ))}
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-[var(--dcl-surface-tint)] p-4 text-[13px] text-[var(--dcl-ink-500)]">
          <ShieldCheck className="h-5 w-5 text-[#34C759]" />
          {result.errors.length === 0 && filter === 'all'
            ? 'No issues found. All rows pass structural validation.'
            : 'No issues at this severity.'}
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--dcl-line)]">
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead>
              <tr className="bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]">
                <th className="px-3 py-2 font-semibold">Row</th>
                <th className="px-3 py-2 font-semibold">Field</th>
                <th className="px-3 py-2 font-semibold">Issue</th>
                <th className="px-3 py-2 font-semibold">Severity</th>
                <th className="px-3 py-2 font-semibold">Suggested fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--dcl-line)]">
              {issues.slice(0, 50).map((issue, i) => (
                <motion.tr
                  key={`${issue.row}-${issue.field}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18, delay: Math.min(i, 20) * 0.03 }}
                  className={cn(onJumpToRow && 'cursor-pointer hover:bg-[var(--dcl-surface-tint)]')}
                  onClick={() => onJumpToRow?.(issue.row)}
                >
                  <td className="font-num px-3 py-2 text-[var(--dcl-ink-700)]">{issue.row === 0 ? '—' : issue.row}</td>
                  <td className="font-num px-3 py-2 font-semibold text-[var(--dcl-ink-900)]">{issue.field}</td>
                  <td className="px-3 py-2 text-[var(--dcl-ink-700)]">{issue.issue}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        issue.severity === 'error' ? 'bg-[#FF3B30]/10 text-[#B42318]' : 'bg-[#FFCC00]/15 text-[#8A6D00]',
                      )}
                    >
                      {issue.severity === 'error' ? <CircleX className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {issue.severity === 'error' ? 'Error' : 'Warning'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--dcl-ink-500)]">{issue.suggestion}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {issues.length > 50 && (
            <p className="border-t border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] px-3 py-2 text-[11.5px] text-[var(--dcl-ink-500)]">
              Showing first 50 of {issues.length} issues. Fix and re-import, or save the rejected rows report at commit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
