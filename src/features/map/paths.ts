import type { AtlasIndex, AtlasNode } from './types';

/** Ancestor chain from world root down to (and including) the node. */
export function nodeChain(index: AtlasIndex, nodeId: string): AtlasNode[] {
  const chain: AtlasNode[] = [];
  let cur: AtlasNode | undefined = index.nodes[nodeId];
  let guard = 0;
  while (cur && guard++ < 12) {
    chain.unshift(cur);
    cur = cur.parent ? index.nodes[cur.parent] : undefined;
  }
  return chain;
}

/** Canonical URL for a node: /map for world, /country/{iso}/{slug}/{slug}. */
export function nodeUrl(index: AtlasIndex, nodeId: string): string {
  const node = index.nodes[nodeId];
  if (!node || node.level === -1) return '/map';
  const chain = nodeChain(index, nodeId).filter((n) => n.level >= 0);
  const segs = chain.slice(0, 3).map((n) => (n.level === 0 ? n.id.toLowerCase() : n.slug));
  return `/country/${segs.join('/')}`;
}

/**
 * Resolve URL segments to a node. Country segment matches lowercase ISO3 or
 * slug; deeper segments match slugs within their parent.
 */
export function resolvePath(
  index: AtlasIndex,
  countryParam?: string,
  l1slug?: string,
  l2slug?: string,
): { node: AtlasNode | null; notFound: boolean } {
  const root = index.nodes[index.root];
  if (!root) return { node: null, notFound: true };
  if (!countryParam) return { node: root, notFound: false };

  const cp = countryParam.toLowerCase();
  const country = root.children
    .map((id) => index.nodes[id])
    .filter(Boolean)
    .find((n) => n.id.toLowerCase() === cp || n.slug === cp);
  if (!country) return { node: null, notFound: true };
  if (!l1slug) return { node: country, notFound: false };

  const l1 = country.children.map((id) => index.nodes[id]).filter(Boolean).find((n) => n.slug === l1slug);
  if (!l1) return { node: null, notFound: true };
  if (!l2slug) return { node: l1, notFound: false };

  const l2 = l1.children.map((id) => index.nodes[id]).filter(Boolean).find((n) => n.slug === l2slug);
  if (!l2) return { node: null, notFound: true };
  return { node: l2, notFound: false };
}

/** Pluralized, lower-cased level label for the children of a node ("districts"). */
export function childLevelLabel(index: AtlasIndex, node: AtlasNode): string {
  if (node.level === -1) return 'countries';
  const meta = node.country ? index.countries[node.country] : undefined;
  const name = meta?.levels[node.level] ?? `regions`;
  return `${name.toLowerCase()}s`;
}

export function childLevelName(index: AtlasIndex, node: AtlasNode): string {
  if (node.level === -1) return 'Country';
  const meta = node.country ? index.countries[node.country] : undefined;
  return meta?.levels[node.level] ?? 'Region';
}
