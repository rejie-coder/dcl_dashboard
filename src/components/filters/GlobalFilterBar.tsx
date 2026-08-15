import { motion } from 'framer-motion';
import { Database, Download, Upload } from 'lucide-react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { UNITS } from '@/data/units';
import { usePersistentFilters } from '@/hooks/usePersistentFilters';
import { useDataset } from '@/hooks/useDataset';
import type { TimeScale } from '@/types/dcl';

const TIME_SCALES: { id: TimeScale; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

export function TimeScaleSegmentedControl({ className }: { className?: string }) {
  const { timeScale, setTimeScale } = usePersistentFilters();
  return (
    <div
      className={cn('flex items-center rounded-full border border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] p-1', className)}
      role="radiogroup"
      aria-label="Time scale"
    >
      {TIME_SCALES.map((t) => {
        const active = timeScale === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTimeScale(t.id)}
            className={cn(
              'relative rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
              active ? 'text-[var(--dcl-ink-900)]' : 'text-[var(--dcl-ink-500)] hover:text-[var(--dcl-ink-700)]',
            )}
          >
            {active && (
              <motion.span
                layoutId="timescale-pill"
                className="absolute inset-0 rounded-full bg-white shadow-sm ring-1 ring-[var(--dcl-line)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function UnitSelect({ className }: { className?: string }) {
  const { unitId, setUnitId } = usePersistentFilters();
  return (
    <label className={cn('flex items-center gap-2', className)}>
      <span className="hidden text-[12px] font-medium text-[var(--dcl-ink-500)] lg:inline">Hospital Unit</span>
      <select
        value={unitId}
        onChange={(e) => setUnitId(e.target.value)}
        className="h-9 rounded-full border border-[var(--dcl-line)] bg-white px-3 text-[12.5px] font-medium text-[var(--dcl-ink-700)] shadow-sm outline-none transition-colors hover:border-[var(--dcl-line-strong)] focus-visible:border-[#007AFF]"
        aria-label="Hospital unit"
      >
        {UNITS.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Persistent global filter bar: Time Scale segmented control, Hospital Unit
 * select, dataset badge, and Import / Export actions.
 */
export function GlobalFilterBar() {
  const { isImported } = useDataset();
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <TimeScaleSegmentedControl />
      <UnitSelect />

      <span
        className={cn(
          'hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium sm:flex',
          isImported
            ? 'bg-[#EAFBFD] text-[#0E7490] ring-1 ring-[#30B0C7]/30'
            : 'bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)] ring-1 ring-[var(--dcl-line)]',
        )}
      >
        <Database className="h-3.5 w-3.5" />
        {isImported ? 'Imported dataset · validated' : 'Sample data · Jan 2022–Dec 2024'}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/data')}
          className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--dcl-line)] bg-white px-3.5 text-[12.5px] font-medium text-[var(--dcl-ink-700)] shadow-sm transition-all hover:border-[var(--dcl-line-strong)] hover:shadow active:scale-[0.98]"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Import data</span>
          <span className="sm:hidden">Import</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/insights')}
          className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--dcl-ink-900)] px-3.5 text-[12.5px] font-medium text-white shadow-sm transition-all hover:bg-[var(--dcl-ink-700)] active:scale-[0.98]"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export report</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>
    </div>
  );
}
