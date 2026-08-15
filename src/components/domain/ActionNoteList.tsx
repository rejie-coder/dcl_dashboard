import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared action / note tracker used by the domain insight rails and the
 * metric detail drawer. Items persist to localStorage; completing an item
 * animates a check and moves the row to the bottom.
 */

export type ActionStatus = 'open' | 'in-progress' | 'done';

export interface ActionNote {
  id: string;
  text: string;
  owner?: string;
  due?: string;
  status: ActionStatus;
  createdAt: string;
}

const STATUS_LABEL: Record<ActionStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  done: 'Done',
};

const NEXT_STATUS: Record<ActionStatus, ActionStatus> = {
  open: 'in-progress',
  'in-progress': 'done',
  done: 'open',
};

function load(storageKey: string, seed: ActionNote[]): ActionNote[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw) as ActionNote[];
  } catch {
    /* corrupted storage — fall back to seed */
  }
  return seed;
}

function sortNotes(notes: ActionNote[]): ActionNote[] {
  return [...notes].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function ActionNoteList({
  storageKey,
  seed = [],
  addLabel = 'Add note',
  compact = false,
}: {
  storageKey: string;
  seed?: ActionNote[];
  addLabel?: string;
  compact?: boolean;
}) {
  const [notes, setNotes] = useState<ActionNote[]>(() => sortNotes(load(storageKey, seed)));
  const [text, setText] = useState('');
  const [owner, setOwner] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch {
      /* storage full — non-blocking */
    }
  }, [notes, storageKey]);

  const sorted = useMemo(() => sortNotes(notes), [notes]);

  const addNote = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setNotes((prev) => [
      ...prev,
      {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: trimmed,
        owner: owner.trim() || undefined,
        status: 'open',
        createdAt: new Date().toISOString(),
      },
    ]);
    setText('');
    setOwner('');
  };

  return (
    <div className="flex flex-col gap-2.5">
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {sorted.map((note) => {
            const done = note.status === 'done';
            return (
              <motion.li
                key={note.id}
                layout="position"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'flex items-start gap-2.5 rounded-xl border border-[var(--dcl-line)] bg-[var(--dcl-surface-tint)] px-3 py-2.5',
                  done && 'opacity-70',
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    setNotes((prev) =>
                      prev.map((n) => (n.id === note.id ? { ...n, status: NEXT_STATUS[n.status] } : n)),
                    )
                  }
                  aria-label={`Mark "${note.text}" as ${STATUS_LABEL[NEXT_STATUS[note.status]]}`}
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
                    done
                      ? 'border-[#34C759] bg-[#34C759] text-white'
                      : note.status === 'in-progress'
                        ? 'border-[#FFCC00] bg-[#FFCC00]/20 text-transparent'
                        : 'border-[var(--dcl-line-strong)] bg-white text-transparent',
                  )}
                >
                  <motion.span
                    initial={false}
                    animate={{ scale: done ? 1 : 0 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="flex"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </motion.span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[13px] font-medium leading-snug text-[var(--dcl-ink-900)]', done && 'line-through')}>
                    {note.text}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--dcl-ink-500)]">
                    {note.owner ? `Owner ${note.owner}` : 'No owner'}
                    {note.due ? ` · due ${note.due}` : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1',
                    done
                      ? 'bg-[#34C759]/12 text-[#1F7A38] ring-[#34C759]/30'
                      : note.status === 'in-progress'
                        ? 'bg-[#FFCC00]/15 text-[#713F12] ring-[#FFCC00]/40'
                        : 'bg-[#8E8E93]/10 text-[var(--dcl-ink-500)] ring-[#8E8E93]/25',
                  )}
                >
                  {STATUS_LABEL[note.status]}
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {sorted.length === 0 && (
          <li className="rounded-xl border border-dashed border-[var(--dcl-line-strong)] px-3 py-4 text-center text-[12.5px] text-[var(--dcl-ink-400)]">
            No actions yet.
          </li>
        )}
      </ul>

      <div className={cn('flex gap-2', compact ? 'flex-col' : 'flex-col sm:flex-row')}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addNote();
          }}
          placeholder="Add an action or note…"
          aria-label="New action note"
          className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--dcl-line)] bg-white px-3 text-[13px] text-[var(--dcl-ink-900)] placeholder:text-[var(--dcl-ink-400)] focus:border-transparent"
        />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addNote();
          }}
          placeholder="Owner"
          aria-label="Action owner"
          className="h-9 w-full rounded-lg border border-[var(--dcl-line)] bg-white px-3 text-[13px] text-[var(--dcl-ink-900)] placeholder:text-[var(--dcl-ink-400)] focus:border-transparent sm:w-28"
        />
        <button
          type="button"
          onClick={addNote}
          disabled={!text.trim()}
          className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--dcl-ink-900)] px-3 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </button>
      </div>
    </div>
  );
}
