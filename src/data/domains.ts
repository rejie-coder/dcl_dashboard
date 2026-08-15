import type { Domain, DomainId } from '@/types/dcl';

export const DOMAINS: Domain[] = [
  {
    id: 'clinical-outcome',
    name: 'Clinical Outcome',
    order: 1,
    color: '#007AFF',
    colorSoft: '#EAF3FF',
    gradientTo: '#5AC8FA',
    outcomeSentence: 'Mortality, readmission, stay length, infection, surgery volumes',
    route: '/domains/clinical-outcome',
    metricIds: [
      'mortality-rate',
      'hospital-daily-deaths',
      'readmission-rate',
      'avg-length-of-stay',
      'ssi-rate',
      'surgeries-major',
      'surgeries-minor',
      'surgeries-cataract',
    ],
  },
  {
    id: 'patient-safety',
    name: 'Patient Safety',
    order: 2,
    color: '#FF375F',
    colorSoft: '#FFF0F3',
    gradientTo: '#FF9F0A',
    outcomeSentence: 'Errors, falls, ulcers, needle-stick injuries',
    route: '/domains/patient-safety',
    metricIds: ['medication-error-rate', 'patient-fall-rate', 'pressure-ulcer-incidence', 'needle-stick-injury-rate'],
  },
  {
    id: 'financial-efficiency',
    name: 'Financial Efficiency',
    order: 3,
    color: '#30B0C7',
    colorSoft: '#EAFBFD',
    gradientTo: '#64D2FF',
    outcomeSentence: 'Cost per day, petty cash, utilities, stock-outs',
    route: '/domains/financial-efficiency',
    metricIds: [
      'cost-per-patient-day',
      'petty-cash-utilization',
      'local-purchase-expenditure',
      'fuel-expenditure',
      'electricity-bill',
      'water-bill',
      'stock-out-rate',
    ],
  },
  {
    id: 'operational-efficiency',
    name: 'Operational Efficiency',
    order: 4,
    color: '#FF9F0A',
    colorSoft: '#FFF7E8',
    gradientTo: '#FFD60A',
    outcomeSentence: 'Occupancy, theatre use, waiting, turnaround',
    route: '/domains/operational-efficiency',
    metricIds: ['bed-occupancy-rate', 'theatre-utilization-rate', 'opd-avg-wait-time', 'diagnostic-turnaround-time'],
  },
  {
    id: 'hr-development',
    name: 'HR Development',
    order: 5,
    color: '#AF52DE',
    colorSoft: '#F8EFFF',
    gradientTo: '#BF5AF2',
    outcomeSentence: 'Training, turnover, absence, CPD',
    route: '/domains/hr-development',
    metricIds: ['training-programs-conducted', 'staff-turnover-rate', 'absenteeism-rate', 'cpd-participation-rate'],
  },
];

export const DOMAIN_MAP: Record<DomainId, Domain> = Object.fromEntries(
  DOMAINS.map((d) => [d.id, d]),
) as Record<DomainId, Domain>;

export function domainById(id: string): Domain | undefined {
  return DOMAINS.find((d) => d.id === id);
}
