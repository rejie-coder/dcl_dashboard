import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import type { Metric, SPCPoint } from '@/types/dcl';
import { formatMetricValue } from '@/data/metrics';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
);

/**
 * Full SPC chart (design.md section 6.4): measured series, CL, UCL/LCL,
 * optional target line, special-cause / run-rule point markers, rich tooltip.
 */
export function SPCChart({
  title,
  points,
  accent,
  metric,
}: {
  title: string;
  points: SPCPoint[];
  accent: string;
  metric: Metric;
}) {
  const formatValue = (v: number) => formatMetricValue(metric, v);

  const chart = useMemo(() => {
    const labels = points.map((p) => p.label);
    return {
      labels,
      datasets: [
        {
          label: title,
          data: points.map((p) => p.value),
          borderColor: accent,
          backgroundColor: accent,
          borderWidth: 2.5,
          tension: 0.28,
          pointRadius: points.map((p) => (p.signal ? 5 : 2.5)),
          pointHoverRadius: 7,
          pointBackgroundColor: points.map((p) =>
            p.signal === 'special-cause' ? '#FF3B30' : p.signal === 'run-rule' ? '#FFCC00' : '#FFFFFF',
          ),
          pointBorderColor: points.map((p) => (p.signal ? '#FFFFFF' : accent)),
          pointBorderWidth: points.map((p) => (p.signal ? 2 : 1.5)),
        },
        {
          label: 'Center line',
          data: points.map((p) => p.cl),
          borderColor: 'rgba(71, 85, 105, .85)',
          borderWidth: 1.5,
          pointRadius: 0,
        },
        {
          label: 'UCL',
          data: points.map((p) => p.ucl),
          borderColor: 'rgba(100, 116, 139, .7)',
          borderDash: [7, 6],
          borderWidth: 1.5,
          pointRadius: 0,
        },
        {
          label: 'LCL',
          data: points.map((p) => p.lcl),
          borderColor: 'rgba(100, 116, 139, .7)',
          borderDash: [7, 6],
          borderWidth: 1.5,
          pointRadius: 0,
        },
      ],
    };
  }, [accent, points, title]);

  const latest = points.at(-1);
  const target = metric.target ?? undefined;
  // Fallback format without unit suffix for tooltip density
  const fmtPlain = (v: number) =>
    v.toLocaleString('en-US', { minimumFractionDigits: metric.precision, maximumFractionDigits: metric.precision });

  return (
    <Line
      data={chart}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 420, easing: 'easeOutCubic' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, color: '#6B7280', font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, .94)',
            padding: 12,
            titleFont: { family: "'IBM Plex Mono', monospace", size: 11 },
            bodyFont: { family: "'IBM Plex Mono', monospace", size: 11 },
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatValue(Number(ctx.raw))}`,
              afterBody: (items) => {
                const p = points[items[0]?.dataIndex ?? 0];
                if (!p) return [];
                const lines = [
                  `CL ${fmtPlain(p.cl)} · UCL ${fmtPlain(p.ucl)} · LCL ${fmtPlain(p.lcl)}`,
                  p.signal ? `Signal: ${p.signal} (${p.rules.join(', ')})` : 'Signal: none',
                ];
                if (p.numerator != null && p.denominator != null) {
                  lines.push(`n/d: ${p.numerator.toLocaleString()} / ${p.denominator.toLocaleString()}`);
                }
                return lines;
              },
            },
          },
          annotation: {
            annotations: {
              ...(target !== undefined
                ? {
                    target: {
                      type: 'line' as const,
                      yMin: target,
                      yMax: target,
                      borderColor: '#34C759',
                      borderDash: [3, 5],
                      borderWidth: 2,
                      label: {
                        display: true,
                        content: `Target ${formatValue(target)}`,
                        position: 'end' as const,
                        backgroundColor: 'rgba(52,199,89,.92)',
                        font: { size: 10 },
                      },
                    },
                  }
                : {}),
              ...(latest?.signal
                ? {
                    latestSignal: {
                      type: 'label' as const,
                      xValue: points.length - 1,
                      yValue: latest.value,
                      content: [latest.signal === 'special-cause' ? 'Special cause' : 'Run rule'],
                      color: '#fff',
                      backgroundColor: latest.signal === 'special-cause' ? '#FF3B30' : '#B45309',
                      borderRadius: 8,
                      padding: 6,
                      font: { size: 10 },
                    },
                  }
                : {}),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 8, color: '#6B7280', font: { family: "'IBM Plex Mono', monospace", size: 11 } },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, .18)' },
            ticks: {
              color: '#6B7280',
              font: { family: "'IBM Plex Mono', monospace", size: 11 },
              callback: (v) => fmtPlain(Number(v)),
            },
          },
        },
      }}
    />
  );
}
