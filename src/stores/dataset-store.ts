import { create } from 'zustand';
import type { ImportBatch, Observation, PerformanceDataset, RawPeriodRow } from '@/types/dcl';
import { generateDummyDataset, generateSampleRawRows } from '@/data/dummy-generator';
import { deriveObservations } from '@/lib/indicators/derive';

/**
 * Active dataset store (v2).
 * - Source of truth: RAW data-entry rows (`RawPeriodRow`). The sample
 *   dataset ships generated raw rows; committed imports are persisted in
 *   localStorage and merged on top.
 * - KPI observations are always DERIVED from the active raw rows via
 *   deriveObservations() — nothing precomputed is stored.
 * - `commitImportedRawRows` is the entry point for the Import Wizard.
 * - Legacy `commitImport` (precomputed Observation rows) is kept working:
 *   those rows are overlaid on the derived observations by key.
 */

const RAW_KEY = 'dcl-imported-rawrows-v1';
const IMPORT_KEY = 'dcl-imported-observations-v1'; // legacy precomputed observations
const BATCH_KEY = 'dcl-import-batches-v1';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / unavailable — keep the in-memory state
  }
}

export interface RawCommitMeta {
  fileName: string;
  /**
   * 'merge' (default): upsert rows into the active raw rows, keyed by
   *   unitId+periodStart+grain (imported rows replace overlapping sample rows).
   * 'replace': the imported rows become the ENTIRE active raw dataset
   *   (sample rows are discarded).
   */
  mode?: 'replace' | 'merge';
}

interface DatasetState {
  /** full active dataset (raw rows + derived observations + registry) */
  dataset: PerformanceDataset;
  /** active raw rows — source of truth (sample ∪ committed imports) */
  rawRows: RawPeriodRow[];
  importedRawRows: RawPeriodRow[];
  importedObservations: Observation[];
  importBatches: ImportBatch[];
  isImported: boolean;
  lastSavedAt: string | null;
  /** bumps on every committed import (cheap change signal for consumers) */
  datasetVersion: number;
  /** commit validated RAW rows from the Import Wizard */
  commitImportedRawRows: (rows: RawPeriodRow[], batchMeta: RawCommitMeta) => void;
  /** legacy: commit precomputed observation rows (overlaid on derived data) */
  commitImport: (fileName: string, rows: Observation[]) => void;
  /** discard all imported data and return to the sample dataset */
  resetToSample: () => void;
}

function rawKey(r: RawPeriodRow): string {
  return `${r.unitId}|${r.periodStart}|${r.grain}`;
}

function obsKey(o: Observation): string {
  return `${o.metricId}|${o.unitId}|${o.periodStart}|${o.grain}`;
}

/** Merge sample raw rows with committed imports (upsert by unit+period). */
function mergeRawRows(imported: RawPeriodRow[]): RawPeriodRow[] {
  if (imported.length === 0) return generateSampleRawRows();
  const importedKeys = new Set(imported.map(rawKey));
  return [
    ...generateSampleRawRows().filter((r) => !importedKeys.has(rawKey(r))),
    ...imported.map((r) => ({ ...r, source: 'import' as const })),
  ];
}

function buildDataset(
  rawRows: RawPeriodRow[],
  importedObs: Observation[],
  batches: ImportBatch[],
): PerformanceDataset {
  const base = generateDummyDataset();
  const derived = deriveObservations(rawRows);
  if (importedObs.length === 0) {
    return { ...base, rawRows, observations: derived, importBatches: batches };
  }
  const importedKeys = new Set(importedObs.map(obsKey));
  const merged = [
    ...derived.filter((o) => !importedKeys.has(obsKey(o))),
    ...importedObs.map((o) => ({ ...o, source: 'import' as const })),
  ];
  return { ...base, rawRows, observations: merged, importBatches: batches };
}

function makeBatch(meta: RawCommitMeta, rowCount: number, kind: ImportBatch['kind']): ImportBatch {
  return {
    id: `batch-${Date.now()}`,
    importedAt: new Date().toISOString(),
    fileName: meta.fileName,
    rowCount,
    status: 'committed',
    kind,
  };
}

export const useDatasetStore = create<DatasetState>()((set, get) => {
  const importedRaw = loadJson<RawPeriodRow[]>(RAW_KEY, []);
  const importedObs = loadJson<Observation[]>(IMPORT_KEY, []);
  const batches = loadJson<ImportBatch[]>(BATCH_KEY, []);
  const rawRows = mergeRawRows(importedRaw);
  return {
    dataset: buildDataset(rawRows, importedObs, batches),
    rawRows,
    importedRawRows: importedRaw,
    importedObservations: importedObs,
    importBatches: batches,
    isImported: importedRaw.length > 0 || importedObs.length > 0,
    lastSavedAt: importedRaw.length + importedObs.length > 0 ? (batches.at(-1)?.importedAt ?? null) : null,
    datasetVersion: 0,

    commitImportedRawRows: (rows, batchMeta) => {
      const mode = batchMeta.mode ?? 'merge';
      const incoming = rows.map((r) => ({ ...r, source: 'import' as const }));
      let imported: RawPeriodRow[];
      if (mode === 'replace') {
        imported = incoming;
      } else {
        const existing = get().importedRawRows;
        const incomingKeys = new Set(incoming.map(rawKey));
        imported = [...existing.filter((r) => !incomingKeys.has(rawKey(r))), ...incoming];
      }
      const batch = makeBatch(batchMeta, rows.length, 'raw-rows');
      const batches = [...get().importBatches, batch];
      const rawRows =
        mode === 'replace'
          ? incoming
          : [
              ...generateSampleRawRows().filter(
                (r) => !new Set(imported.map(rawKey)).has(rawKey(r)),
              ),
              ...imported,
            ];
      persist(RAW_KEY, imported);
      persist(BATCH_KEY, batches);
      set((s) => ({
        importedRawRows: imported,
        importBatches: batches,
        rawRows,
        dataset: buildDataset(rawRows, s.importedObservations, batches),
        isImported: true,
        lastSavedAt: batch.importedAt,
        datasetVersion: s.datasetVersion + 1,
      }));
    },

    commitImport: (fileName, rows) => {
      const existing = get().importedObservations;
      const incomingKeys = new Set(rows.map(obsKey));
      const merged = [
        ...existing.filter((o) => !incomingKeys.has(obsKey(o))),
        ...rows.map((o) => ({ ...o, source: 'import' as const })),
      ];
      const batch = makeBatch({ fileName }, rows.length, 'observations');
      const batches = [...get().importBatches, batch];
      persist(IMPORT_KEY, merged);
      persist(BATCH_KEY, batches);
      set((s) => ({
        importedObservations: merged,
        importBatches: batches,
        dataset: buildDataset(s.rawRows, merged, batches),
        isImported: true,
        lastSavedAt: batch.importedAt,
        datasetVersion: s.datasetVersion + 1,
      }));
    },

    resetToSample: () => {
      try {
        localStorage.removeItem(RAW_KEY);
        localStorage.removeItem(IMPORT_KEY);
        localStorage.removeItem(BATCH_KEY);
      } catch {
        // ignore
      }
      const rawRows = generateSampleRawRows();
      set((s) => ({
        importedRawRows: [],
        importedObservations: [],
        importBatches: [],
        rawRows,
        dataset: buildDataset(rawRows, [], []),
        isImported: false,
        lastSavedAt: null,
        datasetVersion: s.datasetVersion + 1,
      }));
    },
  };
});
