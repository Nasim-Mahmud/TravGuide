import type { Feature, Geometry, GeoJsonProperties } from 'geojson';

/** States explicitly stored in visits.json / localStorage */
export type StoredVisitState = 'visited' | 'wishlist' | 'transit' | 'lived';

/** Display state: stored states + derived 'partial' + implicit 'none' */
export type EffectiveState = StoredVisitState | 'partial' | 'none';

export interface VisitEntry {
  state: StoredVisitState;
  note?: string;
}

export interface VisitsFile {
  version: number;
  updated?: string;
  states: Record<string, VisitEntry>;
}

export interface AtlasNode {
  id: string;
  name: string;
  localName?: string;
  slug: string;
  /** -1 = world root, 0 = country, 1..3 = sub-country levels */
  level: number;
  parent: string | null;
  children: string[];
  aliases: string[];
  /** ISO3 of the owning country (countries point to themselves) */
  country?: string;
  continent?: string;
  bbox?: [number, number, number, number];
}

export interface CountryMeta {
  /** Display names for sub-country levels, e.g. ["Division","District","Upazila"] */
  levels: string[];
  maxLevel: number;
  totals: Record<number, number>;
  continent?: string;
  levelFiles?: Record<number, string>;
}

export interface AtlasIndex {
  root: string;
  nodes: Record<string, AtlasNode>;
  countries: Record<string, CountryMeta>;
}

export type AtlasFeature = Feature<Geometry, GeoJsonProperties> & { id?: string | number };

export interface ViewData {
  node: AtlasNode;
  /** Features of the node's children (the rendered level) */
  features: AtlasFeature[];
  /** The node's own boundary from the parent level (dashed context outline) */
  context: AtlasFeature | null;
  /** The node's siblings from the parent level (dimmed, non-interactive) */
  dimmed: AtlasFeature[];
}

export interface ChildrenStats {
  total: number;
  visited: number; // visited + lived ("been there")
  lived: number;
  transit: number;
  wishlist: number;
  partial: number;
  none: number;
  fullyExplored: boolean;
}
