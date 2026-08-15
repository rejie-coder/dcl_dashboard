import { useMemo } from 'react';
import { METRIC_MAP } from '@/data/metrics';
import { aggregateObservations, type RolledPeriod } from '@/lib/spc/aggregate';
import { buildSPCSeries } from '@/lib/spc/calculate-limits';
import { useDatasetStore } from '@/stores/dataset-store';
import { useFilterStore } from '@/stores/filter-store';
import type { Grain, SPCPoint } from '@/types/dcl';

/**
 * Compute the SPC series for one metric under the current global filters
 * (time scale + hospital unit). Returns points with CL/UCL/LCL and signals.
 */
export function useSPC(metricId: string): {
  points: SPCPoint[];
  periods: RolledPeriod[];
  insufficientBaseline: boolean;
  grain: Grain;
} {
  const timeScale = useFilterStore((s) => s.timeScale);
  const unitId = useFilterStore((s) => s.unitId);
  const dataset = useDatasetStore((s) => s.dataset);

  return useMemo(() => {
    const metric = METRIC_MAP[metricId];
    if (!metric) return { points: [], periods: [], insufficientBaseline: true, grain: timeScale };
    const rows = dataset.observations.filter((o) => o.metricId === metricId && o.unitId === unitId);
    const periods = aggregateObservations(rows, timeScale, metric);
    const points = buildSPCSeries(periods, metric, timeScale);
    return { points, periods, insufficientBaseline: points.length === 0, grain: timeScale };
  }, [dataset, metricId, timeScale, unitId]);
}

/** Non-hook variant for batch computations inside other memos. */
export function computeSPC(
  dataset: ReturnType<typeof useDatasetStore.getState>['dataset'],
  metricId: string,
  unitId: string,
  grain: Grain,
): SPCPoint[] {
  const metric = METRIC_MAP[metricId];
  if (!metric) return [];
  const rows = dataset.observations.filter((o) => o.metricId === metricId && o.unitId === unitId);
  const periods = aggregateObservations(rows, grain, metric);
  return buildSPCSeries(periods, metric, grain);
}
