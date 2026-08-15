import { useFilterStore } from '@/stores/filter-store';
import type { TimeScale } from '@/types/dcl';

/**
 * Access the persisted global filters (Time Scale + Hospital Unit).
 * State lives in `filter-store.ts` (localStorage-persisted) and survives
 * route changes and reloads.
 */
export function usePersistentFilters() {
  const timeScale = useFilterStore((s) => s.timeScale);
  const unitId = useFilterStore((s) => s.unitId);
  const comparePrior = useFilterStore((s) => s.comparePrior);
  const setTimeScale = useFilterStore((s) => s.setTimeScale);
  const setUnitId = useFilterStore((s) => s.setUnitId);
  const setComparePrior = useFilterStore((s) => s.setComparePrior);
  return { timeScale, unitId, comparePrior, setTimeScale, setUnitId, setComparePrior };
}

export type { TimeScale };
