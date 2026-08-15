import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { motion } from 'framer-motion';
import { Activity, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Domain, SPCPoint } from '@/types/dcl';
import { METRIC_MAP } from '@/data/metrics';
import { useDataset } from '@/hooks/useDataset';
import { usePersistentFilters } from '@/hooks/usePersistentFilters';
import { computeSPC } from '@/hooks/useSPC';
import { ActionNoteList, type ActionNote } from '@/components/domain/ActionNoteList';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

/**
 * Clinical Correlation Insight Rail (clinical-outcome.md section 4):
 * narrative card, paired-metric comparison (Avg Length of Stay vs Bed
 * Occupancy Rate), and a local action tracker.
 */

const SEED_ACTIONS: ActionNote[] = [
  {
    id: 'seed-ssi',
    text: 'Review SSI cluster in Surgical',
    owner: 'Infection Control',
    due: 'Jan 15',
    status: 'open',
    createdAt: '2024-12-20T09:00:00.000Z',
  },
  {
    id: 'seed-coding',
    text: 'Audit readmission coding',
    owner: 'Quality',
    due: 'Jan 22',
    status: 'in-progress',
    createdAt: '2024-12-21T09:00:00.000Z',
  },
];

function buildNarrative(seriesByMetric: Record<string, SPCPoint[]>): { text: string; metricId: string | null } {
  const special = Object.entries(seriesByMetric).find(([, pts]) => pts.at(-1)?.signal === 'special-cause');
  if (special) {
    const metric = METRIC_MAP[special[0]];
    const p = special[1].at(-1)!;
    const side = p.value > p.ucl ? 'upper' : 'lower';
    return {
      text: `${metric?.name ?? 'A metric'} crossed its ${side} control limit in ${p.label}. Review the cluster and confirm case mix before changing the clinical target.`,
      metricId: special[0],
    };
  }
  const los = seriesByMetric['avg-length-of-stay'] ?? [];
  const losLatest = los.at(-1);
  if (losLatest && losLatest.value > losLatest.cl) {
    return {
      text: 'Length of Stay is running above its center line while occupancy remains high. Review discharge planning before changing the clinical target.',
      metricId: 'avg-length-of-stay',
    };
  }
  const runRule = Object.entries(seriesByMetric).find(([, pts]) => pts.at(-1)?.signal === 'run-rule');
  if (runRule) {
    return {
      text: `${METRIC_MAP[runRule[0]]?.name ?? 'A metric'} shows a run-rule pattern. Watch the next periods before escalating.`,
      metricId: runRule[0],
    };
  }
  return {
    text: 'All clinical KPIs — mortality, daily deaths, readmission, stay length, SSI and the surgical volume lines — are within expected variation for the selected filters.',
    metricId: null,
  };
}

export function ClinicalInsightRail({
  domain,
  seriesByMetric,
  onJumpToChart,
}: {
  domain: Domain;
  seriesByMetric: Record<string, SPCPoint[]>;
  onJumpToChart: (metricId: string) => void;
}) {
  const { dataset } = useDataset();
  const { timeScale, unitId } = usePersistentFilters();
  const [showLos, setShowLos] = useState(true);
  const [showOccupancy, setShowOccupancy] = useState(true);

  const narrative = useMemo(() => buildNarrative(seriesByMetric), [seriesByMetric]);

  const losPoints = seriesByMetric['avg-length-of-stay'] ?? [];
  const occupancyPoints = useMemo(
    () => computeSPC(dataset, 'bed-occupancy-rate', unitId, timeScale),
    [dataset, unitId, timeScale],
  );

  const paired = useMemo(() => {
    const length = Math.min(losPoints.length, occupancyPoints.length);
    const labels = losPoints.slice(-length).map((p) => p.label);
    return {
      labels,
      datasets: [
        {
          label: 'Avg Length of Stay (days)',
          data: losPoints.slice(-length).map((p) => p.value),
          borderColor: domain.color,
          backgroundColor: domain.color,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'y',
          hidden: !showLos,
        },
        {
          label: 'Bed Occupancy Rate (%)',
          data: occupancyPoints.slice(-length).map((p) => p.value),
          borderColor: '#FF9F0A',
          backgroundColor: '#FF9F0A',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'y1',
          hidden: !showOccupancy,
        },
      ],
    };
  }, [losPoints, occupancyPoints, domain.color, showLos, showOccupancy]);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
      aria-label="Clinical signals"
    >
      <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">
        Clinical signals
      </h2>

      {/* Narrative card */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.2 }}
        className="dcl-card rounded-2xl p-4"
      >
        <div className="flex items-start gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: domain.colorSoft, color: domain.color }}
          >
            <Activity className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium leading-relaxed text-[var(--dcl-ink-700)]">{narrative.text}</p>
            {narrative.metricId && (
              <button
                type="button"
                onClick={() => onJumpToChart(narrative.metricId!)}
                className="mt-2 flex items-center gap-1 text-[12px] font-semibold"
                style={{ color: domain.color }}
              >
                View {METRIC_MAP[narrative.metricId]?.shortName ?? 'chart'}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </motion.section>

      {/* Paired comparison */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.25 }}
        className="dcl-card rounded-2xl p-4"
      >
        <h3 className="text-[12.5px] font-semibold text-[var(--dcl-ink-900)]">
          Average Length of Stay vs Bed Occupancy Rate
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            { label: 'Stay length', on: showLos, toggle: () => setShowLos((v) => !v), color: domain.color },
            { label: 'Occupancy', on: showOccupancy, toggle: () => setShowOccupancy((v) => !v), color: '#FF9F0A' },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.toggle}
              aria-pressed={s.on}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-opacity duration-150',
                s.on ? 'border-[var(--dcl-line)] bg-white text-[var(--dcl-ink-700)]' : 'border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] text-[var(--dcl-ink-400)] opacity-60',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-3 h-[180px]">
          {paired.labels.length > 0 ? (
            <Line
              data={paired}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                animation: { duration: 300, easing: 'easeOutCubic' },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, .94)',
                    padding: 10,
                    bodyFont: { family: "'IBM Plex Mono', monospace", size: 11 },
                  },
                },
                scales: {
                  x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: '#9CA3AF', font: { size: 10, family: "'IBM Plex Mono', monospace" } } },
                  y: {
                    position: 'left',
                    grid: { color: 'rgba(148, 163, 184, .18)' },
                    ticks: { color: domain.color, font: { size: 10, family: "'IBM Plex Mono', monospace" } },
                    title: { display: true, text: 'days', color: '#9CA3AF', font: { size: 10 } },
                  },
                  y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#FF9F0A', font: { size: 10, family: "'IBM Plex Mono', monospace" } },
                    title: { display: true, text: '%', color: '#9CA3AF', font: { size: 10 } },
                  },
                },
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl bg-[var(--dcl-surface-tint)] text-[12px] text-[var(--dcl-ink-400)]">
              No paired data for this selection
            </div>
          )}
        </div>
      </motion.section>

      {/* Action tracker */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.3 }}
        className="dcl-card rounded-2xl p-4"
      >
        <h3 className="mb-2.5 text-[12.5px] font-semibold text-[var(--dcl-ink-900)]">Action tracker</h3>
        <ActionNoteList storageKey="dcl-actions-clinical-outcome" seed={SEED_ACTIONS} addLabel="Add note" />
      </motion.section>
    </motion.aside>
  );
}
