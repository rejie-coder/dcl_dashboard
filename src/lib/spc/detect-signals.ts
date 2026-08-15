import type { SignalKind } from '@/types/dcl';

/**
 * SPC signal detection — the 4 rules from design.md section 8:
 * 1. one point beyond UCL/LCL                      → special-cause
 * 2. eight consecutive points on one side of CL    → run-rule (shift)
 * 3. six consecutive increasing/decreasing points  → run-rule (trend)
 * 4. two of three consecutive points beyond the    → run-rule (zone)
 *    same 2σ zone
 */

export interface SignalInput {
  value: number;
  cl: number;
  ucl: number;
  lcl: number;
  sigma: number;
}

export interface SignalOutput {
  signal: SignalKind | null;
  rules: string[];
}

export function detectSignals(points: SignalInput[]): SignalOutput[] {
  const n = points.length;
  const out: SignalOutput[] = points.map(() => ({ signal: null, rules: [] }));
  const mark = (i: number, rule: string, kind: SignalKind) => {
    if (!out[i].rules.includes(rule)) out[i].rules.push(rule);
    if (kind === 'special-cause') out[i].signal = 'special-cause';
    else if (out[i].signal !== 'special-cause') out[i].signal = 'run-rule';
  };

  for (let i = 0; i < n; i++) {
    const p = points[i];
    // Rule 1: beyond limits
    if (p.value > p.ucl || p.value < p.lcl) mark(i, 'beyond-limits', 'special-cause');

    // Rule 2: 8 consecutive on one side of CL
    if (i >= 7) {
      let above = true;
      let below = true;
      for (let j = i - 7; j <= i; j++) {
        if (points[j].value <= points[j].cl) above = false;
        if (points[j].value >= points[j].cl) below = false;
      }
      if (above || below) mark(i, 'shift', 'run-rule');
    }

    // Rule 3: 6 consecutive increasing or decreasing
    if (i >= 5) {
      let up = true;
      let down = true;
      for (let j = i - 4; j <= i; j++) {
        if (points[j].value <= points[j - 1].value) up = false;
        if (points[j].value >= points[j - 1].value) down = false;
      }
      if (up || down) mark(i, 'trend', 'run-rule');
    }

    // Rule 4: 2 of 3 beyond the same 2σ zone
    if (i >= 2) {
      const window = [points[i - 2], points[i - 1], points[i]];
      const upper = window.map((p) => p.sigma > 0 && p.value > p.cl + 2 * p.sigma && p.value <= p.ucl);
      const lower = window.map((p) => p.sigma > 0 && p.value < p.cl - 2 * p.sigma && p.value >= p.lcl);
      if (upper.filter(Boolean).length >= 2 || lower.filter(Boolean).length >= 2) {
        // flag the points inside the zone
        for (let k = 0; k < 3; k++) {
          if (upper[k] || lower[k]) mark(i - 2 + k, 'zone-2sigma', 'run-rule');
        }
      }
    }
  }
  return out;
}
