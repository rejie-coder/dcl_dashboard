import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SPC rule guide (insights.md section 6): four rule cards with inline SVG
 * mini-chart illustrations, plain-language explanations, expandable
 * formula/example, and copy-for-report. Copy per design.md §8 + §14.
 */

interface Rule {
  id: string;
  title: string;
  short: string;
  detail: string;
  formula: string;
  example: string;
}

const RULES: Rule[] = [
  {
    id: 'beyond-limits',
    title: 'Beyond a control limit',
    short: 'One point outside UCL or LCL.',
    detail:
      'A single point beyond a control limit has a very small probability under routine variation. Treat it as a special cause: something specific happened in that period.',
    formula: 'Signal when value > UCL or value < LCL, with limits at CL ± 3σ (p/u charts use denominator-varying limits).',
    example: 'Fall rate jumps to 4.1 per 1,000 patient days against a UCL of 3.8 — investigate that week specifically.',
  },
  {
    id: 'shift',
    title: 'Shift',
    short: 'Eight consecutive points on one side of CL.',
    detail:
      'Eight points in a row above or below the center line mean the process average has moved. The change is sustained, not a spike — it will persist until the process changes again.',
    formula: 'Signal when 8 consecutive values are all above or all below the center line.',
    example: 'Occupancy runs above its 81% center line for eight straight months after a bed-base reconfiguration.',
  },
  {
    id: 'trend',
    title: 'Trend',
    short: 'Six consecutive points moving in one direction.',
    detail:
      'Six steadily increasing or decreasing points indicate drift. Trends compound quietly; they are easiest to reverse while still small.',
    formula: 'Signal when 6 consecutive values each move strictly in the same direction.',
    example: 'OPD wait time climbs 24 → 26 → 27 → 29 → 31 → 33 minutes over six months.',
  },
  {
    id: 'zone-2sigma',
    title: 'Near-limit pattern',
    short: 'Two of three points beyond the same 2σ zone.',
    detail:
      'Repeated points near (but not beyond) the same control limit show the process is operating at the edge of its normal range and may cross it soon.',
    formula: 'Signal when 2 of 3 consecutive values fall beyond CL + 2σ (or CL − 2σ) on the same side.',
    example: 'Two of the last three stock-out readings sit in the upper 2σ zone — review supply levels before a breach.',
  },
];

/** Inline SVG illustration per rule: series line, CL, dashed limits, highlighted signal points. */
function RuleIllustration({ rule, index }: { rule: Rule; index: number }) {
  const w = 220;
  const h = 72;
  const clY = 38;
  const uclY = 12;
  const lclY = 64;
  const n = 12;
  const xs = Array.from({ length: n }, (_, i) => 12 + (i * (w - 24)) / (n - 1));

  // deterministic pseudo-series per rule
  const base = [0, 3, -2, 2, -3, 1, 4, -1, 2, -2, 3, 0];
  const vals = xs.map((_, i) => {
    let v = clY + base[i] * 1.4;
    if (rule.id === 'beyond-limits' && i === 9) v = uclY - 8;
    if (rule.id === 'shift' && i >= 4) v = clY - 8 - (i % 3);
    if (rule.id === 'trend' && i >= 6) v = clY + 6 - (i - 5) * 5;
    if (rule.id === 'zone-2sigma' && i >= 9 && i <= 11 && i !== 10) v = clY - 18;
    return Math.max(4, Math.min(h - 4, v));
  });
  const flagged = xs.map((_, i) => {
    if (rule.id === 'beyond-limits') return i === 9;
    if (rule.id === 'shift') return i >= 4;
    if (rule.id === 'trend') return i >= 6;
    return i >= 9 && i !== 10;
  });

  const path = vals.map((y, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${y.toFixed(1)}`).join(' ');
  const accent = rule.id === 'beyond-limits' ? '#FF3B30' : '#B45309';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[72px] w-full" role="img" aria-label={`Illustration of the ${rule.title} rule`}>
      <line x1="8" x2={w - 8} y1={uclY} y2={uclY} stroke="rgba(100,116,139,.6)" strokeDasharray="5 4" strokeWidth="1.2" />
      <line x1="8" x2={w - 8} y1={lclY} y2={lclY} stroke="rgba(100,116,139,.6)" strokeDasharray="5 4" strokeWidth="1.2" />
      <line x1="8" x2={w - 8} y1={clY} y2={clY} stroke="rgba(71,85,105,.8)" strokeWidth="1.2" />
      <motion.path
        d={path}
        fill="none"
        stroke="#007AFF"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, delay: index * 0.06, ease: 'easeOut' }}
      />
      {xs.map((x, i) =>
        flagged[i] ? (
          <circle key={i} cx={x} cy={vals[i]} r="3.5" fill={accent} stroke="#fff" strokeWidth="1.4" />
        ) : (
          <circle key={i} cx={x} cy={vals[i]} r="2" fill="#fff" stroke="#007AFF" strokeWidth="1.2" />
        ),
      )}
    </svg>
  );
}

function RuleCard({ rule, index }: { rule: Rule; index: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${rule.title}: ${rule.short} ${rule.detail}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.24, delay: index * 0.06 }}
      className="flex flex-col rounded-2xl border border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] p-4"
    >
      <RuleIllustration rule={rule} index={index} />
      <h3 className="font-display mt-3 text-[14.5px] font-semibold text-[var(--dcl-ink-900)]">{rule.title}</h3>
      <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--dcl-ink-700)]">{rule.short}</p>

      <div className="mt-auto flex items-center justify-between pt-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1 text-[12px] font-semibold text-[#007AFF] hover:underline"
        >
          Formula & example
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}>
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
        </button>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy explanation of ${rule.title}`}
          className="flex items-center gap-1 text-[11.5px] font-medium text-[var(--dcl-ink-500)] hover:text-[var(--dcl-ink-900)]"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#34C759]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <p className="mt-2 text-[12px] leading-[1.55] text-[var(--dcl-ink-700)]">{rule.detail}</p>
            <p className={cn('font-num mt-2 rounded-lg bg-white p-2 text-[11px] leading-[1.5] text-[var(--dcl-ink-500)]')}>
              {rule.formula}
            </p>
            <p className="mt-2 text-[11.5px] italic leading-[1.5] text-[var(--dcl-ink-500)]">{rule.example}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SPCRuleGuide() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.28 }}
      className="dcl-card rounded-[24px] p-6"
    >
      <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--dcl-ink-900)]">
        Why a signal matters
      </h2>
      <p className="mt-1 max-w-2xl text-[13px] leading-[1.55] text-[var(--dcl-ink-500)]">
        Control limits separate common-cause variation from changes worth investigating. Targets describe aspiration;
        control limits describe process behavior.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {RULES.map((rule, i) => (
          <RuleCard key={rule.id} rule={rule} index={i} />
        ))}
      </div>

      <p className="mt-4 rounded-xl bg-[var(--dcl-surface-tint)] p-3 text-[12px] leading-[1.55] text-[var(--dcl-ink-500)]">
        SPC signals are prompts for learning, not automatic proof of poor performance. Control limits show expected
        variation. A point outside the limits needs investigation—not blame.
      </p>
    </motion.section>
  );
}
