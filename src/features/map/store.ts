import { create } from 'zustand';
import type { AtlasIndex, StoredVisitState, VisitEntry } from './types';
import { loadIndex, loadVisitsSeed } from './data';

const STORAGE_KEY = 'atlas.visits.v1';

export interface AtlasToast {
  id: number;
  message: string;
  undo?: boolean;
}

interface AtlasStore {
  /** Hierarchy index (loaded once at boot / first search focus) */
  index: AtlasIndex | null;
  indexStatus: 'idle' | 'loading' | 'ready' | 'error';
  loadIndex: () => Promise<AtlasIndex | null>;
  /** Effective stored states = seed overlaid with localStorage edits */
  states: Record<string, VisitEntry>;
  seedLoaded: boolean;
  toasts: AtlasToast[];
  announcement: string;
  /** Last node whose state changed (for map pulse) */
  lastChanged: { nodeId: string; seq: number } | null;
  /** Snapshot for single-level undo */
  prevStates: Record<string, VisitEntry> | null;
  init: () => Promise<void>;
  setState: (nodeId: string, state: StoredVisitState | null, nodeName?: string, note?: string) => { fromWishlist: boolean } | null;
  setNote: (nodeId: string, note: string) => void;
  markAllChildren: (childIds: string[]) => void;
  undo: () => void;
  dismissToast: (id: number) => void;
  announce: (msg: string) => void;
}

let toastSeq = 1;
const toastTimer = new Map<number, ReturnType<typeof setTimeout>>();

function persist(states: Record<string, VisitEntry>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, states }));
  } catch {
    // storage full / unavailable — states live in memory only
  }
}

function readLocal(): Record<string, VisitEntry> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { states?: Record<string, VisitEntry> };
    return parsed.states ?? null;
  } catch {
    return null;
  }
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const useAtlasStore = create<AtlasStore>((set, get) => {
  function pushToast(message: string, undo = false) {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-1), { id, message, undo }] }));
    const timer = setTimeout(() => get().dismissToast(id), 4000);
    toastTimer.set(id, timer);
  }

  function applyStates(next: Record<string, VisitEntry>) {
    set({ states: next, prevStates: get().states });
    persist(next);
    if (!sessionStorage.getItem('atlas.draft-notified')) {
      try {
        sessionStorage.setItem('atlas.draft-notified', '1');
        pushToast('Saved in this browser — export JSON to keep it forever');
      } catch { /* ignore */ }
    }
  }

  return {
    index: null,
    indexStatus: 'idle',
    async loadIndex() {
      const { index, indexStatus } = get();
      if (index) return index;
      if (indexStatus === 'loading') {
        // wait for the in-flight load
        return new Promise((resolve) => {
          const unsub = useAtlasStore.subscribe((s) => {
            if (s.indexStatus === 'ready') { unsub(); resolve(s.index); }
            if (s.indexStatus === 'error') { unsub(); resolve(null); }
          });
        });
      }
      set({ indexStatus: 'loading' });
      try {
        const idx = await loadIndex();
        set({ index: idx, indexStatus: 'ready' });
        return idx;
      } catch {
        set({ indexStatus: 'error' });
        return null;
      }
    },
    states: {},
    seedLoaded: false,
    toasts: [],
    announcement: '',
    lastChanged: null,
    prevStates: null,

    async init() {
      if (get().seedLoaded) return;
      const seed = await loadVisitsSeed();
      const local = readLocal();
      set({ states: local ?? seed.states, seedLoaded: true });
    },

    setState(nodeId, state, nodeName, note) {
      const { states } = get();
      const prev = states[nodeId];
      if (!state && !prev) return null;
      if (state && prev?.state === state && (note === undefined || note === prev.note)) return null;

      const next = { ...states };
      if (state) next[nodeId] = note !== undefined ? { state, note } : { ...prev, state };
      else delete next[nodeId];
      applyStates(next);
      set((s) => ({ lastChanged: { nodeId, seq: (s.lastChanged?.seq ?? 0) + 1 } }));

      const name = nodeName ?? nodeId;
      const fromWishlist = prev?.state === 'wishlist' && state != null && state !== 'wishlist';
      if (!state) {
        pushToast(`${name} cleared`, true);
        get().announce(`${name} cleared`);
      } else if (fromWishlist) {
        pushToast(`Moved ${name} from wishlist to ${state}`, true);
        get().announce(`${name} marked ${state}`);
      } else if (prev?.state && prev.state !== state) {
        pushToast(`${name} changed to ${state}`, true);
        get().announce(`${name} marked ${state}`);
      } else {
        pushToast(`${name} marked ${state}`, true);
        get().announce(`${name} marked ${state}`);
      }
      return { fromWishlist };
    },

    setNote(nodeId, note) {
      const { states } = get();
      const prev = states[nodeId];
      if (!prev) return;
      applyStates({ ...states, [nodeId]: { ...prev, note } });
      pushToast('Note saved');
    },

    markAllChildren(childIds) {
      const { states } = get();
      const next = { ...states };
      for (const id of childIds) next[id] = { ...next[id], state: 'visited' };
      applyStates(next);
      pushToast(`${childIds.length} ${childIds.length === 1 ? 'place' : 'places'} marked visited`, true);
      get().announce(`${childIds.length} places marked visited`);
    },

    undo() {
      const { prevStates } = get();
      if (!prevStates) return;
      set({ states: prevStates, prevStates: null });
      persist(prevStates);
      pushToast('Undone');
      get().announce('Change undone');
    },

    dismissToast(id) {
      const timer = toastTimer.get(id);
      if (timer) clearTimeout(timer);
      toastTimer.delete(id);
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },

    announce(msg) {
      // bump with a timestamp so repeated identical messages re-announce
      set({ announcement: `${msg}#${Date.now()}` });
    },
  };
});

export { titleCase };
