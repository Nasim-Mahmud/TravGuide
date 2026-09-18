import { loadVisitsSeed } from '@/features/map/data';
import { useAtlasStore } from '@/features/map/store';
import type { VisitEntry, VisitsFile } from '@/features/map/types';

/**
 * Export / reset helpers for the stats dashboard. Uses only the store's
 * public surface (getState/setState/getInitialState-free) — features/map is
 * not modified. STORAGE_KEY mirrors the store's persistence key.
 */

export const VISITS_STORAGE_KEY = 'atlas.visits.v1';

export function readLocalOverlay(): Record<string, VisitEntry> | null {
  try {
    const raw = localStorage.getItem(VISITS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { states?: Record<string, VisitEntry> };
    return parsed.states ?? null;
  } catch {
    return null;
  }
}

/** Order-insensitive comparison of two state maps (state + note per node). */
export function statesEqual(
  a: Record<string, VisitEntry>,
  b: Record<string, VisitEntry>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    const ea = a[key];
    const eb = b[key];
    if (!eb || ea.state !== eb.state || (ea.note ?? '') !== (eb.note ?? '')) return false;
  }
  return true;
}

/** True when a localStorage overlay exists AND differs from the bundled seed. */
export function hasUnsavedChanges(seed: VisitsFile | null): boolean {
  const local = readLocalOverlay();
  if (!local || !seed) return false;
  return !statesEqual(local, seed.states);
}

/** Push a toast through the store's public API (mirrors its 4s auto-dismiss). */
export function pushStatsToast(message: string): void {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  useAtlasStore.setState((s) => ({ toasts: [...s.toasts.slice(-1), { id, message }] }));
  setTimeout(() => useAtlasStore.getState().dismissToast(id), 4000);
}

/** Download the current merged visits (seed + overlay) as a JSON snapshot. */
export function exportVisitsJson(states: Record<string, VisitEntry>): void {
  const payload: VisitsFile = {
    version: 1,
    updated: new Date().toISOString(),
    states,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'visits.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Clear the localStorage overlay and restore the store to the bundled seed. */
export async function resetVisits(): Promise<void> {
  try {
    localStorage.removeItem(VISITS_STORAGE_KEY);
  } catch {
    // storage unavailable — still reset in memory
  }
  const seed = await loadVisitsSeed();
  useAtlasStore.setState({ states: seed.states, prevStates: null });
}

/** Apply a cross-tab storage event to the store (design/stats.md §8). */
export async function syncFromStorageEvent(newValue: string | null): Promise<void> {
  let local: Record<string, VisitEntry> | null = null;
  if (newValue) {
    try {
      local = (JSON.parse(newValue) as { states?: Record<string, VisitEntry> }).states ?? null;
    } catch {
      local = null;
    }
  }
  if (local) {
    useAtlasStore.setState({ states: local });
  } else {
    const seed = await loadVisitsSeed();
    useAtlasStore.setState({ states: seed.states });
  }
}
