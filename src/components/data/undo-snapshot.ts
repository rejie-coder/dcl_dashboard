/**
 * Undo snapshot helpers for import commits (design.md §11.8: "keep previous
 * snapshot for undo"). The dataset store exposes no setter for imported
 * rows, so the snapshot round-trips through localStorage and a reload.
 *
 * v2: snapshots the imported RAW rows (`dcl-imported-rawrows-v1`) plus the
 * legacy imported-observations key and the batch log.
 */
import type { ImportBatch, Observation, RawPeriodRow } from '@/types/dcl';

const UNDO_KEY = 'dcl-import-undo-v1';
const RAW_KEY = 'dcl-imported-rawrows-v1';
const IMPORT_KEY = 'dcl-imported-observations-v1'; // legacy precomputed observations
const BATCH_KEY = 'dcl-import-batches-v1';

export interface UndoSnapshot {
  rawRows: RawPeriodRow[];
  observations: Observation[];
  batches: ImportBatch[];
  savedAt: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeKey(key: string, value: unknown[]): void {
  if (value.length === 0) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

/** Capture the current imported rows + batches before a new commit. */
export function saveUndoSnapshot(): void {
  const snapshot: UndoSnapshot = {
    rawRows: readJson<RawPeriodRow[]>(RAW_KEY, []),
    observations: readJson<Observation[]>(IMPORT_KEY, []),
    batches: readJson<ImportBatch[]>(BATCH_KEY, []),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(UNDO_KEY, JSON.stringify(snapshot));
}

export function loadUndoSnapshot(): UndoSnapshot | null {
  try {
    const raw = localStorage.getItem(UNDO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UndoSnapshot>;
    // tolerate snapshots written by the v1 importer (observations only)
    return {
      rawRows: parsed.rawRows ?? [],
      observations: parsed.observations ?? [],
      batches: parsed.batches ?? [],
      savedAt: parsed.savedAt ?? '',
    };
  } catch {
    return null;
  }
}

export function clearUndoSnapshot(): void {
  localStorage.removeItem(UNDO_KEY);
}

/** Write the snapshot back as the active imported data. Caller reloads. */
export function restoreUndoSnapshot(): boolean {
  const snapshot = loadUndoSnapshot();
  if (!snapshot) return false;
  writeKey(RAW_KEY, snapshot.rawRows);
  writeKey(IMPORT_KEY, snapshot.observations);
  writeKey(BATCH_KEY, snapshot.batches);
  clearUndoSnapshot();
  return true;
}
