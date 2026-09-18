import type { AtlasIndex, ChildrenStats, EffectiveState, StoredVisitState, VisitEntry } from './types';

/**
 * Effective-state computation (plan §12/§13):
 *  - A stored state always wins for the node itself.
 *  - Otherwise, ≥1 descendant effectively visited/lived ⇒ 'partial' (recursive).
 *  - Wishlist never creates partials. No parent→child cascade.
 */
export interface EffectiveIndex {
  get(nodeId: string): EffectiveState;
  stored(nodeId: string): StoredVisitState | null;
  stats(nodeId: string): ChildrenStats;
  worldStats(): { visited: number; total: number; continents: number; continentTotal: number; partial: number };
}

export function buildEffectiveIndex(
  index: AtlasIndex,
  states: Record<string, VisitEntry>,
): EffectiveIndex {
  const memo = new Map<string, EffectiveState>();

  function get(nodeId: string): EffectiveState {
    const stored = states[nodeId]?.state;
    if (stored) return stored;
    const cached = memo.get(nodeId);
    if (cached) return cached;
    const node = index.nodes[nodeId];
    let result: EffectiveState = 'none';
    if (node) {
      for (const childId of node.children) {
        const cs = get(childId);
        if (cs === 'visited' || cs === 'lived' || cs === 'partial') {
          result = 'partial';
          break;
        }
      }
    }
    memo.set(nodeId, result);
    return result;
  }

  function stored(nodeId: string): StoredVisitState | null {
    return states[nodeId]?.state ?? null;
  }

  function stats(nodeId: string): ChildrenStats {
    const node = index.nodes[nodeId];
    const children = node ? node.children : [];
    const s: ChildrenStats = {
      total: children.length, visited: 0, lived: 0, transit: 0,
      wishlist: 0, partial: 0, none: 0, fullyExplored: false,
    };
    for (const cid of children) {
      const st = get(cid);
      if (st === 'visited') s.visited++;
      else if (st === 'lived') { s.visited++; s.lived++; }
      else if (st === 'transit') s.transit++;
      else if (st === 'wishlist') s.wishlist++;
      else if (st === 'partial') s.partial++;
      else s.none++;
    }
    s.fullyExplored = s.total > 0 && s.visited === s.total;
    return s;
  }

  function worldStats() {
    const root = index.nodes[index.root];
    const countries = root ? root.children : [];
    let visited = 0;
    let partial = 0;
    const continents = new Set<string>();
    const allContinents = new Set<string>();
    for (const cid of countries) {
      const st = get(cid);
      const continent = index.nodes[cid]?.continent;
      if (continent) allContinents.add(continent);
      if (st === 'visited' || st === 'lived') {
        visited++;
        if (continent) continents.add(continent);
      } else if (st === 'partial') {
        partial++;
        if (continent) continents.add(continent);
      }
    }
    return {
      visited,
      total: countries.length,
      continents: continents.size,
      continentTotal: Math.max(allContinents.size, 7),
      partial,
    };
  }

  return { get, stored, stats, worldStats };
}

export const STATE_LABEL: Record<EffectiveState, string> = {
  visited: 'Visited',
  lived: 'Lived',
  transit: 'Transit',
  wishlist: 'Wishlist',
  partial: 'Partially visited',
  none: 'Not visited',
};

/** Order + descriptions for the StatePicker (design.md §7.8 / map.md §3.8) */
export const PICKER_OPTIONS: Array<{
  state: StoredVisitState;
  label: string;
  description: string;
}> = [
  { state: 'visited', label: 'Visited', description: "You've spent real time here" },
  { state: 'lived', label: 'Lived', description: 'You call(ed) this home' },
  { state: 'transit', label: 'Transit', description: 'Passed through only' },
  { state: 'wishlist', label: 'Wishlist', description: 'Want to go' },
];
