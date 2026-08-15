import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Activity, Gauge, ShieldCheck, Stethoscope, Users, Wallet } from 'lucide-react';
import { DOMAIN_MAP } from '@/data/domains';
import { METRICS } from '@/data/metrics';
import type { Domain, DomainId, DomainScore, SPCPoint } from '@/types/dcl';
import { useDataset } from '@/hooks/useDataset';
import { usePersistentFilters } from '@/hooks/usePersistentFilters';
import { computeSPC } from '@/hooks/useSPC';
import { computeDomainScores } from '@/lib/score';
import { DomainHeader } from '@/components/domain/DomainHeader';
import { KPISummaryTiles } from '@/components/domain/KPISummaryTiles';
import { DomainKPIChartCard } from '@/components/domain/DomainKPIChartCard';
import { MetricDetailDrawer } from '@/components/domain/MetricDetailDrawer';
import { MethodologyFooter, SignalListCard } from '@/components/domain/rail-shared';
import { buildInterpretation } from '@/components/domain/domain-shared';
import { ClinicalInsightRail } from '@/components/domain/clinical-insight-rail';
import { SafetyInsightRail } from '@/components/domain/safety-insight-rail';
import { FinanceMethodologyFooter, FinancialDriverRail } from '@/components/domain/finance-sections';
import { FlowBottleneckRail, OpsMethodologyFooter } from '@/components/domain/ops-sections';
import { HRMethodologyFooter, PeopleInsightRail } from '@/components/domain/hr-sections';

/**
 * Level 2 domain drill-down. Fully config-driven: every domain renders the
 * same header, summary tiles, 2-column SPC grid (all registered metrics;
 * the last card spans both columns when the count is odd), insight rail, and
 * methodology footer; domain-specific rail/footer/copy come from
 * DOMAIN_SECTIONS below. Domains without a registered section fall back to a
 * generic signal rail.
 */

interface SectionProps {
  domain: Domain;
  seriesByMetric: Record<string, SPCPoint[]>;
  score: DomainScore;
  onOpenMetric: (metricId: string) => void;
  onJumpToChart: (metricId: string) => void;
}

interface DomainSectionConfig {
  icon: ReactNode;
  exportLabel: string;
  ownerLabel: string;
  rail?: ComponentType<SectionProps>;
  footer?: ComponentType<{ domain: Domain }>;
}

/** Generic fallback rail for domains without a bespoke insight rail. */
function GenericSignalRail({ domain, seriesByMetric, onOpenMetric }: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-[var(--dcl-ink-900)]">Signals</h2>
      <SignalListCard title="Domain signals" domain={domain} seriesByMetric={seriesByMetric} onOpenMetric={onOpenMetric} />
    </div>
  );
}

/* ── Clinical outcome sections (insight rail + methodology footer) ── */

function ClinicalRail({ domain, seriesByMetric, onJumpToChart }: SectionProps) {
  return <ClinicalInsightRail domain={domain} seriesByMetric={seriesByMetric} onJumpToChart={onJumpToChart} />;
}

function ClinicalMethodologyFooter({ domain }: { domain: Domain }) {
  return (
    <MethodologyFooter
      heading="How these limits are calculated"
      copy="Percentage metrics use p-chart limits based on each period's denominator. Continuous metrics use an individuals chart. The baseline uses the first 20 completed periods."
      formula="p-chart: CL = p̄, limits = p̄ ± 3√(p̄(1−p̄)/n) per period. i-chart: sigma estimated from the mean moving range (MR̄ / 1.128). Limits are recalculated only when you explicitly rebaseline; LCL is floored at zero for non-negative metrics."
      auditItems={[
        { label: 'Completeness', value: '98.9%' },
        { label: 'Blocking errors', value: '0' },
        { label: 'Source', value: 'Sample data' },
      ]}
      domainId={domain.id}
      accent={domain.color}
    />
  );
}

/* ── Patient safety sections (investigation rail + methodology footer) ── */

function SafetyRail({ domain, seriesByMetric, onOpenMetric }: SectionProps) {
  return <SafetyInsightRail domain={domain} seriesByMetric={seriesByMetric} onOpenMetric={onOpenMetric} />;
}

function SafetyMethodologyFooter({ domain }: { domain: Domain }) {
  return (
    <MethodologyFooter
      heading="How safety limits are calculated"
      copy="Rates per exposure use u-chart limits. Incidence proportions use p-chart limits. Limits vary when denominators vary."
      formula="u-chart: CL = ū, limits = ū ± 3√(ū/n) per exposure period. p-chart: CL = p̄, limits = p̄ ± 3√(p̄(1−p̄)/n). The baseline uses the first 20 completed periods and is recalculated only on explicit rebaseline."
      auditItems={[
        { label: 'Completeness', value: '97.8%' },
        { label: 'Warnings', value: '1' },
        { label: 'Privacy', value: 'No identifiers in notes' },
      ]}
      domainId={domain.id}
      accent={domain.color}
    />
  );
}

const DOMAIN_SECTIONS: Partial<Record<DomainId, DomainSectionConfig>> = {
  'clinical-outcome': {
    icon: <Stethoscope className="h-5 w-5" />,
    exportLabel: 'Export clinical brief',
    ownerLabel: 'Clinical Governance',
    rail: ClinicalRail,
    footer: ClinicalMethodologyFooter,
  },
  'patient-safety': {
    icon: <ShieldCheck className="h-5 w-5" />,
    exportLabel: 'Export safety brief',
    ownerLabel: 'Patient Safety Lead',
    rail: SafetyRail,
    footer: SafetyMethodologyFooter,
  },
  'financial-efficiency': {
    icon: <Wallet className="h-5 w-5" />,
    exportLabel: 'Export finance brief',
    ownerLabel: 'Finance Business Partner',
    rail: FinancialDriverRail,
    footer: FinanceMethodologyFooter,
  },
  'operational-efficiency': {
    icon: <Gauge className="h-5 w-5" />,
    exportLabel: 'Export operations brief',
    ownerLabel: 'Operations Lead',
    rail: FlowBottleneckRail,
    footer: OpsMethodologyFooter,
  },
  'hr-development': {
    icon: <Users className="h-5 w-5" />,
    exportLabel: 'Export HR brief',
    ownerLabel: 'HR Business Partner',
    rail: PeopleInsightRail,
    footer: HRMethodologyFooter,
  },
};

const FALLBACK_SECTION: DomainSectionConfig = {
  icon: <Activity className="h-5 w-5" />,
  exportLabel: 'Export domain brief',
  ownerLabel: 'Domain lead',
};

export default function DomainPage({ domainId }: { domainId: DomainId }) {
  const domain = DOMAIN_MAP[domainId];
  const [params] = useSearchParams();
  const { dataset } = useDataset();
  const { timeScale, unitId } = usePersistentFilters();
  const [drawerMetric, setDrawerMetric] = useState<string | null>(null);
  const [highlightMetric, setHighlightMetric] = useState<string | null>(params.get('metric'));
  const methodologyRef = useRef<HTMLDivElement>(null);
  const highlightTimer = useRef<number>(0);

  useEffect(() => {
    document.title = `DCL Pulse — ${domain.name}`;
  }, [domain.name]);

  // Deep-link from Overview / Insights: ?metric=<id>
  useEffect(() => {
    const target = params.get('metric');
    if (target) scrollToMetric(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // SPC series for every metric registered to this domain, under the current global filters
  const seriesByMetric = useMemo(
    () =>
      Object.fromEntries(
        METRICS.filter((m) => m.domainId === domainId).map((m) => [m.id, computeSPC(dataset, m.id, unitId, timeScale)]),
      ) as Record<string, SPCPoint[]>,
    [dataset, domainId, unitId, timeScale],
  );

  const score = useMemo(
    () =>
      computeDomainScores(seriesByMetric).find((s) => s.domainId === domainId) ?? {
        domainId,
        score: 0,
        delta: 0,
        status: 'no-signal' as const,
        metricScores: [],
        activeSignals: 0,
      },
    [seriesByMetric, domainId],
  );

  const interpretation = useMemo(
    () => buildInterpretation(domain, score, seriesByMetric),
    [domain, score, seriesByMetric],
  );

  const periodsCount = domain.metricIds.reduce((n, id) => Math.max(n, (seriesByMetric[id] ?? []).length), 0);
  const config = DOMAIN_SECTIONS[domainId] ?? FALLBACK_SECTION;
  const Rail = config.rail ?? GenericSignalRail;
  const Footer = config.footer;

  function scrollToMetric(metricId: string) {
    setHighlightMetric(metricId);
    requestAnimationFrame(() => {
      document.getElementById(`metric-${metricId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightMetric(null), 2400);
  }

  return (
    <div
      className="flex flex-col gap-6"
      style={{ ['--domain-accent' as string]: domain.color, ['--domain-accent-soft' as string]: domain.colorSoft }}
    >
      <DomainHeader
        domain={domain}
        score={score}
        interpretation={interpretation}
        grain={timeScale}
        unitId={unitId}
        periodsCount={periodsCount}
        seriesByMetric={seriesByMetric}
        icon={config.icon}
        exportLabel={config.exportLabel}
        onOpenMethodology={() => methodologyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />

      <KPISummaryTiles
        domain={domain}
        seriesByMetric={seriesByMetric}
        highlightedMetric={highlightMetric}
        onSelect={scrollToMetric}
        onOpenDetails={setDrawerMetric}
      />

      <div className="grid grid-cols-1 gap-6 min-[1440px]:grid-cols-12">
        <div className="grid grid-cols-1 gap-5 self-start min-[1440px]:col-span-8 xl:grid-cols-2">
          {domain.metricIds.map((metricId, i) => (
            <div
              key={metricId}
              id={`metric-${metricId}`}
              className={
                domain.metricIds.length % 2 === 1 && i === domain.metricIds.length - 1 ? 'xl:col-span-2' : undefined
              }
            >
              <DomainKPIChartCard
                metricId={metricId}
                accent={domain.color}
                index={i}
                highlighted={highlightMetric === metricId}
                onOpenDetails={setDrawerMetric}
              />
            </div>
          ))}
        </div>
        <aside className="min-[1440px]:col-span-4 min-[1440px]:sticky min-[1440px]:top-24 min-[1440px]:self-start">
          <Rail
            domain={domain}
            seriesByMetric={seriesByMetric}
            score={score}
            onOpenMetric={setDrawerMetric}
            onJumpToChart={scrollToMetric}
          />
        </aside>
      </div>

      {Footer && (
        <div ref={methodologyRef} className="scroll-mt-24">
          <Footer domain={domain} />
        </div>
      )}

      <MetricDetailDrawer
        metricId={drawerMetric}
        accent={domain.color}
        ownerLabel={config.ownerLabel}
        onClose={() => setDrawerMetric(null)}
      />
    </div>
  );
}
