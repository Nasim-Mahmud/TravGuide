import { normalizeIndex } from '@/features/map/data';
import type { AtlasIndex, AtlasNode, CountryMeta } from '@/features/map/types';

/**
 * The shipped /data/index.json is a NESTED tree (root node object + a
 * `countries` dict whose children are full node objects), while
 * features/map/data.ts `normalizeIndex` targets a flat `nodes` dict.
 * This loader understands both: it delegates to `normalizeIndex` when a flat
 * `nodes` map is present and otherwise flattens the nested tree into the same
 * `AtlasIndex` shape so `buildEffectiveIndex` / `nodeUrl` can be reused
 * unchanged. Nothing under features/map is modified.
 */

export interface StatsHierarchy {
  index: AtlasIndex;
  /** ISO3 country id -> ISO2 code (for flag emoji); '' when unknown */
  iso2: Record<string, string>;
}

interface NestedNode {
  id?: string;
  name?: string;
  localName?: string;
  slug?: string;
  level?: number;
  parent?: string | null;
  children?: Array<string | NestedNode>;
  aliases?: string[];
  continent?: string;
  iso2?: string;
  meta?: {
    levels?: Array<string | { name?: string }>;
    totals?: Record<string, number>;
    files?: Record<string, string>;
  };
}

interface NestedIndex {
  root?: NestedNode & { children?: Array<string | NestedNode> };
  countries?: Record<string, NestedNode>;
  nodes?: Record<string, unknown>;
}

/** Minimal ISO3 -> ISO2 fallback for the few countries missing `iso2`. */
const ISO3_TO_ISO2: Record<string, string> = {
  FRA: 'FR',
  NOR: 'NO',
  KOS: 'XK',
  CYN: 'CY',
  SOL: 'SB',
};

/**
 * Canonical continent names. Natural Earth's "Seven seas (open ocean)"
 * bucket (French Southern and Antarctic Lands) is folded into Antarctica so
 * the world always resolves to the seven design.md continents.
 */
export function canonicalContinent(name?: string | null): string | undefined {
  if (!name) return undefined;
  if (name === 'Seven seas (open ocean)') return 'Antarctica';
  return name;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Totals come keyed as "level1"/"level2"… or plain "1"/"2" — accept both. */
function parseLevelKey(key: string): number | null {
  const m = /(\d+)/.exec(key);
  return m ? Number(m[1]) : null;
}

function flattenNested(raw: NestedIndex): StatsHierarchy {
  const nodes: Record<string, AtlasNode> = {};
  const countries: Record<string, CountryMeta> = {};
  const iso2: Record<string, string> = {};

  const countryTrees = raw.countries ?? {};
  const rootRaw = raw.root ?? {};
  const rootId = rootRaw.id ?? 'WORLD';
  const rootChildren: string[] = [];
  for (const c of rootRaw.children ?? []) {
    if (typeof c === 'string') rootChildren.push(c);
    else if (c && typeof c.id === 'string') rootChildren.push(c.id);
  }
  if (rootChildren.length === 0) rootChildren.push(...Object.keys(countryTrees));

  nodes[rootId] = {
    id: rootId,
    name: rootRaw.name ?? 'World',
    slug: rootRaw.slug ?? 'world',
    level: -1,
    parent: null,
    children: rootChildren,
    aliases: [],
  };

  const visit = (rn: NestedNode, id: string, parentId: string, countryId: string) => {
    const childIds: string[] = [];
    const childTrees: NestedNode[] = [];
    for (const c of rn.children ?? []) {
      if (typeof c === 'string') childIds.push(c);
      else if (c && typeof c === 'object') {
        const cid = c.id ?? '';
        if (cid) {
          childIds.push(cid);
          childTrees.push(c);
        }
      }
    }
    const level = typeof rn.level === 'number' ? rn.level : 0;
    nodes[id] = {
      id,
      name: rn.name ?? id,
      localName: rn.localName,
      slug: rn.slug ?? (level <= 0 ? id.toLowerCase() : slugify(rn.name ?? id)),
      level,
      parent: parentId,
      children: childIds,
      aliases: rn.aliases ?? [],
      country: countryId,
      continent: canonicalContinent(rn.continent),
    };
    for (const child of childTrees) {
      visit(child, child.id ?? '', id, countryId);
    }
  };

  for (const [iso, tree] of Object.entries(countryTrees)) {
    const id = tree.id ?? iso;
    visit(tree, id, rootId, id);
    const code = tree.iso2 ?? ISO3_TO_ISO2[id] ?? '';
    if (code) iso2[id] = code;

    const meta = tree.meta ?? {};
    const levels = (meta.levels ?? [])
      .map((l) => (typeof l === 'string' ? l : (l?.name ?? '')))
      .filter(Boolean);
    const totals: Record<number, number> = {};
    for (const [k, v] of Object.entries(meta.totals ?? {})) {
      const lvl = parseLevelKey(k);
      if (lvl != null && typeof v === 'number') totals[lvl] = v;
    }
    const levelFiles: Record<number, string> = {};
    for (const [k, v] of Object.entries(meta.files ?? {})) {
      const lvl = parseLevelKey(k);
      if (lvl != null && typeof v === 'string') levelFiles[lvl] = v;
    }
    countries[id] = {
      levels,
      maxLevel: levels.length,
      totals,
      continent: canonicalContinent(tree.continent),
      levelFiles: Object.keys(levelFiles).length ? levelFiles : undefined,
    };
  }

  // Stub any root children that lack a country tree (keeps totals honest)
  for (const cid of rootChildren) {
    if (!nodes[cid]) {
      nodes[cid] = {
        id: cid,
        name: cid,
        slug: cid.toLowerCase(),
        level: 0,
        parent: rootId,
        children: [],
        aliases: [],
        country: cid,
      };
    }
  }

  return { index: { root: rootId, nodes, countries }, iso2 };
}

let cache: Promise<StatsHierarchy> | null = null;

export function loadStatsHierarchy(): Promise<StatsHierarchy> {
  if (!cache) {
    cache = fetch('/data/index.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load index.json (${res.status})`);
        return res.json() as Promise<NestedIndex>;
      })
      .then((raw) => {
        // Flat format (future data revisions): reuse the map's normalizer.
        if (raw && typeof raw === 'object' && raw.nodes && Object.keys(raw.nodes).length > 0) {
          return { index: normalizeIndex(raw as never), iso2: {} };
        }
        return flattenNested(raw);
      });
    // Allow retry after a failure
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}
