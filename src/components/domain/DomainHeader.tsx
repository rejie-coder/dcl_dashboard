import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Check, ChevronRight, Copy, Download, MoreHorizontal, ScrollText, TrendingDown, TrendingUp } from 'lucide-react';
import type { Domain, DomainScore, SPCPoint, TimeScale } from '@/types/dcl';
import { unitName } from '@/data/units';
import { cn } from '@/lib/utils';
import {
  DOMAIN_STATUS_STYLE,
  GRAIN_LABEL,
  buildBoardSummary,
  copyToClipboard,
  exportDomainCSV,
} from './domain-shared';

/** easeOutExpo count-up for the composite score. */
function useCountUp(target: number, duration = 750): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t);
      setValue(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

/** Score progress ring drawn over ~750ms (generic; doubles as gauge visual). */
export function ScoreRing({ score, accent, size = 72 }: { score: number; accent: string; size?: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const shown = Math.min(Math.max(score, 0), 100) / 100;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="-rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--dcl-line)" strokeWidth="6" />
      <motion.circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - shown) }}
        transition={{ duration: 0.75, ease: 'easeOut' }}
      />
    </svg>
  );
}

/**
 * Domain page header (per-domain design section 1): breadcrumb, gradient icon
 * well, title, subtitle, dynamic interpretation, active filter chips, and the
 * composite score card with delta + status. Export copies/downloads are local.
 */
export function DomainHeader({
  domain,
  score,
  interpretation,
  grain,
  unitId,
  periodsCount,
  seriesByMetric,
  icon,
  exportLabel,
  onOpenMethodology,
}: {
  domain: Domain;
  score: DomainScore;
  interpretation: string;
  grain: TimeScale;
  unitId: string;
  periodsCount: number;
  seriesByMetric: Record<string, SPCPoint[]>;
  icon: ReactNode;
  exportLabel: string;
  onOpenMethodology?: () => void;
}) {
  const status = DOMAIN_STATUS_STYLE[score.status];
  const displayScore = useCountUp(score.score);
  const deltaPositive = score.delta >= 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const copySummary = async () => {
    const ok = await copyToClipboard(buildBoardSummary(domain, score, seriesByMetric));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
    setMenuOpen(false);
  };

  const chips = [GRAIN_LABEL[grain] ?? grain, unitName(unitId), `${periodsCount} periods`];

  return (
    <motion.header
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-1 gap-5 lg:grid-cols-12"
    >
      {/* Left: breadcrumb + title */}
      <div className="lg:col-span-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--dcl-ink-500)]">
          <Link to="/" className="transition hover:text-[var(--dcl-ink-900)]">
            Overview
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className="text-[var(--dcl-ink-900)]">{domain.name}</span>
        </nav>

        <div className="mt-3 flex items-start gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ background: `linear-gradient(135deg, ${domain.color}, ${domain.gradientTo})` }}
          >
            {icon}
          </motion.div>
          <div className="min-w-0">
            <h1 className="font-display text-[30px] font-bold leading-[1.12] tracking-[-0.035em] text-[var(--dcl-ink-900)] md:text-[34px]">
              {domain.name}
            </h1>
            <p className="mt-1 text-[14px] text-[var(--dcl-ink-500)]">{domain.outcomeSentence}.</p>
            <p className="mt-1.5 max-w-[64ch] text-[13px] leading-relaxed text-[var(--dcl-ink-700)]">{interpretation}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {chips.map((chip) => (
                <motion.span
                  key={chip}
                  layout="position"
                  transition={{ duration: 0.2 }}
                  className="rounded-full border border-[var(--dcl-line)] bg-[var(--dcl-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dcl-ink-500)]"
                >
                  {chip}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: composite score card */}
      <div className="lg:col-span-4">
        <div className="dcl-card flex items-center gap-4 rounded-[24px] p-5">
          <div className="relative shrink-0">
            <ScoreRing score={score.score} accent={domain.color} />
            <span className="font-num absolute inset-0 flex items-center justify-center text-[18px] font-semibold text-[var(--dcl-ink-900)]">
              {displayScore}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--dcl-ink-400)]">
              Domain composite
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  deltaPositive ? 'bg-[#34C759]/12 text-[#1F7A38]' : 'bg-[#FF3B30]/10 text-[#B42318]',
                )}
              >
                {deltaPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {deltaPositive ? '+' : ''}
                {score.delta.toFixed(1)} pts
              </span>
              <span className="text-[10.5px] font-medium text-[var(--dcl-ink-400)]">vs prior period</span>
            </div>
            <span className={cn('mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1', status.className)}>
              {status.label}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportDomainCSV(domain, unitId, seriesByMetric)}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: domain.color }}
          >
            <Download className="h-3.5 w-3.5" /> {exportLabel}
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="More actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--dcl-line)] bg-[var(--dcl-surface)] text-[var(--dcl-ink-500)] transition hover:text-[var(--dcl-ink-900)]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-10 z-30 w-48 overflow-hidden rounded-xl border border-[var(--dcl-line)] bg-[var(--dcl-surface-raised)] py-1 shadow-lg">
                <button
                  type="button"
                  onClick={copySummary}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-[var(--dcl-ink-700)] transition hover:bg-[var(--dcl-surface-tint)]"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-[#1F7A38]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy summary'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenMethodology?.();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-[var(--dcl-ink-700)] transition hover:bg-[var(--dcl-surface-tint)]"
                >
                  <ScrollText className="h-3.5 w-3.5" /> Open methodology
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
