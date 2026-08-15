import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { Metric, SPCPoint } from '@/types/dcl';

/**
 * Mini SPC sparkline for domain cards: measured line, CL, dashed UCL/LCL,
 * optional dotted target, emphasized last point. No legend, no axes labels.
 */
export function SPCMiniChart({
  points,
  accent,
  metric,
  height = 96,
}: {
  points: SPCPoint[];
  accent: string;
  metric: Metric;
  height?: number;
}) {
  // Downsample long weekly series to keep sparklines crisp
  const sampled = useMemo(() => {
    const max = 52;
    if (points.length <= max) return points;
    const step = Math.ceil(points.length / max);
    const out = points.filter((_, i) => i % step === 0);
    const last = points.at(-1);
    if (last && out.at(-1) !== last) out.push(last);
    return out;
  }, [points]);

  const chart = useMemo(
    () => ({
      labels: sampled.map((p) => p.label),
      datasets: [
        {
          data: sampled.map((p) => p.value),
          borderColor: accent,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: sampled.map((p, i) =>
            i === sampled.length - 1 ? 4 : p.signal === 'special-cause' ? 3.5 : 0,
          ),
          pointBackgroundColor: sampled.map((_, i) =>
            i === sampled.length - 1 ? accent : '#FF3B30',
          ),
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 1.5,
        },
        {
          data: sampled.map((p) => p.cl),
          borderColor: 'rgba(71, 85, 105, .75)',
          borderWidth: 1,
          pointRadius: 0,
        },
        {
          data: sampled.map((p) => p.ucl),
          borderColor: 'rgba(100, 116, 139, .55)',
          borderDash: [4, 4],
          borderWidth: 1,
          pointRadius: 0,
        },
        {
          data: sampled.map((p) => p.lcl),
          borderColor: 'rgba(100, 116, 139, .55)',
          borderDash: [4, 4],
          borderWidth: 1,
          pointRadius: 0,
        },
      ],
    }),
    [accent, sampled],
  );

  const target = metric.target ?? undefined;

  return (
    <div style={{ height }} role="img" aria-label={`Mini SPC chart for ${metric.name}`}>
      <Line
        data={chart}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          events: [],
          animation: { duration: 650, easing: 'easeOutCubic' },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            annotation: {
              annotations:
                target !== undefined
                  ? {
                      target: {
                        type: 'line' as const,
                        yMin: target,
                        yMax: target,
                        borderColor: 'rgba(52, 199, 89, .8)',
                        borderDash: [2, 4],
                        borderWidth: 1.5,
                      },
                    }
                  : {},
            },
          },
          scales: {
            x: { display: false },
            y: { display: false },
          },
        }}
      />
    </div>
  );
}
