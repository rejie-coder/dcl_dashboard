import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Local review state for the Insights page: alert acknowledgements and the
 * action tracker. Browser-local only (localStorage), per insights.md
 * section 5: "Actions are local to the browser and linked to metric signals."
 */

export type ActionStatus = 'open' | 'in-progress' | 'done';

export interface ActionItem {
  id: string;
  alertId: string | null;
  metricId: string;
  metricName: string;
  title: string;
  owner: string;
  dueDate: string; // ISO date
  status: ActionStatus;
  createdAt: string;
  updatedAt: string;
}

interface InsightsState {
  /** alertId → acknowledgement timestamp */
  acknowledged: Record<string, string>;
  actions: ActionItem[];
  acknowledge: (alertId: string) => void;
  unacknowledge: (alertId: string) => void;
  acknowledgeAll: (alertIds: string[]) => void;
  addAction: (input: Omit<ActionItem, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: ActionStatus }) => void;
  setActionStatus: (id: string, status: ActionStatus) => void;
  removeAction: (id: string) => void;
}

export const useInsightsStore = create<InsightsState>()(
  persist(
    (set) => ({
      acknowledged: {},
      actions: [],

      acknowledge: (alertId) =>
        set((s) => ({ acknowledged: { ...s.acknowledged, [alertId]: new Date().toISOString() } })),

      unacknowledge: (alertId) =>
        set((s) => {
          const next = { ...s.acknowledged };
          delete next[alertId];
          return { acknowledged: next };
        }),

      acknowledgeAll: (alertIds) =>
        set((s) => {
          const now = new Date().toISOString();
          const next = { ...s.acknowledged };
          for (const id of alertIds) next[id] = now;
          return { acknowledged: next };
        }),

      addAction: (input) =>
        set((s) => ({
          actions: [
            {
              ...input,
              status: input.status ?? 'open',
              id: `action-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            ...s.actions,
          ],
        })),

      setActionStatus: (id, status) =>
        set((s) => ({
          actions: s.actions.map((a) => (a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a)),
        })),

      removeAction: (id) => set((s) => ({ actions: s.actions.filter((a) => a.id !== id) })),
    }),
    { name: 'dcl-insights-v1' },
  ),
);
