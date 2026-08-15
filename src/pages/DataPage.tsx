import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CircleAlert,
  Database,
  Download,
  FileSpreadsheet,
  History,
  Lock,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataset } from '@/hooks/useDataset';
import { DOMAINS } from '@/data/domains';
import { downloadBlob, downloadCsv } from '@/lib/excel/to-csv';
import type { NormalizedResult } from '@/lib/excel/normalize-rows';
import { ImportWizard } from '@/components/data/ImportWizard';
import { TemplateDownloadCard } from '@/components/data/TemplateDownloadCard';
import { SchemaPreview } from '@/components/data/SchemaPreview';
import { clearUndoSnapshot, loadUndoSnapshot, restoreUndoSnapshot } from '@/components/data/undo-snapshot';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' });
}

/** Quality ring that draws over 700ms when scrolled into view. */
function ScoreRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = value >= 95 ? '#34C759' : value >= 80 ? '#FFCC00' : '#FF3B30';
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90" role="img" aria-label={`Quality score ${value} percent`}>
      <circle cx="48" cy="48" r={r} fill="none" stroke="var(--dcl-line)" strokeWidth="8" />
      <motion.circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: c * (1 - value / 100) }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </svg>
  );
}

/** Typed-confirmation dialog (RESET / DELETE). */
function ConfirmDialog({
  open,
  word,
  title,
  copy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  word: 'RESET' | 'DELETE';
  title: string;
  copy: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4"
          onClick={onCancel}
          role="presentation"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-[24px] border border-[var(--dcl-line)] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-[17px] font-semibold text-[var(--dcl-ink-900)]">{title}</h3>
            <p className="mt-2 text-[13px] leading-[1.55] text-[var(--dcl-ink-500)]">{copy}</p>
            <label className="mt-4 block text-[12.5px] font-medium text-[var(--dcl-ink-700)]">
              Type <span className="font-num font-semibold text-[#B42318]">{word}</span> to confirm
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onCancel();
                }}
                className="font-num mt-1.5 h-10 w-full rounded-xl border border-[var(--dcl-line)] px-3 text-[13px] focus:border-[#FF3B30]"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-10 rounded-full border border-[var(--dcl-line)] px-4 text-[13px] font-semibold text-[var(--dcl-ink-700)] hover:bg-[var(--dcl-surface-tint)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={typed !== word}
                onClick={onConfirm}
                className="h-10 rounded-full bg-[#FF3B30] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#D70015] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {word === 'RESET' ? 'Reset now' : 'Delete now'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function DataPage() {
  const { dataset, isImported, importBatches, lastSavedAt, resetToSample } = useDataset();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [validation, setValidation] = useState<{ result: NormalizedResult; fileName: string } | null>(null);
  const [confirm, setConfirm] = useState<null | 'reset' | 'delete'>(null);
  const [undoAvailable, setUndoAvailable] = useState(() => loadUndoSnapshot() !== null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'DCL Pulse — Data Management';
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  const exportDatasetJson = () => {
    downloadBlob(
      new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' }),
      `dcl-dataset-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
  };

  const handleUndo = () => {
    if (restoreUndoSnapshot()) {
      window.location.reload();
    }
  };

  const handleReset = () => {
    clearUndoSnapshot();
    resetToSample();
    setUndoAvailable(false);
    setConfirm(null);
    showToast('Sample dataset restored. Imported data was removed from this device.');
  };

  const focusDropZone = () => {
    const el = document.getElementById('import-dropzone');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  };

  // ── Quality dashboard derivations ───────────────────────────────────
  const quality = useMemo(() => {
    if (!validation) return null;
    const { result } = validation;
    const total = result.valid.length + result.errors.length;
    const score = total > 0 ? Math.round((result.valid.length / total) * 100) : 0;
    const byDomain = DOMAINS.map((d) => {
      // count of valid rows carrying at least one data field of this domain
      const count = result.summary.byDomain[d.id] ?? 0;
      return { domain: d, count };
    });
    const maxCount = Math.max(1, ...byDomain.map((b) => b.count));
    const issueGroups = new Map<string, { count: number; severity: 'error' | 'warning'; row: number }>();
    for (const issue of [...result.errors, ...result.warnings]) {
      const key = issue.issue.replace(/"[^"]*"/g, '"…"');
      const g = issueGroups.get(key) ?? { count: 0, severity: issue.severity, row: issue.row };
      g.count += 1;
      issueGroups.set(key, g);
    }
    return { result, score, byDomain, maxCount, issueGroups: [...issueGroups.entries()] };
  }, [validation]);

  const sampleRows = dataset.rawRows.length;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Section 1: Header + privacy banner ───────────────────────── */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--dcl-ink-500)]"
          >
            Data stewardship
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="font-display mt-1 text-[32px] font-bold leading-[1.12] tracking-[-0.035em] text-[var(--dcl-ink-900)]"
          >
            Data Management
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, delay: 0.08 }}
            className="mt-2 max-w-xl text-[14.5px] leading-[1.55] text-[var(--dcl-ink-500)]"
          >
            Import, validate, and version hospital performance data without a server.
          </motion.p>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, delay: 0.12 }}
            type="button"
            onClick={() => document.getElementById('dataset-versions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--dcl-line)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--dcl-ink-700)] shadow-sm"
          >
            <Database className="h-3.5 w-3.5 text-[var(--dcl-ink-400)]" />
            {isImported
              ? `Imported data · v${importBatches.length + 1} · ${importBatches.at(-1)?.fileName ?? ''}`
              : 'Sample data · Jan 2023–Dec 2025'}
          </motion.button>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22, delay: 0.07 }}
          className="flex flex-col gap-2.5 sm:flex-row"
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const el = document.querySelector<HTMLButtonElement>('#template-download-btn');
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el?.click();
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--dcl-line)] bg-white px-5 text-[13.5px] font-semibold text-[var(--dcl-ink-700)] shadow-sm transition-colors hover:bg-[var(--dcl-surface-tint)]"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#34C759]" />
            Download Excel template
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={focusDropZone}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#007AFF] px-5 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0066D6]"
          >
            <Upload className="h-4 w-4" />
            Import data
          </motion.button>
        </motion.div>
      </section>

      {/* Privacy banner */}
      <motion.button
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.18 }}
        type="button"
        onClick={() => setPrivacyOpen(true)}
        className="flex w-full items-start gap-2.5 rounded-2xl border border-[#34C759]/25 bg-[#34C759]/[0.07] p-3.5 text-left"
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1F7A38]" />
        <span>
          <span className="block text-[13px] font-semibold text-[#1F7A38]">
            Files are parsed and stored locally in this browser. Nothing is uploaded.
          </span>
          <span className="block text-[12px] text-[var(--dcl-ink-500)]">
            Use Export dataset JSON to back up local imports. Stored on this device · Offline ready.
          </span>
        </span>
      </motion.button>

      {/* Privacy explainer modal */}
      <AnimatePresence>
        {privacyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4"
            onClick={() => setPrivacyOpen(false)}
            role="presentation"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Local data handling"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md rounded-[24px] border border-[var(--dcl-line)] bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display text-[17px] font-semibold text-[var(--dcl-ink-900)]">How local data works</h3>
              <ul className="mt-3 flex flex-col gap-2 text-[13px] leading-[1.55] text-[var(--dcl-ink-700)]">
                <li>· Files are read with your browser’s File API and parsed in memory with SheetJS or Papa Parse.</li>
                <li>· Committed rows are written to this browser’s localStorage only.</li>
                <li>· No network request ever carries your data; DCL Pulse has no server.</li>
                <li>· Export dataset JSON before clearing browser storage or switching devices.</li>
              </ul>
              <button
                type="button"
                autoFocus
                onClick={() => setPrivacyOpen(false)}
                onKeyDown={(e) => e.key === 'Escape' && setPrivacyOpen(false)}
                className="mt-5 h-10 w-full rounded-full bg-[#007AFF] text-[13px] font-semibold text-white hover:bg-[#0066D6]"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section 2: Template + schema cards ───────────────────────── */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <TemplateDownloadCard />
        <SchemaPreview />
      </section>

      {/* ── Section 3: Import wizard ─────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.3 }}
        className="dcl-card rounded-[24px] p-6"
      >
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--dcl-ink-900)]">Import wizard</h2>
        <p className="mt-0.5 text-[13px] text-[var(--dcl-ink-500)]">
          Upload a workbook or CSV, check the detected schema, review validation, and commit a new local version.
        </p>
        <div className="mt-5">
          <ImportWizard
            onValidated={(result, fileName) => setValidation(result && fileName ? { result, fileName } : null)}
            onCommitted={() => {
              setUndoAvailable(loadUndoSnapshot() !== null);
              showToast('Import committed. A new local dataset version is active.');
            }}
          />
        </div>
      </motion.section>

      {/* ── Section 4: Data quality dashboard ────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.3 }}
        className="dcl-card rounded-[24px] p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--dcl-ink-900)]">
              Validation quality
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--dcl-ink-500)]">
              {validation ? `Latest check: ${validation.fileName}` : 'Based on the most recent import attempt.'}
            </p>
          </div>
          {validation && (
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  ['row', 'field', 'issue', 'severity', 'suggestion'],
                  [...validation.result.errors, ...validation.result.warnings].map((i) => [
                    i.row,
                    i.field,
                    i.issue,
                    i.severity,
                    i.suggestion,
                  ]),
                  'dcl-validation-report.csv',
                )
              }
              className="flex h-9 items-center gap-2 rounded-full border border-[var(--dcl-line)] px-3.5 text-[12.5px] font-medium text-[var(--dcl-ink-700)] hover:bg-[var(--dcl-surface-tint)]"
            >
              <Download className="h-3.5 w-3.5" />
              Download validation report
            </button>
          )}
        </div>

        {!quality ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-[var(--dcl-surface-tint)] p-8 text-center">
            <img src={`${import.meta.env.BASE_URL}empty-import.svg`} alt="" className="h-28 object-contain" />
            <p className="max-w-sm text-[13.5px] text-[var(--dcl-ink-500)]">
              No import validation yet. Download the template or upload a file.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Score ring */}
            <div className="flex items-center gap-4 lg:col-span-4">
              <ScoreRing value={quality.score} />
              <div>
                <p className="font-num text-[26px] font-semibold leading-none text-[var(--dcl-ink-900)]">
                  {quality.score}% valid
                </p>
                <p className="mt-1.5 text-[12.5px] text-[var(--dcl-ink-500)]">
                  {quality.result.valid.length} valid · {quality.result.errors.length} blocking ·{' '}
                  {quality.result.warnings.length} warnings
                </p>
                <p className="mt-1 text-[11.5px] text-[var(--dcl-ink-400)]">
                  Score = valid rows ÷ (valid rows + blocking errors)
                </p>
              </div>
            </div>

            {/* Completeness by domain */}
            <div className="lg:col-span-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-400)]">
                Valid rows by domain
              </p>
              <div className="mt-3 flex flex-col gap-2.5">
                {quality.byDomain.map(({ domain, count }, i) => (
                  <div key={domain.id} className="flex items-center gap-2.5">
                    <span className="w-20 shrink-0 truncate text-[12px] font-medium text-[var(--dcl-ink-700)]">
                      {domain.name.split(' ')[0]}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--dcl-surface-tint)]">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(count / quality.maxCount) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: i * 0.06, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: domain.color }}
                      />
                    </div>
                    <span className="font-num w-10 shrink-0 text-right text-[11.5px] text-[var(--dcl-ink-500)]">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Issue breakdown */}
            <div className="lg:col-span-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-400)]">
                Issue breakdown
              </p>
              {quality.issueGroups.length === 0 ? (
                <p className="mt-3 flex items-center gap-2 text-[13px] text-[var(--dcl-ink-500)]">
                  <ShieldCheck className="h-4 w-4 text-[#34C759]" /> No issues detected.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--dcl-line)]">
                  {quality.issueGroups.slice(0, 6).map(([issue, g]) => (
                    <li key={issue} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-2 text-[12.5px] text-[var(--dcl-ink-700)]">
                        <CircleAlert
                          className={cn('h-3.5 w-3.5 shrink-0', g.severity === 'error' ? 'text-[#FF3B30]' : 'text-[#B45309]')}
                        />
                        {issue}
                      </span>
                      <span className="font-num text-[12px] font-semibold text-[var(--dcl-ink-900)]">{g.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </motion.section>

      {/* ── Section 5: Dataset version history ───────────────────────── */}
      <motion.section
        id="dataset-versions"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.28 }}
        className="dcl-card scroll-mt-24 rounded-[24px] p-6"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#007AFF]" />
          <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--dcl-ink-900)]">
            Local dataset versions
          </h2>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--dcl-line)]">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead>
              <tr className="bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]">
                {['Version', 'Source', 'File name', 'Imported', 'Rows', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--dcl-line)]">
              <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                <td className="font-num px-3 py-2.5 font-semibold text-[var(--dcl-ink-900)]">v1</td>
                <td className="px-3 py-2.5 text-[var(--dcl-ink-700)]">Sample dataset</td>
                <td className="font-num px-3 py-2.5 text-[var(--dcl-ink-500)]">dcl-dummy-3y.json</td>
                <td className="px-3 py-2.5 text-[var(--dcl-ink-500)]">Preloaded</td>
                <td className="font-num px-3 py-2.5 text-[var(--dcl-ink-700)]">{sampleRows.toLocaleString()}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      isImported ? 'bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]' : 'bg-[#34C759]/10 text-[#1F7A38]',
                    )}
                  >
                    {isImported ? 'Restorable' : 'Active'}
                    <Lock className="h-3 w-3" />
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2">
                    {isImported && (
                      <button
                        type="button"
                        onClick={() => setConfirm('reset')}
                        className="text-[12px] font-semibold text-[#007AFF] hover:underline"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={exportDatasetJson}
                      className="text-[12px] font-semibold text-[#007AFF] hover:underline"
                    >
                      Export JSON
                    </button>
                    <span className="cursor-not-allowed text-[12px] text-[var(--dcl-ink-400)]" title="The sample version cannot be deleted">
                      Delete
                    </span>
                  </div>
                </td>
              </motion.tr>
              {importBatches.map((b, i) => {
                const isActive = isImported && i === importBatches.length - 1;
                return (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.035 * (i + 1) }}
                  >
                    <td className="font-num px-3 py-2.5 font-semibold text-[var(--dcl-ink-900)]">v{i + 2}</td>
                    <td className="px-3 py-2.5 text-[var(--dcl-ink-700)]">Import</td>
                    <td className="font-num max-w-[220px] truncate px-3 py-2.5 text-[var(--dcl-ink-500)]">{b.fileName}</td>
                    <td className="px-3 py-2.5 text-[var(--dcl-ink-500)]">{fmtDate(b.importedAt)}</td>
                    <td className="font-num px-3 py-2.5 text-[var(--dcl-ink-700)]">{b.rowCount.toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <motion.span
                        initial={{ x: -6, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.18 }}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          isActive ? 'bg-[#34C759]/10 text-[#1F7A38]' : 'bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]',
                        )}
                      >
                        {isActive ? 'Active' : 'Restorable'}
                      </motion.span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={exportDatasetJson}
                          className="text-[12px] font-semibold text-[#007AFF] hover:underline"
                        >
                          Export JSON
                        </button>
                        {isActive && undoAvailable ? (
                          <button
                            type="button"
                            onClick={handleUndo}
                            className="text-[12px] font-semibold text-[#B45309] hover:underline"
                          >
                            Undo
                          </button>
                        ) : (
                          <span
                            className="cursor-not-allowed text-[12px] text-[var(--dcl-ink-400)]"
                            title="Only the latest import can be undone, and only right after commit"
                          >
                            Undo
                          </span>
                        )}
                        <span className="cursor-not-allowed text-[12px] text-[var(--dcl-ink-400)]" title="Use Delete imported data below">
                          Delete
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {lastSavedAt && (
          <p className="mt-3 text-[11.5px] text-[var(--dcl-ink-400)]">Last local save: {fmtDate(lastSavedAt)}</p>
        )}
      </motion.section>

      {/* ── Section 6: Danger & recovery zone ────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.24 }}
        className="dcl-card rounded-[24px] border-l-4 border-l-[#FF3B30] p-6"
      >
        <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">
          Recovery options
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-[1.55] text-[var(--dcl-ink-500)]">
          Restore the preloaded sample dataset or remove imported data from this device. These actions do not affect
          any server because no server is used.
        </p>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => setConfirm('reset')}
            className="flex h-10 items-center justify-center gap-2 rounded-full border border-[#FF3B30]/30 bg-[#FF3B30]/5 px-4 text-[13px] font-semibold text-[#B42318] transition-colors hover:bg-[#FF3B30]/15"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to sample data
          </button>
          <button
            type="button"
            onClick={() => setConfirm('delete')}
            disabled={!isImported}
            className="flex h-10 items-center justify-center gap-2 rounded-full border border-[#FF3B30]/30 bg-[#FF3B30]/5 px-4 text-[13px] font-semibold text-[#B42318] transition-colors hover:bg-[#FF3B30]/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Delete imported data
          </button>
          <button
            type="button"
            onClick={exportDatasetJson}
            className="flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--dcl-line)] px-4 text-[13px] font-semibold text-[var(--dcl-ink-700)] transition-colors hover:bg-[var(--dcl-surface-tint)]"
          >
            <Download className="h-4 w-4" />
            Export backup first
          </button>
        </div>
      </motion.section>

      <ConfirmDialog
        open={confirm === 'reset'}
        word="RESET"
        title="Reset to the sample dataset?"
        copy="All imported rows and version history will be removed from this device and the preloaded Jan 2023–Dec 2025 sample data will become active. Consider exporting a backup first."
        onCancel={() => setConfirm(null)}
        onConfirm={handleReset}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        word="DELETE"
        title="Delete imported data from this device?"
        copy="Imported rows are removed from localStorage and the sample dataset becomes active again. This cannot be undone unless you exported a backup."
        onCancel={() => setConfirm(null)}
        onConfirm={handleReset}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--dcl-line)] bg-white px-4 py-2.5 text-[13px] font-medium text-[var(--dcl-ink-900)] shadow-xl md:bottom-10"
            role="status"
          >
            <ShieldCheck className="h-4 w-4 text-[#34C759]" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
