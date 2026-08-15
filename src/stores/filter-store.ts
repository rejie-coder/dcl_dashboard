import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TimeScale } from '@/types/dcl';

/**
 * Global filters (Time Scale + Hospital Unit), persisted to localStorage.
 * Route changes preserve selections; reloads restore them.
 */

interface FilterState {
  timeScale: TimeScale;
  unitId: string;
  comparePrior: boolean;
  setTimeScale: (t: TimeScale) => void;
  setUnitId: (u: string) => void;
  setComparePrior: (v: boolean) => void;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      timeScale: 'month',
      unitId: 'all',
      comparePrior: false,
      setTimeScale: (timeScale) => set({ timeScale }),
      setUnitId: (unitId) => set({ unitId }),
      setComparePrior: (comparePrior) => set({ comparePrior }),
    }),
    { name: 'dcl-filters-v1' },
  ),
);
