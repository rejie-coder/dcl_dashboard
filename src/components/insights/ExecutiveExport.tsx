import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Download, FileJson } from 'lucide-react';
import { DOMAINS } from '@/data/domains';
import { unitName } from '@/data/units';
import { formatMetricValue } from '@/data/metrics';
import { downloadBlob, downloadCsv } from '@/lib/excel/to-csv';
import type { DomainScore } from '@/types/dcl';
import type { AlertItem } from './alert-model';
import { useInsightsStore } from './action-store';

const STATUS_LABEL: Record<string, string> = { open: 'Open', 'in-progress': 'In progress', done: 'Done' };

/**
 * Executive report export (insights.md section 7): option toggles, live
 * preview paragraph, CSV bundle / JSON report / copy text summary.
 */
export function ExecutiveExport({
  alerts,
  domainScores,
  unitId,
}: {
  alerts: AlertItem[];
  domainScores: DomainScore[];
  unitId: string;
}) {
  const actions = useInsightsStore((s) => s.actions);
  const acknowledged = useInsightsStore((s) => s.acknowledged);
  const [options, setOptions] = useState({ scores: true, alerts: true, actions: true, methodology: false });
  const [copied, setCopied] = useState(false);

  const toggle = (key: keyof typeof options) => setOptions((o) => ({ ...o, [key]: !o[key] }));

  const summary = useMemo(() => {
    const needing = domainScores.filter((d) => d.status === 'action-needed' || d.status === 'watch');
    const parts: string[] = [];
    if (options.scores) {
      const names = needing.map((d) => DOMAINS.find((x) => x.id === d.domainId)?.name ?? d.domainId);
      parts.push(
        needing.length === 0
          ? 'Hospital performance is stable overall, with no domains showing special-cause or watch signals.'
          : `Hospital performance is stable overall, with ${names.join(' and ')} requiring review.`,
      );
    }
    if (options.alerts) {
      const special = alerts.filter((a) => a.kind === 'special-cause');
      const favorable = alerts.filter((a) => a.favorable);
      if (alerts.length > 0) {
        parts.push(
          `${alerts.length} active SPC signal${alerts.length === 1 ? '' : 's'} (${special.length} special cause${
            special.length === 1 ? '' : 's'
          }) are under review for ${unitName(unitId)}.${favorable.length > 0 ? ` ${favorable.length} favorable improvement${favorable.length === 1 ? ' is' : 's are'} worth sustaining.` : ''}`,
        );
        const top = alerts[0];
        if (top) parts.push(`Top priority: ${top.headline} (${top.detail}).`);
      } else {
        parts.push('No active SPC signals under the current filters.');
      }
    }
    if (options.actions) {
      const open = actions.filter((a) => a.status !== 'done');
      parts.push(
        open.length === 0
          ? 'No open improvement actions are being tracked.'
          : `${open.length} improvement action${open.length === 1 ? '' : 's'} open, ${actions.filter((a) => a.status === 'done').length} completed.`,
      );
    }
    if (options.methodology) {
      parts.push(
        'Methodology: p/u/i-chart SPC with limits from the first 20 baseline periods; signals follow the four standard rules (beyond limits, shift, trend, near-limit zone).',
      );
    }
    return parts.join(' ');
  }, [options, domainScores, alerts, actions, unitId]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  const downloadCsvBundle = () => {
    downloadCsv(
      ['metric', 'domain', 'unit', 'signal', 'period', 'value', 'CL', 'UCL', 'LCL', 'favorable', 'reviewed'],
      alerts.map((a) => [
        a.metric.name,
        a.domainName,
        a.unitLabel,
        a.kind,
        a.periodLabel,
        a.point ? formatMetricValue(a.metric, a.point.value) : '',
        a.point ? a.point.cl.toFixed(a.metric.precision) : '',
        a.point ? a.point.ucl.toFixed(a.metric.precision) : '',
        a.point ? a.point.lcl.toFixed(a.metric.precision) : '',
        a.favorable ? 'yes' : 'no',
        acknowledged[a.id] ? 'yes' : 'no',
      ]),
      'dcl-alert-register.csv',
    );
    if (options.actions && actions.length > 0) {
      downloadCsv(
        ['action', 'metric', 'owner', 'dueDate', 'status', 'updated'],
        actions.map((a) => [a.title, a.metricName, a.owner, a.dueDate, STATUS_LABEL[a.status], a.updatedAt.slice(0, 10)]),
        'dcl-action-register.csv',
      );
    }
  };

  const downloadJson = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      filters: { unitId },
      summary,
      ...(options.scores ? { domainScores } : {}),
      ...(options.alerts ? { alerts } : {}),
      ...(options.actions ? { actions } : {}),
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `dcl-executive-brief-${new Date().toISOString().slice(0, 10)}.json`,
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.24 }}
      className="dcl-card grid grid-cols-1 gap-6 rounded-[24px] p-6 lg:grid-cols-2"
    >
      <div>
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--dcl-ink-900)]">
          Export executive brief
        </h2>
        <p className="mt-1 text-[13px] text-[var(--dcl-ink-500)]">
          A compact report package built from the current filters.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {(
            [
              ['scores', 'Include overview scores'],
              ['alerts', 'Include active alerts'],
              ['actions', 'Include action tracker'],
              ['methodology', 'Include methodology note'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-[var(--dcl-ink-700)]">
              <input
                type="checkbox"
                checked={options[key]}
                onChange={() => toggle(key)}
                className="h-4 w-4 accent-[#007AFF] transition-transform duration-150"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={downloadCsvBundle}
            className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#007AFF] px-4 text-[12.5px] font-semibold text-white hover:bg-[#0066D6]"
          >
            <Download className="h-3.5 w-3.5" /> Download CSV bundle
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={downloadJson}
            className="flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--dcl-line)] px-4 text-[12.5px] font-semibold text-[var(--dcl-ink-700)] hover:bg-[var(--dcl-surface-tint)]"
          >
            <FileJson className="h-3.5 w-3.5" /> Download JSON report
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={copySummary}
            className="flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--dcl-line)] px-4 text-[12.5px] font-semibold text-[var(--dcl-ink-700)] hover:bg-[var(--dcl-surface-tint)]"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#34C759]" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy text summary'}
          </motion.button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dcl-ink-400)]">Preview</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={summary}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="mt-2 text-[13.5px] leading-[1.65] text-[var(--dcl-ink-700)]"
          >
            {summary}
          </motion.p>
        </AnimatePresence>
        <p className="mt-4 text-[11px] text-[var(--dcl-ink-400)]">
          Generated locally from the active dataset · {unitName(unitId)} · offline ready.
        </p>
      </div>
    </motion.section>
  );
}
