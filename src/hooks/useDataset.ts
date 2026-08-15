import { useDatasetStore } from '@/stores/dataset-store';

/**
 * Access the active performance dataset (sample by default; committed
 * imports are merged in and persisted in localStorage).
 */
export function useDataset() {
  const dataset = useDatasetStore((s) => s.dataset);
  const isImported = useDatasetStore((s) => s.isImported);
  const importBatches = useDatasetStore((s) => s.importBatches);
  const lastSavedAt = useDatasetStore((s) => s.lastSavedAt);
  const datasetVersion = useDatasetStore((s) => s.datasetVersion);
  const commitImport = useDatasetStore((s) => s.commitImport);
  const commitImportedRawRows = useDatasetStore((s) => s.commitImportedRawRows);
  const resetToSample = useDatasetStore((s) => s.resetToSample);
  return {
    dataset,
    rawRows: dataset.rawRows,
    isImported,
    importBatches,
    lastSavedAt,
    datasetVersion,
    commitImport,
    commitImportedRawRows,
    resetToSample,
  };
}
