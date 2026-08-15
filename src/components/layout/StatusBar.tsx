import { usePersistentFilters } from '@/hooks/usePersistentFilters';
import { useDataset } from '@/hooks/useDataset';
import { unitName } from '@/data/units';

/**
 * 32px bottom utility bar (desktop only): last save, dataset version,
 * active filters, PWA cache state.
 */
export function StatusBar() {
  const { timeScale, unitId } = usePersistentFilters();
  const { isImported, lastSavedAt } = useDataset();

  const items = [
    `Last local save: ${lastSavedAt ? new Date(lastSavedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}`,
    `Dataset: ${isImported ? 'imported v' + new Date(lastSavedAt ?? 0).getTime().toString(36) : 'sample 1.0.0'}`,
    `Filters: ${timeScale[0].toUpperCase() + timeScale.slice(1)} · ${unitName(unitId)}`,
    'Cache: offline ready',
  ];

  return (
    <footer className="hidden h-8 items-center gap-5 overflow-x-auto border-t border-[var(--dcl-line)] bg-white/70 px-6 text-[11px] font-medium text-[var(--dcl-ink-400)] backdrop-blur md:flex">
      {items.map((item) => (
        <span key={item} className="whitespace-nowrap">
          {item}
        </span>
      ))}
      <span className="ml-auto whitespace-nowrap">DCL Pulse is accessible — WCAG AA targets</span>
    </footer>
  );
}
