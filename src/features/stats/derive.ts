import { buildEffectiveIndex } from '@/features/map/effective';
import { nodeUrl } from '@/features/map/paths';
import type { StoredVisitState, VisitEntry } from '@/features/map/types';
import type { StatsHierarchy } from './hierarchy';

/** ISO3 of the flagship country (Bangladesh) — its own section on /stats. */
export const FLAGSHIP_ID = 'BGD';

export const CONTINENTS: Array<{ code: string; name: string }> = [
  { code: 'AF', name: 'Africa' },
  { code: 'AS', name: 'Asia' },
  { code: 'EU', name: 'Europe' },
  { code: 'NA', name: 'North America' },
  { code: 'SA', name: 'South America' },
  { code: 'OC', name: 'Oceania' },
  { code: 'AN', name: 'Antarctica' },
];

const CONTINENT_CODE: Record<string, string> = {
  Africa: 'AF',
  Asia: 'AS',
  Europe: 'EU',
  'North America': 'NA',
  'South America': 'SA',
  Oceania: 'OC',
  Antarctica: 'AN',
};

export interface LevelTracker {
  level: number;
  /** "Divisions" */
  label: string;
  total: number;
  /** visited + lived */
  full: number;
  /** derived partial */
  partial: number;
  /** full + partial */
  touched: number;
}

export interface CountryCardModel {
  id: string;
  name: string;
  flag: string | null;
  url: string;
  /** e.g. "states", "prefectures" */
  levelLabel: string;
  visited: number;
  total: number;
  stored: StoredVisitState | null;
}

export interface StateRowModel {
  id: string;
  name: string;
  /** "Bavaria · Germany" */
  context: string;
  url: string;
}

export interface ContinentRowModel {
  code: string;
  name: string;
  visited: number;
  total: number;
}

export interface StatsModel {
  world: {
    visited: number;
    total: number;
    /** 0..100, one-decimal precision */
    percent: number;
    partial: number;
    continentsVisited: number;
    continentTotal: number;
    /** Set of continent codes with ≥1 visited/lived/partial country */
    visitedContinentCodes: Set<string>;
    /** All level ≥1 nodes effectively visited/lived */
    regionsVisited: number;
  };
  flagship: {
    id: string;
    name: string;
    localName?: string;
    url: string;
    trackers: LevelTracker[];
  } | null;
  countries: CountryCardModel[];
  glance: Record<StoredVisitState, number>;
  wishlist: StateRowModel[];
  transit: StateRowModel[];
  continents: ContinentRowModel[];
  /** No stored states and nothing effectively touched anywhere */
  empty: boolean;
}

/** Local display names the index doesn't carry (design/stats.md §3). */
const LOCAL_NAME_FALLBACK: Record<string, string> = {
  BGD: 'বাংলাদেশ',
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Pluralized level label: "Division" → "divisions", "State (Bundesland)" →
 * "states", "State / Union Territory" → "states / UTs" (design/stats.md §4).
 */
export function pluralLevelLabel(levelName: string): string {
  const noParen = levelName.replace(/\s*\([^)]*\)/g, '').trim();
  if (/union territory/i.test(noParen)) return 'states / UTs';
  const lower = noParen.toLowerCase();
  if (!lower) return 'regions';
  if (lower.endsWith('s')) return lower;
  return `${lower}s`;
}

/** ISO2 -> regional-indicator flag emoji (design explicitly calls for flags). */
export function flagEmoji(iso2: string | undefined): string | null {
  if (!iso2 || iso2.length !== 2) return null;
  const code = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return String.fromCodePoint(
    ...code.split('').map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

export function computeStats(
  hierarchy: StatsHierarchy,
  states: Record<string, VisitEntry>,
): StatsModel {
  const { index, iso2 } = hierarchy;
  const eff = buildEffectiveIndex(index, states);
  const root = index.nodes[index.root];
  const countryIds = root ? root.children : [];

  /* ── World ─────────────────────────────────────────────────── */
  const ws = eff.worldStats();
  const visitedContinentCodes = new Set<string>();
  for (const cid of countryIds) {
    const st = eff.get(cid);
    if (st === 'visited' || st === 'lived' || st === 'partial') {
      const code = CONTINENT_CODE[index.nodes[cid]?.continent ?? ''];
      if (code) visitedContinentCodes.add(code);
    }
  }
  let regionsVisited = 0;
  for (const node of Object.values(index.nodes)) {
    if (node.level >= 1) {
      const st = eff.get(node.id);
      if (st === 'visited' || st === 'lived') regionsVisited++;
    }
  }
  const percent = ws.total > 0 ? (ws.visited / ws.total) * 100 : 0;

  /* ── Flagship (Bangladesh) ─────────────────────────────────── */
  let flagship: StatsModel['flagship'] = null;
  const flagNode = index.nodes[FLAGSHIP_ID];
  const flagMeta = index.countries[FLAGSHIP_ID];
  if (flagNode) {
    const levels = (flagMeta?.levels ?? [])
      .map((name, i) => ({ level: i + 1, name }))
      .filter(({ level }) => (flagMeta?.totals[level] ?? 0) > 0 || level <= (flagMeta?.maxLevel ?? 0));
    const byLevel = new Map<number, { full: number; partial: number; count: number }>();
    for (const node of Object.values(index.nodes)) {
      if (node.country !== FLAGSHIP_ID || node.level < 1) continue;
      const bucket = byLevel.get(node.level) ?? { full: 0, partial: 0, count: 0 };
      const st = eff.get(node.id);
      if (st === 'visited' || st === 'lived') bucket.full++;
      else if (st === 'partial') bucket.partial++;
      bucket.count++;
      byLevel.set(node.level, bucket);
    }
    const trackers: LevelTracker[] = levels.map(({ level, name }) => {
      const bucket = byLevel.get(level) ?? { full: 0, partial: 0, count: 0 };
      const total = flagMeta?.totals[level] ?? bucket.count;
      return {
        level,
        label: titleCase(pluralLevelLabel(name)),
        total,
        full: bucket.full,
        partial: bucket.partial,
        touched: bucket.full + bucket.partial,
      };
    });
    flagship = {
      id: FLAGSHIP_ID,
      name: flagNode.name,
      localName: flagNode.localName ?? LOCAL_NAME_FALLBACK[FLAGSHIP_ID],
      url: nodeUrl(index, FLAGSHIP_ID),
      trackers,
    };
  }

  /* ── Other countries with shipped ADM1+ and ≥1 touched region ── */
  const countries: CountryCardModel[] = [];
  for (const cid of countryIds) {
    if (cid === FLAGSHIP_ID) continue;
    const node = index.nodes[cid];
    const meta = index.countries[cid];
    if (!node || !meta || meta.maxLevel < 1 || node.children.length === 0) continue;

    const ownStored = states[cid]?.state ?? null;
    // Touched = any descendant with color (visited/lived/partial/transit/wishlist)
    let touched = false;
    const deepest = meta.maxLevel;
    let visitedDeepest = 0;
    let deepestCount = 0;
    for (const n of Object.values(index.nodes)) {
      if (n.country !== cid || n.level < 1) continue;
      const st = eff.get(n.id);
      if (st !== 'none') touched = true;
      if (n.level === deepest) {
        deepestCount++;
        if (st === 'visited' || st === 'lived') visitedDeepest++;
      }
    }
    if (!touched && !ownStored) continue;

    const levelName = meta.levels[deepest - 1] ?? 'Region';
    countries.push({
      id: cid,
      name: node.name,
      flag: flagEmoji(iso2[cid]),
      url: nodeUrl(index, cid),
      levelLabel: pluralLevelLabel(levelName),
      visited: visitedDeepest,
      total: meta.totals[deepest] ?? deepestCount,
      stored: ownStored,
    });
  }
  countries.sort((a, b) => b.visited - a.visited || a.name.localeCompare(b.name));

  /* ── States at a glance ────────────────────────────────────── */
  const glance: Record<StoredVisitState, number> = { visited: 0, lived: 0, transit: 0, wishlist: 0 };
  for (const [id, entry] of Object.entries(states)) {
    // Ignore stale ids that no longer exist in the hierarchy
    if (!index.nodes[id]) continue;
    if (entry.state in glance) glance[entry.state]++;
  }

  const rowFor = (id: string): StateRowModel | null => {
    const node = index.nodes[id];
    if (!node) return null;
    const parent = node.parent ? index.nodes[node.parent] : undefined;
    const country = node.country ? index.nodes[node.country] : undefined;
    const parts: string[] = [];
    if (node.level >= 1 && parent && parent.level >= 0) parts.push(parent.name);
    if (country && country.id !== node.id && country.id !== parent?.id) parts.push(country.name);
    return {
      id,
      name: node.name,
      context: parts.join(' · ') || (node.continent ?? ''),
      url: nodeUrl(index, id),
    };
  };

  const collectRows = (state: StoredVisitState): StateRowModel[] =>
    Object.entries(states)
      .filter(([, e]) => e.state === state)
      .map(([id]) => rowFor(id))
      .filter((r): r is StateRowModel => r != null)
      .sort((a, b) => a.context.localeCompare(b.context) || a.name.localeCompare(b.name));

  const wishlist = collectRows('wishlist');
  const transit = collectRows('transit');

  /* ── Continents ────────────────────────────────────────────── */
  const continentRows: ContinentRowModel[] = CONTINENTS.map(({ code, name }) => {
    let visited = 0;
    let total = 0;
    for (const cid of countryIds) {
      const node = index.nodes[cid];
      if (!node || CONTINENT_CODE[node.continent ?? ''] !== code) continue;
      total++;
      const st = eff.get(cid);
      if (st === 'visited' || st === 'lived') visited++;
    }
    return { code, name, visited, total };
  });

  const empty =
    Object.keys(states).length === 0 && ws.visited === 0 && ws.partial === 0;

  return {
    world: {
      visited: ws.visited,
      total: ws.total,
      percent,
      partial: ws.partial,
      continentsVisited: visitedContinentCodes.size,
      continentTotal: CONTINENTS.length,
      visitedContinentCodes,
      regionsVisited,
    },
    flagship,
    countries,
    glance,
    wishlist,
    transit,
    continents: continentRows,
    empty,
  };
}
