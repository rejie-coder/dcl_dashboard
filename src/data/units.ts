import type { Unit } from '@/types/dcl';

export const UNITS: Unit[] = [
  { id: 'all', name: 'All Units', active: true },
  { id: 'ed', name: 'Emergency', active: true },
  { id: 'icu', name: 'ICU', active: true },
  { id: 'medical', name: 'Medical', active: true },
  { id: 'surgical', name: 'Surgical', active: true },
  { id: 'maternity', name: 'Maternity', active: true },
  { id: 'outpatient', name: 'Outpatient', active: true },
];

export const UNIT_MAP: Record<string, Unit> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

export function unitName(id: string): string {
  return UNIT_MAP[id]?.name ?? id;
}
