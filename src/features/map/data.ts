import { feature as topoFeature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { AtlasFeature, AtlasIndex, AtlasNode, CountryMeta, VisitsFile } from './types';

const DATA_BASE = '/data/';

/* ────────────────────────────────────────────────────────────
   Raw shapes — tolerant of both the shipped index.json contract
   (nodes with children[] + per-country meta) and the plan §10.1
   sketch (childCount + levelNames on country nodes).
   ──────────────────────────────────────────────────────────── */

interface RawNode {
  id?: string;
  name?: string;
  localName?: string;
  slug?: string;
  level?: number;
  parent?: string | null;
  children?: Array<string | { id?: string } & Record<string, unknown>>;
  childCount?: number;
  aliases?: string[];
  country?: string;
  continent?: string;
  iso3?: string;
  bbox?: [number, number, number, number];
  levelNames?: string[];
  maxLevel?: number;
  totals?: Record<string, number>;
  levelFiles?: Record<string, string>;
}

interface RawCountryMeta {
  levels?: Array<string | { name?: string }>;
  levelNames?: string[];
  totals?: Record<string, number>;
  continent?: string;
  maxLevel?: number;
  files?: Record<string, string>;
  levelFiles?: Record<string, string>;
}

interface RawShippedNode extends Omit<RawNode, 'children'> {
  meta?: RawCountryMeta;
  children?: Array<string | RawShippedNode>;
}

interface RawIndex {
  root?: string | (RawShippedNode & { file?: string; hiFile?: string });
  nodes?: Record<string, RawNode>;
  meta?: Record<string, RawCountryMeta>;
  countries?: Record<string, RawCountryMeta & RawShippedNode>;
}

/**
 * The shipped `index.json` is a NESTED tree (`root` object + `countries`
 * dict whose nodes carry full child node objects and a per-country `meta`
 * block). The normalizer below works on a flat `nodes` dict — this converts
 * the shipped shape into that flat shape first.
 */
function flattenShippedIndex(raw: RawIndex): RawIndex {
  const rootRaw = raw.root;
  const rootObj = rootRaw && typeof rootRaw === 'object' ? rootRaw : null;
  const hasNestedCountries = Object.values(raw.countries ?? {}).some(
    (c) => c && typeof c === 'object' && Array.isArray((c as RawShippedNode).children),
  );
  if (raw.nodes || (!rootObj && !hasNestedCountries)) return raw;

  const nodes: Record<string, RawNode> = {};
  const meta: Record<string, RawCountryMeta> = {};

  type RawChild = NonNullable<RawNode['children']>[number];
  const visit = (rn: RawShippedNode, fallbackId?: string): string => {
    const id = rn.id ?? fallbackId ?? '';
    const children: RawChild[] = (rn.children ?? []).map((c): RawChild => {
      if (typeof c === 'string') return c;
      const cid = c.id ?? '';
      if (cid) visit(c, cid);
      return { id: cid } as RawChild;
    });
    const { children: _nested, meta: _meta, ...rest } = rn;
    nodes[id] = { ...rest, id, children };
    return id;
  };

  if (rootObj) visit(rootObj, rootObj.id ?? 'WORLD');
  for (const [iso, c] of Object.entries(raw.countries ?? {})) {
    if (!c || typeof c !== 'object') continue;
    if (c.meta) meta[c.id ?? iso] = c.meta;
    visit(c, iso);
  }

  return { root: rootObj ? (rootObj.id ?? 'WORLD') : 'WORLD', nodes, meta };
}

const jsonCache = new Map<string, Promise<unknown>>();

function fetchJson(url: string): Promise<unknown> {
  let p = jsonCache.get(url);
  if (!p) {
    p = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
      return res.json();
    });
    jsonCache.set(url, p);
    // Allow retry after a failure: evict rejected promises from the cache
    p.catch(() => jsonCache.delete(url));
  }
  return p;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function normalizeIndex(input: RawIndex): AtlasIndex {
  const raw = flattenShippedIndex(input);
  const rawNodes = raw.nodes ?? {};
  const nodes: Record<string, AtlasNode> = {};

  for (const [key, rn] of Object.entries(rawNodes)) {
    const id = rn.id ?? key;
    const name = rn.name ?? id;
    const children: string[] = [];
    for (const c of rn.children ?? []) {
      if (typeof c === 'string') children.push(c);
      else if (c && typeof c === 'object' && typeof c.id === 'string') children.push(c.id);
    }
    const level = typeof rn.level === 'number' ? rn.level : 0;
    nodes[id] = {
      id,
      name,
      localName: rn.localName,
      slug: rn.slug ?? (level <= 0 ? id.toLowerCase() : slugify(name)),
      level,
      parent: rn.parent ?? null,
      children,
      aliases: rn.aliases ?? [],
      country: rn.country ?? (level === 0 ? id : undefined),
      continent: rn.continent,
      bbox: rn.bbox,
    };
  }

  // Infer parent/children links when only one direction is provided
  for (const node of Object.values(nodes)) {
    if (node.parent && nodes[node.parent] && !nodes[node.parent].children.includes(node.id)) {
      nodes[node.parent].children.push(node.id);
    }
    for (const cid of node.children) {
      if (nodes[cid] && !nodes[cid].parent) nodes[cid].parent = node.id;
    }
  }

  // Propagate the owning country down the tree (index.json may only set it
  // on some levels)
  for (const node of Object.values(nodes)) {
    if (node.level > 0 && !node.country) {
      let cur = node.parent ? nodes[node.parent] : undefined;
      let guard = 0;
      while (cur && guard++ < 10) {
        if (cur.level === 0) {
          node.country = cur.id;
          break;
        }
        cur = cur.parent ? nodes[cur.parent] : undefined;
      }
    }
  }

  const rootKey = typeof raw.root === 'string' ? raw.root : undefined;
  const rootId = rootKey && nodes[rootKey]
    ? rootKey
    : nodes['WORLD'] ? 'WORLD' : nodes['world'] ? 'world' : (Object.values(nodes).find((n) => n.level === -1)?.id ?? 'WORLD');

  // Country metadata (level names, totals, files) from meta blocks or country nodes
  const countries: Record<string, CountryMeta> = {};
  const rawMeta = raw.meta ?? {};
  // Keys may be "1" or "level1" — extract the trailing level number
  const levelKeyOf = (k: string): number | null => {
    const m = /(\d+)\s*$/.exec(k);
    return m ? Number(m[1]) : null;
  };
  for (const node of Object.values(nodes)) {
    if (node.level !== 0) continue;
    const rn = rawNodes[node.id] ?? {};
    const cm = rawMeta[node.id] ?? {};
    const levels = (cm.levels ?? cm.levelNames ?? rn.levelNames ?? []).map((l) =>
      typeof l === 'string' ? l : (l?.name ?? ''),
    ).filter(Boolean);
    const totalsRaw = cm.totals ?? rn.totals ?? {};
    const totals: Record<number, number> = {};
    for (const [k, v] of Object.entries(totalsRaw)) {
      const lk = levelKeyOf(k);
      if (lk != null) totals[lk] = v;
    }
    const levelFilesRaw = cm.levelFiles ?? cm.files ?? rn.levelFiles ?? {};
    const levelFiles: Record<number, string> = {};
    for (const [k, v] of Object.entries(levelFilesRaw)) {
      const lk = levelKeyOf(k);
      if (lk != null) levelFiles[lk] = v;
    }
    const maxLevel = cm.maxLevel ?? rn.maxLevel ?? levels.length;
    countries[node.id] = {
      levels,
      maxLevel,
      totals,
      continent: cm.continent ?? node.continent,
      levelFiles: Object.keys(levelFiles).length ? levelFiles : undefined,
    };
    if (!node.country) node.country = node.id;
    if (!node.continent) node.continent = cm.continent;
  }

  return { root: rootId, nodes, countries };
}

export function loadIndex(): Promise<AtlasIndex> {
  return fetchJson(`${DATA_BASE}index.json`).then((raw) => normalizeIndex(raw as RawIndex));
}

export async function loadVisitsSeed(): Promise<VisitsFile> {
  try {
    const raw = (await fetchJson(`${DATA_BASE}my/visits.json`)) as Partial<VisitsFile>;
    return { version: raw.version ?? 1, updated: raw.updated, states: raw.states ?? {} };
  } catch {
    // A missing seed file is fine — the owner simply has no recorded visits yet
    return { version: 1, states: {} };
  }
}

/* ────────────────────────────────────────────────────────────
   Geometry loading
   ──────────────────────────────────────────────────────────── */

export const WORLD_TOPO_URL = `${DATA_BASE}world/adm0.topojson`;

/**
 * Resolve the TopoJSON file holding the given level of a country.
 * Prefers explicit levelFiles from the index; falls back to the
 * repository layout contract (/data/adm1/{ISO3}, /data/bgd/…).
 */
export function levelFileFor(index: AtlasIndex, countryId: string, level: number): string {
  const explicit = index.countries[countryId]?.levelFiles?.[level];
  if (explicit) return `${DATA_BASE}${explicit.replace(/^\/?data\//, '')}`;
  const iso = countryId.toUpperCase();
  if (level <= 0) return WORLD_TOPO_URL;
  if (iso === 'BGD') {
    if (level === 2) return `${DATA_BASE}bgd/adm2-districts.topojson`;
    if (level === 3) return `${DATA_BASE}bgd/adm3-upazilas.topojson`;
  }
  return `${DATA_BASE}adm${level}/${iso}.topojson`;
}

/** Extract a stable feature id matching index node ids. */
export function featureId(f: AtlasFeature): string | undefined {
  if (f.id != null) return String(f.id);
  const p = (f.properties ?? {}) as Record<string, unknown>;
  for (const key of ['id', 'pcode', 'PCODE', 'p_code', 'shapeID', 'ISO3', 'iso3', 'ADM0_A3', 'adm0_a3']) {
    const v = p[key];
    if (typeof v === 'string' || typeof v === 'number') return String(v);
  }
  return undefined;
}

function decodeTopo(topo: Topology): AtlasFeature[] {
  const objects = topo.objects ?? {};
  let best: GeometryCollection | null = null;
  for (const obj of Object.values(objects)) {
    if (obj.type === 'GeometryCollection') {
      const gc = obj as GeometryCollection;
      if (!best || gc.geometries.length > best.geometries.length) best = gc;
    }
  }
  if (!best) return [];
  const fc = topoFeature(topo, best);
  return (fc.type === 'FeatureCollection' ? fc.features : [fc]) as AtlasFeature[];
}

const featureCache = new Map<string, Promise<AtlasFeature[]>>();

export function loadFeatures(url: string): Promise<AtlasFeature[]> {
  let p = featureCache.get(url);
  if (!p) {
    p = fetchJson(url).then((raw) => decodeTopo(raw as Topology));
    featureCache.set(url, p);
    p.catch(() => featureCache.delete(url));
  }
  return p;
}

function countryOfNode(node: AtlasNode): string | undefined {
  if (node.level === 0) return node.id;
  return node.country ?? node.parent ?? undefined;
}

/**
 * Load everything a view of `node` needs:
 * children features (the rendered level) + context/siblings from the parent level.
 */
export async function loadView(index: AtlasIndex, node: AtlasNode): Promise<import('./types').ViewData> {
  const childLevel = node.level + 1;

  let features: AtlasFeature[] = [];
  if (node.level === -1) {
    features = await loadFeatures(WORLD_TOPO_URL);
  } else if (node.children.length > 0) {
    const countryId = countryOfNode(node);
    if (countryId) {
      const all = await loadFeatures(levelFileFor(index, countryId, childLevel));
      const wanted = new Set(node.children);
      features = all.filter((f) => {
        const fid = featureId(f);
        return fid != null && wanted.has(fid);
      });
      // If ids do not line up, fall back to rendering the whole file
      if (features.length === 0) features = all;
    }
  }

  let context: AtlasFeature | null = null;
  let dimmed: AtlasFeature[] = [];
  if (node.level >= 0) {
    try {
      const parentAll = node.level === 0
        ? await loadFeatures(WORLD_TOPO_URL)
        : await (async () => {
            const countryId = countryOfNode(node);
            return countryId ? loadFeatures(levelFileFor(index, countryId, node.level)) : [];
          })();
      const parent = node.parent ? index.nodes[node.parent] : null;
      const siblingIds = new Set(parent ? parent.children : []);
      context = parentAll.find((f) => featureId(f) === node.id) ?? null;
      dimmed = parentAll.filter((f) => {
        const fid = featureId(f);
        return fid != null && fid !== node.id && (siblingIds.size === 0 || siblingIds.has(fid));
      });
    } catch {
      // Context is decorative — never block the view on it
    }
  }

  return { node, features, context, dimmed };
}
