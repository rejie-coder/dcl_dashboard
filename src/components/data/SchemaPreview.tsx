import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CURRENCY_FIELDS,
  DERIVED_INDICATORS,
  FIELD_GROUPS,
  REQUIRED_FIELDS,
} from '@/lib/schema/import.schema';

const DOMAIN_LABELS: Record<string, string> = {
  'clinical-outcome': '1. Clinical Outcome',
  'patient-safety': '2. Patient Safety',
  'financial-efficiency': '3. Financial Efficiency (LKR)',
  'operational-efficiency': '4. Operational Efficiency',
  'hr-development': '5. HR Development',
};

const SCHEMA_JSON = JSON.stringify(
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'DCL raw data-entry row (one unit × one week or month)',
    type: 'object',
    required: ['unitId', 'grain', 'daysInPeriod', 'periodStart/month', 'at least one data field'],
    properties: {
      unitId: { type: 'string', enum: ['ed', 'icu', 'medical', 'surgical', 'maternity', 'outpatient'], description: '"all" is derived automatically — never entered' },
      grain: { enum: ['week', 'month'] },
      month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Calendar month; period bounds are derived from it when dates are blank' },
      periodStart: { type: 'string', format: 'date' },
      periodEnd: { type: 'string', format: 'date' },
      daysInPeriod: { type: 'integer', minimum: 1, maximum: 31 },
      dataFields: {
        type: 'object',
        description: '54 optional numeric fields (all ≥ 0), grouped by section. Monetary fields are LKR.',
        currencyFields: CURRENCY_FIELDS,
      },
    },
  },
  null,
  2,
);

/**
 * Schema preview card (data.md section 2, right 5 columns): the raw-row
 * field groups with required/optional chips, an expandable field table,
 * the list of auto-calculated indicators, and copy-schema-to-clipboard.
 */
export function SchemaPreview() {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copySchema = async () => {
    try {
      await navigator.clipboard.writeText(SCHEMA_JSON);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable (e.g. insecure context) — ignore
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.28, delay: 0.08 }}
      className="dcl-card flex flex-col rounded-[24px] p-6 lg:col-span-5"
    >
      <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">
        What you enter
      </h2>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--dcl-ink-500)]">
        One row per unit per week or month. Only the identity columns are required — every data column is
        optional. All amounts are in Sri Lankan Rupees (LKR).
      </p>

      <div className="mt-3 flex flex-col gap-2.5">
        {FIELD_GROUPS.map((g) => (
          <div key={g.group}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-400)]">
              {g.label}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {g.fields.map((f) => (
                <motion.span
                  key={f.field}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.16 }}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11.5px]',
                    f.required || REQUIRED_FIELDS.includes(f.field)
                      ? 'border-[#007AFF]/30 bg-[#EAF3FF] font-semibold text-[#0057B8]'
                      : 'border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]',
                  )}
                  title={f.rules}
                >
                  {f.header}
                  {f.required ? '' : ''}
                </motion.span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--dcl-ink-400)]">
          The dashboard calculates these for you
        </p>
        <div className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
          {Object.entries(DOMAIN_LABELS).map(([domainId, label]) => (
            <div key={domainId}>
              <p className="text-[11.5px] font-semibold text-[var(--dcl-ink-700)]">{label}</p>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {DERIVED_INDICATORS.filter((d) => d.domainId === domainId).map((d) => (
                  <li key={d.metricId} className="text-[11.5px] leading-[1.45] text-[var(--dcl-ink-500)]">
                    <span className="font-medium text-[var(--dcl-ink-900)]">{d.name}</span>
                    {' = '}
                    <span className="font-num">{d.formula}</span>
                    {d.unitLabel === 'LKR' ? ' (LKR)' : d.unitLabel !== '%' && d.unitLabel !== '1' ? ` (${d.unitLabel})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="mt-4 flex items-center gap-1.5 text-left text-[13px] font-semibold text-[#007AFF] hover:underline"
      >
        View full field reference
        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.22 }}>
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-[var(--dcl-line)]">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0">
                  <tr className="bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-500)]">
                    <th className="px-3 py-2 font-semibold">Column</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Required</th>
                    <th className="px-3 py-2 font-semibold">Example</th>
                    <th className="px-3 py-2 font-semibold">Validation rules</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--dcl-line)]">
                  {FIELD_GROUPS.flatMap((g) =>
                    g.fields.map((f, i) => (
                      <motion.tr
                        key={f.field}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.18, delay: Math.min(i, 24) * 0.02 }}
                      >
                        <td className="px-3 py-2 font-semibold text-[var(--dcl-ink-900)]">
                          {f.header}
                          <span className="font-num block text-[10.5px] font-normal text-[var(--dcl-ink-400)]">{f.field}</span>
                        </td>
                        <td className="font-num px-3 py-2 text-[var(--dcl-ink-500)]">
                          {f.type === 'currency' ? 'number (LKR)' : f.type}
                        </td>
                        <td className="px-3 py-2">
                          {f.required ? (
                            <span className="font-semibold text-[#B42318]">Yes</span>
                          ) : (
                            <span className="text-[var(--dcl-ink-400)]">No</span>
                          )}
                        </td>
                        <td className="font-num px-3 py-2 text-[var(--dcl-ink-700)]">{f.example}</td>
                        <td className="px-3 py-2 text-[var(--dcl-ink-500)]">{f.rules}</td>
                      </motion.tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto pt-4">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={copySchema}
          className="flex h-9 items-center gap-2 rounded-full border border-[var(--dcl-line)] px-3.5 text-[12.5px] font-medium text-[var(--dcl-ink-700)] transition-colors hover:bg-[var(--dcl-surface-tint)]"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#34C759]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Schema copied' : 'Copy JSON Schema'}
        </motion.button>
      </div>
    </motion.div>
  );
}
