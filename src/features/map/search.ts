import MiniSearch from 'minisearch';
import type { AtlasIndex, AtlasNode } from './types';

export interface SearchResult {
  node: AtlasNode;
  /** Hierarchical label, e.g. "Dhaka Division · Bangladesh" */
  context: string;
  /** Display level name, e.g. "District" */
  levelName: string;
  /** Matched alias (shown in parentheses) when the match came via an alias */
  matchedAlias?: string;
  score: number;
}

interface Doc {
  id: string;
  name: string;
  aliases: string;
  localName: string;
  parentName: string;
  countryName: string;
}

let cached: { index: AtlasIndex; ms: MiniSearch<Doc> } | null = null;

function getMiniSearch(index: AtlasIndex): MiniSearch<Doc> {
  if (cached && cached.index === index) return cached.ms;
  const ms = new MiniSearch<Doc>({
    fields: ['name', 'aliases', 'localName', 'parentName', 'countryName'],
    storeFields: ['id'],
    searchOptions: {
      boost: { name: 3, aliases: 2 },
      prefix: true,
      fuzzy: 0.15,
    },
  });
  const docs: Doc[] = [];
  for (const node of Object.values(index.nodes)) {
    if (node.level < 0) continue; // skip the synthetic world root
    const parent = node.parent ? index.nodes[node.parent] : null;
    const country = node.country ? index.nodes[node.country] : null;
    docs.push({
      id: node.id,
      name: node.name,
      aliases: node.aliases.join(' '),
      localName: node.localName ?? '',
      parentName: parent && parent.level >= 0 ? parent.name : '',
      countryName: country && country.id !== node.id ? country.name : '',
    });
  }
  ms.addAll(docs);
  cached = { index, ms };
  return ms;
}

export function levelNameFor(index: AtlasIndex, node: AtlasNode): string {
  if (node.level === -1) return 'World';
  if (node.level === 0) return 'Country';
  const meta = node.country ? index.countries[node.country] : undefined;
  return meta?.levels[node.level - 1] ?? `Level ${node.level}`;
}

export function contextFor(index: AtlasIndex, node: AtlasNode): string {
  const parts: string[] = [];
  let cur = node.parent ? index.nodes[node.parent] : null;
  while (cur && cur.level >= 0) {
    parts.unshift(cur.name);
    cur = cur.parent ? index.nodes[cur.parent] : null;
  }
  return parts.join(' · ');
}

export function searchNodes(index: AtlasIndex, query: string, limit = 12): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const ms = getMiniSearch(index);
  const raw = ms.search(q);
  const out: SearchResult[] = [];
  for (const r of raw.slice(0, limit * 2)) {
    const node = index.nodes[r.id as string];
    if (!node) continue;
    const ql = q.toLowerCase();
    const matchedAlias = !node.name.toLowerCase().includes(ql)
      ? node.aliases.find((a) => a.toLowerCase().includes(ql))
      : undefined;
    out.push({
      node,
      context: contextFor(index, node),
      levelName: levelNameFor(index, node),
      matchedAlias,
      score: r.score,
    });
    if (out.length >= limit) break;
  }
  return out;
}
