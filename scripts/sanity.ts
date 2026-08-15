/**
 * One-off sanity check: build the sample dataset and print derived monthly
 * values for key indicators (unit 'medical'), plus spot checks on pooling
 * and rollups. Run: see scripts/run-sanity.sh or the npm-less esbuild pipe.
 */
import { generateDummyDataset } from '@/data/dummy-generator';
import { aggregateObservations } from '@/lib/spc/aggregate';
import { METRIC_MAP } from '@/data/metrics';
import { deriveObservations } from '@/lib/indicators/derive';

const ds = generateDummyDataset();
console.log(`hospital: ${ds.hospital.name} (${ds.hospital.currency})`);
console.log(`rawRows: ${ds.rawRows.length}, observations: ${ds.observations.length}, metrics: ${ds.metrics.length}`);
const units = new Set(ds.rawRows.map((r) => r.unitId));
console.log(`raw-row units: ${[...units].join(', ')} (note: no 'all' rows — pooled at derive time)`);

function monthly(metricId: string, unitId: string) {
  const rows = ds.observations.filter((o) => o.metricId === metricId && o.unitId === unitId);
  return aggregateObservations(rows, 'month', METRIC_MAP[metricId]);
}

function stats(metricId: string, unitId: string) {
  const periods = monthly(metricId, unitId);
  const values = periods.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return { n: values.length, min, max, mean, last3: values.slice(-3) };
}

const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 });

for (const metricId of ['mortality-rate', 'cost-per-patient-day', 'bed-occupancy-rate', 'staff-turnover-rate']) {
  const s = stats(metricId, 'medical');
  console.log(
    `\n[medical] ${metricId}: ${s.n} months | min ${fmt(s.min)} | mean ${fmt(s.mean)} | max ${fmt(s.max)}`,
  );
  console.log(`  last 3 months: ${s.last3.map(fmt).join(', ')}`);
}

// yearly rollups for a sum-rollup volume metric (weekly amounts must SUM to months/years)
for (const metricId of ['surgeries-major', 'electricity-bill', 'local-purchase-expenditure']) {
  const rows = ds.observations.filter((o) => o.metricId === metricId && o.unitId === 'surgical');
  const yearly = aggregateObservations(rows, 'year', METRIC_MAP[metricId]);
  console.log(`\n[surgical] ${metricId} yearly: ${yearly.map((p) => `${p.periodStart.slice(0, 4)}=${fmt(p.value)}`).join('  ')}`);
}

// 'all'-unit pooling: mortality must equal pooled deaths/discharges, not an average of ratios
const allMort = stats('mortality-rate', 'all');
console.log(`\n[all] mortality-rate: min ${fmt(allMort.min)} | mean ${fmt(allMort.mean)} | max ${fmt(allMort.max)}`);

// cross-check pooled monthly mortality from raw rows directly
const rawMonth = ds.rawRows.filter((r) => r.month === '2025-06' && r.unitId !== 'all');
const deaths = rawMonth.reduce((s, r) => s + (r.totalDeaths ?? 0), 0);
const discharges = rawMonth.reduce((s, r) => s + (r.totalDischarges ?? 0), 0);
console.log(`raw pooled 2025-06: deaths=${deaths}, discharges=${discharges}, mortality=${fmt((deaths / discharges) * 100)}%`);

// a couple more range checks
for (const [m, u] of [['opd-avg-wait-time', 'outpatient'], ['petty-cash-utilization', 'medical'], ['cpd-participation-rate', 'medical'], ['absenteeism-rate', 'medical']] as const) {
  const s = stats(m, u);
  console.log(`[${u}] ${m}: mean ${fmt(s.mean)} (min ${fmt(s.min)}, max ${fmt(s.max)})`);
}

// SPC pipeline: monthly mortality for medical should yield limits + some signals
import { buildSPCSeries } from '@/lib/spc/calculate-limits';
import { computeSPC } from '@/hooks/useSPC';
import { computeDomainScores, computeGlobalHealth } from '@/lib/score';
import { DOMAINS } from '@/data/domains';

const mortPeriods = monthly('mortality-rate', 'medical');
const spc = buildSPCSeries(mortPeriods, METRIC_MAP['mortality-rate'], 'month');
const signals = spc.filter((p) => p.signal !== null).length;
console.log(`\nSPC [medical] mortality-rate monthly: ${spc.length} points, CL=${fmt(spc[0]?.cl ?? NaN)}%, signals=${signals}`);

// composite scores must work with volume metrics excluded (weight 0)
const seriesByMetric: Record<string, ReturnType<typeof computeSPC>> = {};
for (const d of DOMAINS) {
  for (const id of d.metricIds) seriesByMetric[id] = computeSPC(ds, id, 'all', 'month');
}
const scores = computeDomainScores(seriesByMetric);
const health = computeGlobalHealth(scores);
console.log(`domain scores: ${scores.map((s) => `${s.domainId}=${s.score}(${s.status})`).join('  ')}`);
console.log(`global health: ${health.score} (Δ${health.delta})`);

// derive must skip rows with missing fields instead of crashing
const sparse = deriveObservations([
  {
    unitId: 'medical', entryDate: '2026-01-09', month: '2026-01', periodLabel: 'Week 1, Jan 2026',
    grain: 'week', periodStart: '2026-01-05', periodEnd: '2026-01-11', daysInPeriod: 7,
    totalDeaths: 3, totalDischarges: 200, // only clinical minimum reported
  },
]);
console.log(`\nsparse-row derive: ${sparse.length} observations (expect only death/discharge-based ones)`);
console.log(sparse.map((o) => `${o.unitId}/${o.metricId}=${fmt(o.value)}`).join(', '));
