import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataset } from '@/hooks/useDataset';
import { deriveObservations } from '@/lib/indicators/derive';
import {
  ImportFileError,
  isRawTemplate,
  parseImportFile,
  pickObservationSheet,
  type ParsedFile,
} from '@/lib/excel/parse-workbook';
import {
  mapHeaders,
  normalizeSheet,
  rawRowKey,
  rowsForCommit,
  type HeaderMapping,
  type NormalizedResult,
} from '@/lib/excel/normalize-rows';
import { downloadCsv } from '@/lib/excel/to-csv';
import { FIELD_SPECS, RAW_FIELDS } from '@/lib/schema/import.schema';
import { saveUndoSnapshot } from './undo-snapshot';
import { ValidationReport } from './ValidationReport';

const STEPS = ['Upload', 'Map columns', 'Validate', 'Preview', 'Commit'] as const;

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: 16 * dir }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -16 * dir }),
};

/** count of non-blank data cells in a raw row (for the preview table) */
function dataCellCount(raw: Record<string, unknown>): number {
  return Object.keys(raw).filter(
    (k) => typeof raw[k] === 'number' && !['daysInPeriod'].includes(k),
  ).length;
}

export interface ImportWizardProps {
  /** called whenever a validation result is produced or cleared (drives the quality dashboard) */
  onValidated?: (result: NormalizedResult | null, fileName: string | null) => void;
  /** called after a successful commit */
  onCommitted?: () => void;
}

/**
 * Five-step import wizard (design.md §6.6 + data.md section 3):
 * Upload → Map columns → Validate → Preview → Commit.
 * Imports RAW data-entry rows (one per unit per week/month); the store
 * derives all KPI indicators on commit. Page section, not a modal.
 */
export function ImportWizard({ onValidated, onCommitted }: ImportWizardProps) {
  const { dataset, commitImportedRawRows } = useDataset();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [mappings, setMappings] = useState<HeaderMapping[]>([]);
  const [result, setResult] = useState<NormalizedResult | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'overwrite'>('skip');
  const [confirmed, setConfirmed] = useState(false);
  const [committedRows, setCommittedRows] = useState<number | null>(null);
  const [derivedCount, setDerivedCount] = useState<number | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLButtonElement>(null);

  const existingKeys = useMemo(
    () => new Set(dataset.rawRows.map((r) => rawRowKey(r))),
    [dataset],
  );

  const sheet = useMemo(() => {
    if (!parsed) return null;
    return parsed.sheets.find((s) => s.name === sheetName) ?? pickObservationSheet(parsed);
  }, [parsed, sheetName]);

  const templateRecognized = useMemo(() => (parsed ? isRawTemplate(parsed) : false), [parsed]);

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const resetAll = useCallback(() => {
    setParsed(null);
    setSheetName(null);
    setMappings([]);
    setResult(null);
    setParseError(null);
    setConfirmed(false);
    setCommittedRows(null);
    setDerivedCount(null);
    setCommitError(null);
    onValidated?.(null, null);
  }, [onValidated]);

  const handleFile = useCallback(
    async (file: File) => {
      setParsing(true);
      setParseError(null);
      setCommittedRows(null);
      setDerivedCount(null);
      try {
        const parsedFile = await parseImportFile(file);
        const obsSheet = pickObservationSheet(parsedFile);
        setParsed(parsedFile);
        setSheetName(obsSheet.name);
        setMappings(mapHeaders(obsSheet.headers));
        setResult(null);
        onValidated?.(null, parsedFile.fileName);
        goTo(1);
      } catch (err) {
        setParseError(err instanceof ImportFileError ? err.message : 'Could not read this file.');
      } finally {
        setParsing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onValidated],
  );

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const selectSheet = (name: string) => {
    if (!parsed) return;
    setSheetName(name);
    const s = parsed.sheets.find((x) => x.name === name);
    if (s) {
      setMappings(mapHeaders(s.headers));
      setResult(null);
      onValidated?.(null, parsed.fileName);
    }
  };

  const remap = (source: string, field: string) => {
    setMappings((prev) => {
      const next = prev.map((m) => ({ ...m }));
      const value = field === '' ? null : (field as HeaderMapping['field']);
      // clear any other header already mapped to this field
      if (value) for (const m of next) if (m.field === value) Object.assign(m, { field: null, status: 'unmapped', confidence: 'none' });
      const target = next.find((m) => m.source === source);
      if (target) {
        target.field = value;
        target.status = value ? 'mapped' : 'unmapped';
        target.confidence = value ? 'alias' : 'none';
      }
      return next;
    });
  };

  const runValidation = () => {
    if (!sheet || !parsed) return;
    const res = normalizeSheet(sheet, mappings, existingKeys);
    setResult(res);
    onValidated?.(res, parsed.fileName);
    goTo(2);
  };

  const commitRows = useMemo(
    () => (result ? rowsForCommit(result, duplicateMode) : []),
    [result, duplicateMode],
  );

  /** indicators the dashboard will recalculate from the committed rows */
  const derivedIndicators = useMemo(() => deriveObservations(commitRows).length, [commitRows]);

  const doCommit = () => {
    if (!result || !parsed) return;
    setCommitError(null);
    try {
      saveUndoSnapshot();
      commitImportedRawRows(commitRows, { fileName: parsed.fileName, mode: 'merge' });
      setCommittedRows(commitRows.length);
      setDerivedCount(deriveObservations(commitRows).length);
      onCommitted?.();
    } catch {
      setCommitError(
        'Not enough local storage to save this dataset. Export a backup, delete imported data, and try a smaller file.',
      );
    }
  };

  const saveRejectedReport = () => {
    if (!result || !parsed) return;
    downloadCsv(
      ['row', 'field', 'issue', 'severity', 'suggestion'],
      [...result.errors, ...result.warnings].map((i) => [i.row, i.field, i.issue, i.severity, i.suggestion]),
      `rejected-rows-${parsed.fileName.replace(/\.[^.]+$/, '')}.csv`,
    );
  };

  const canCommit = result !== null && result.errors.length === 0 && commitRows.length > 0 && confirmed && committedRows === null;

  return (
    <div>
      {/* Stepper */}
      <ol className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-0" aria-label="Import progress">
        {STEPS.map((label, i) => {
          const state = i < step ? 'done' : i === step ? 'current' : 'todo';
          return (
            <li key={label} className="flex flex-1 items-center sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  if (i < step || (i <= 2 && parsed)) goTo(i);
                }}
                aria-current={i === step ? 'step' : undefined}
                disabled={i > step && !(i <= 2 && parsed)}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                  state === 'current' && 'bg-[#007AFF] text-white',
                  state === 'done' && 'bg-[#EAF3FF] text-[#0057B8]',
                  state === 'todo' && 'text-[var(--dcl-ink-400)]',
                )}
              >
                <span
                  className={cn(
                    'font-num flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                    state === 'current' ? 'bg-white/25' : state === 'done' ? 'bg-[#007AFF]/15' : 'bg-[var(--dcl-line)]',
                  )}
                >
                  {state === 'done' ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {label}
              </button>
              {i < STEPS.length - 1 && <span className="mx-1 hidden h-px flex-1 bg-[var(--dcl-line)] sm:block" aria-hidden />}
            </li>
          );
        })}
      </ol>

      <div className="relative mt-6">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22 }}
          >
            {/* ── Step 1: Upload ─────────────────────────────────────── */}
            {step === 0 && (
              <div>
                <button
                  ref={dropZoneRef}
                  id="import-dropzone"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={cn(
                    'flex min-h-[260px] w-full flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed p-8 text-center transition-all duration-200',
                    dragOver
                      ? 'border-[#007AFF] bg-[#EAF3FF]'
                      : 'border-[var(--dcl-line-strong)] bg-[var(--dcl-surface-tint)] hover:border-[#007AFF]/50',
                  )}
                >
                  <motion.img
                    src={`${import.meta.env.BASE_URL}empty-import.svg`}
                    alt=""
                    animate={{ y: dragOver ? -3 : 0 }}
                    transition={{ duration: 0.24 }}
                    className="h-32 object-contain"
                  />
                  {parsing ? (
                    <span className="flex items-center gap-2 text-[14px] font-medium text-[var(--dcl-ink-700)]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
                      Parsing locally…
                    </span>
                  ) : (
                    <>
                      <span className="text-[14.5px] font-semibold text-[var(--dcl-ink-900)]">
                        Drop a filled Excel template or CSV here
                      </span>
                      <span className="text-[13px] font-medium text-[#007AFF]">or browse files</span>
                      <span className="font-num text-[11.5px] text-[var(--dcl-ink-400)]">
                        .xlsx · .xls · .csv — one row per unit per week or month — Maximum 10 MB
                      </span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  aria-label="Import data file"
                  onChange={onInputChange}
                />
                {parseError && (
                  <p className="mt-3 rounded-xl border border-[#FF3B30]/25 bg-[#FF3B30]/5 p-3 text-[12.5px] font-medium text-[#B42318]">
                    {parseError}
                  </p>
                )}
                <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-[1.5] text-[var(--dcl-ink-400)]">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#34C759]" />
                  Files are parsed and stored locally in this browser. Nothing is uploaded.
                </p>
              </div>
            )}

            {/* ── Step 2: Map columns ────────────────────────────────── */}
            {step === 1 && parsed && sheet && (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-[var(--dcl-ink-700)]">
                    {parsed.fileName} · {(parsed.sizeBytes / 1024).toFixed(0)} KB · Data sheet:
                  </span>
                  {parsed.sheets.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => selectSheet(s.name)}
                      className={cn(
                        'font-num rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
                        s.name === sheet.name
                          ? 'border-[#007AFF] bg-[#EAF3FF] text-[#0057B8]'
                          : 'border-[var(--dcl-line)] text-[var(--dcl-ink-500)] hover:bg-[var(--dcl-surface-tint)]',
                      )}
                    >
                      {s.name} ({s.rows.length})
                    </button>
                  ))}
                </div>
                {templateRecognized && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-[#1F7A38]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Official DCL Pulse template recognized — columns are mapped automatically.
                  </p>
                )}

                <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--dcl-line)]">
                  <table className="w-full min-w-[560px] text-left text-[12.5px]">
                    <thead>
                      <tr className="bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]">
                        <th className="px-3 py-2 font-semibold">Source header</th>
                        <th className="px-3 py-2 font-semibold">Mapped field</th>
                        <th className="px-3 py-2 font-semibold">Confidence</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--dcl-line)]">
                      {mappings.map((m) => (
                        <tr key={m.source}>
                          <td className="font-num px-3 py-2 font-semibold text-[var(--dcl-ink-900)]">{m.source}</td>
                          <td className="px-3 py-2">
                            <select
                              value={m.field ?? ''}
                              onChange={(e) => remap(m.source, e.target.value)}
                              className="font-num h-8 rounded-lg border border-[var(--dcl-line)] bg-white px-2 text-[12px] text-[var(--dcl-ink-700)]"
                              aria-label={`Map header ${m.source}`}
                            >
                              <option value="">Ignore</option>
                              {RAW_FIELDS.map((f) => (
                                <option key={f} value={f}>
                                  {FIELD_SPECS.find((s) => s.field === f)?.header ?? f}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 capitalize text-[var(--dcl-ink-500)]">
                            {m.field ? m.confidence : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                m.field ? 'bg-[#34C759]/10 text-[#1F7A38]' : 'bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]',
                              )}
                            >
                              {m.field ? 'Mapped' : 'Ignored'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => goTo(0)}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--dcl-ink-500)] hover:text-[var(--dcl-ink-900)]"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={runValidation}
                    className="flex h-10 items-center gap-2 rounded-full bg-[#007AFF] px-5 text-[13px] font-semibold text-white hover:bg-[#0066D6]"
                  >
                    Validate rows <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* ── Step 3: Validate ───────────────────────────────────── */}
            {step === 2 && result && (
              <div>
                <ValidationReport result={result} />
                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => goTo(1)}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--dcl-ink-500)] hover:text-[var(--dcl-ink-900)]"
                  >
                    <ChevronLeft className="h-4 w-4" /> Adjust mapping
                  </button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => goTo(3)}
                    disabled={result.valid.length === 0}
                    className="flex h-10 items-center gap-2 rounded-full bg-[#007AFF] px-5 text-[13px] font-semibold text-white hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Preview valid rows <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* ── Step 4: Preview ────────────────────────────────────── */}
            {step === 3 && result && (
              <div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-[var(--dcl-line)] p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-400)]">Rows to commit</p>
                    <p className="font-num mt-1 text-[22px] font-semibold text-[var(--dcl-ink-900)]">{commitRows.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--dcl-line)] p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-400)]">Indicators recalculated</p>
                    <p className="font-num mt-1 text-[22px] font-semibold text-[var(--dcl-ink-900)]">{derivedIndicators}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--dcl-line)] p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-400)]">Units covered</p>
                    <p className="font-num mt-1 text-[22px] font-semibold text-[var(--dcl-ink-900)]">{Object.keys(result.summary.byUnit).length}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--dcl-line)] p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-400)]">Date range</p>
                    <p className="font-num mt-1.5 text-[12.5px] font-semibold leading-[1.4] text-[var(--dcl-ink-900)]">
                      {result.summary.minDate ?? '—'}<br />→ {result.summary.maxDate ?? '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--dcl-line)]">
                  <table className="w-full min-w-[720px] text-left text-[12px]">
                    <thead>
                      <tr className="bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]">
                        {['Row', 'Unit', 'Period', 'Grain', 'Period start', 'Period end', 'Days', 'Data cells filled'].map((h) => (
                          <th key={h} className="font-num px-3 py-2 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--dcl-line)]">
                      {result.valid.slice(0, 20).map((v) => (
                        <tr key={v.row}>
                          <td className="font-num px-3 py-1.5 text-[var(--dcl-ink-500)]">{v.row}</td>
                          <td className="font-num px-3 py-1.5 font-semibold text-[var(--dcl-ink-900)]">{v.raw.unitId}</td>
                          <td className="px-3 py-1.5">{v.raw.periodLabel}</td>
                          <td className="font-num px-3 py-1.5 capitalize">{v.raw.grain}</td>
                          <td className="font-num px-3 py-1.5">{v.raw.periodStart}</td>
                          <td className="font-num px-3 py-1.5">{v.raw.periodEnd}</td>
                          <td className="font-num px-3 py-1.5">{v.raw.daysInPeriod}</td>
                          <td className="font-num px-3 py-1.5">{dataCellCount(v.raw as unknown as Record<string, unknown>)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.valid.length > 20 && (
                    <p className="border-t border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] px-3 py-2 text-[11.5px] text-[var(--dcl-ink-500)]">
                      Showing first 20 of {result.valid.length} valid rows.
                    </p>
                  )}
                </div>

                {result.duplicates.length > 0 && (
                  <fieldset className="mt-4 rounded-xl border border-[#007AFF]/25 bg-[#EAF3FF] p-4">
                    <legend className="px-1 text-[12.5px] font-semibold text-[#0057B8]">
                      {result.duplicates.length} duplicate{result.duplicates.length === 1 ? '' : 's'} on unit + period start + grain
                    </legend>
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:gap-6">
                      {(
                        [
                          ['skip', 'Skip incoming', 'Keep the existing dataset rows; duplicate incoming rows are dropped.'],
                          ['overwrite', 'Overwrite existing', 'Imported rows replace matching rows already in the dataset.'],
                        ] as const
                      ).map(([value, label, help]) => (
                        <label key={value} className="flex cursor-pointer items-start gap-2 text-[12.5px]">
                          <input
                            type="radio"
                            name="duplicate-mode"
                            checked={duplicateMode === value}
                            onChange={() => setDuplicateMode(value)}
                            className="mt-0.5 accent-[#007AFF]"
                          />
                          <span>
                            <span className="font-semibold text-[var(--dcl-ink-900)]">{label}</span>
                            <span className="block text-[var(--dcl-ink-500)]">{help}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                <p className="mt-4 rounded-xl bg-[#FFCC00]/10 p-3 text-[12.5px] font-medium text-[#713F12]">
                  Committing will create a new local dataset version. The dashboard recalculates all indicators
                  from the merged raw rows automatically.
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => goTo(2)}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--dcl-ink-500)] hover:text-[var(--dcl-ink-900)]"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back to validation
                  </button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => goTo(4)}
                    className="flex h-10 items-center gap-2 rounded-full bg-[#007AFF] px-5 text-[13px] font-semibold text-white hover:bg-[#0066D6]"
                  >
                    Continue to commit <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* ── Step 5: Commit ─────────────────────────────────────── */}
            {step === 4 && result && parsed && (
              <div className="max-w-xl">
                {committedRows === null ? (
                  <>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--dcl-line)] p-4 text-[13.5px]">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#007AFF]"
                      />
                      <span className="font-medium text-[var(--dcl-ink-900)]">I have reviewed the validation report.</span>
                    </label>

                    {result.errors.length > 0 && (
                      <p className="mt-3 rounded-xl border border-[#FF3B30]/25 bg-[#FF3B30]/5 p-3 text-[12.5px] font-medium text-[#B42318]">
                        {result.errors.length} blocking error{result.errors.length === 1 ? '' : 's'} must be fixed or excluded
                        before commit. Go back and adjust the file or mapping.
                      </p>
                    )}
                    {commitError && (
                      <p className="mt-3 rounded-xl border border-[#FF3B30]/25 bg-[#FF3B30]/5 p-3 text-[12.5px] font-medium text-[#B42318]">
                        {commitError}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={doCommit}
                        disabled={!canCommit}
                        className="flex h-11 items-center gap-2 rounded-full bg-[#007AFF] px-6 text-[13.5px] font-semibold text-white hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Create dataset version ({commitRows.length} rows)
                      </motion.button>
                      <button
                        type="button"
                        onClick={saveRejectedReport}
                        className="h-11 rounded-full border border-[var(--dcl-line)] px-5 text-[13px] font-semibold text-[var(--dcl-ink-700)] hover:bg-[var(--dcl-surface-tint)]"
                      >
                        Save rejected rows report
                      </button>
                      <button
                        type="button"
                        onClick={() => goTo(3)}
                        className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--dcl-ink-500)] hover:text-[var(--dcl-ink-900)]"
                      >
                        <ChevronLeft className="h-4 w-4" /> Back
                      </button>
                    </div>
                    <p className="mt-3 text-[11.5px] text-[var(--dcl-ink-400)]">
                      A snapshot of the current dataset is kept so this import can be undone from the version history below.
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-start gap-3">
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.26 }}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-[#34C759]/12"
                    >
                      <Check className="h-6 w-6 text-[#1F7A38]" strokeWidth={3} />
                    </motion.span>
                    <h3 className="font-display text-[17px] font-semibold text-[var(--dcl-ink-900)]">
                      Dataset version created
                    </h3>
                    <p className="text-[13px] leading-[1.55] text-[var(--dcl-ink-500)]">
                      {committedRows.toLocaleString()} raw rows from <span className="font-num">{parsed.fileName}</span> are
                      now part of the active dataset, and {derivedCount?.toLocaleString() ?? '—'} indicator values were
                      recalculated from them. All dashboard routes reflect the new data.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        resetAll();
                        goTo(0);
                      }}
                      className="flex h-10 items-center gap-2 rounded-full border border-[var(--dcl-line)] px-5 text-[13px] font-semibold text-[var(--dcl-ink-700)] hover:bg-[var(--dcl-surface-tint)]"
                    >
                      <Upload className="h-4 w-4" /> Import another file
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
