import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { geoMercator, geoPath, type GeoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import { select } from 'd3-selection';
import 'd3-transition';
import { cn } from '@/lib/utils';
import type { AtlasFeature, EffectiveState } from './types';
import { featureId } from './data';
import { STATE_LABEL } from './effective';

export interface MapCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitRegion: () => void;
  panBy: (dx: number, dy: number) => void;
  /** Screen-space centroid of a feature in the current view */
  centroidOf: (id: string) => { x: number; y: number } | null;
}

export interface FitInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface MapCanvasProps {
  /** Changes trigger the fit-to-region flight */
  viewKey: string;
  features: AtlasFeature[];
  context: AtlasFeature | null;
  dimmed: AtlasFeature[];
  getState: (id: string) => EffectiveState;
  isFullyExplored: (id: string) => boolean;
  selectedId: string | null;
  hoveredId: string | null;
  highlightId: string | null;
  loadingFeatureId?: string | null;
  /** Render labels for every feature (dense views label hover/selection only) */
  showAllLabels: boolean;
  reducedMotion: boolean;
  fitInset: FitInset;
  onHoverFeature: (f: AtlasFeature | null, pos: { x: number; y: number } | null) => void;
  onActivateFeature: (f: AtlasFeature) => void;
  onMarkFeature: (f: AtlasFeature) => void;
  onGesture: (active: boolean) => void;
  className?: string;
}

const FLIGHT_MS = 280;

function isAntarctica(f: AtlasFeature): boolean {
  const p = (f.properties ?? {}) as Record<string, unknown>;
  const id = featureId(f);
  return id === 'ATA' || id === 'AQ' || p.name === 'Antarctica' || p.NAME === 'Antarctica';
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

type PathGen = GeoPath<unknown, GeoPermissibleObjects>;

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(props, ref) {
  const {
    viewKey, features, context, dimmed, getState, isFullyExplored,
    selectedId, hoveredId, highlightId, loadingFeatureId, showAllLabels,
    reducedMotion, fitInset, onHoverFeature, onActivateFeature, onMarkFeature, onGesture,
    className,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const projRef = useRef<GeoProjection>(geoMercator());
  const pathRef = useRef<PathGen>(geoPath(projRef.current) as unknown as PathGen);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef(zoomIdentity);
  const rafRef = useRef(0);
  const [tick, bump] = useReducer((x: number) => x + 1, 0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const gestureTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setProjection = useCallback((proj: GeoProjection) => {
    projRef.current = proj;
    pathRef.current = geoPath(proj) as unknown as PathGen;
  }, []);

  /* ── sizing ─────────────────────────────────────────────── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (Math.abs(rect.width - sizeRef.current.w) > 1 || Math.abs(rect.height - sizeRef.current.h) > 1) {
        sizeRef.current = { w: rect.width, h: rect.height };
        bump();
      }
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    sizeRef.current = { w: rect.width, h: rect.height };
    bump();
    return () => ro.disconnect();
  }, []);

  /* ── zoom / pan ─────────────────────────────────────────── */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 14])
      .clickDistance(4)
      .on('start', () => {
        if (gestureTimeout.current) clearTimeout(gestureTimeout.current);
        onGesture(true);
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        transformRef.current = event.transform;
        gRef.current?.setAttribute('transform', event.transform.toString());
      })
      .on('end', () => {
        gestureTimeout.current = setTimeout(() => onGesture(false), 80);
      });
    zoomRef.current = behavior;
    select(svg).call(behavior);
    return () => {
      select(svg).on('.zoom', null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetTransform = useCallback((animate: boolean) => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!svg || !behavior) return;
    const sel = select(svg);
    if (animate && !reducedMotion) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sel.transition().duration(200) as any).call(behavior.transform, zoomIdentity);
    } else {
      sel.call(behavior.transform, zoomIdentity);
    }
  }, [reducedMotion]);

  /* ── fit & flight ───────────────────────────────────────── */
  const computeFit = useCallback((): GeoProjection => {
    const { w, h } = sizeRef.current;
    const proj = geoMercator();
    if (w < 10 || h < 10) return proj;
    let target: GeoPermissibleObjects | null = context;
    if (!target) {
      const fitFeatures = features.filter((f) => !isAntarctica(f));
      if (fitFeatures.length === 0 && features.length === 0) return proj; // no geometry yet
      target = {
        type: 'FeatureCollection',
        features: (fitFeatures.length > 0 ? fitFeatures : features) as GeoJSON.Feature[],
      } as GeoPermissibleObjects;
    }
    const x0 = fitInset.left + 16;
    const y0 = fitInset.top + 16;
    const x1 = Math.max(x0 + 40, w - fitInset.right - 16);
    const y1 = Math.max(y0 + 40, h - fitInset.bottom - 16);
    proj.fitExtent([[x0, y0], [x1, y1]], target);
    return proj;
  }, [context, features, fitInset]);

  const fittedOnce = useRef(false);
  const w = sizeRef.current.w;
  const h = sizeRef.current.h;
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (w < 10 || h < 10) return;
    // Nothing to fit yet — fitting an empty FeatureCollection yields a NaN
    // projection, and a NaN `fromK` would poison the flight interpolation
    // permanently. Wait for real geometry instead.
    if (!context && features.length === 0) return;
    const target = computeFit();
    if (!Number.isFinite(target.scale()) || !Number.isFinite(target.translate()[0])) return;
    const fromK = projRef.current.scale();
    const fromT = projRef.current.translate();
    if (reducedMotion || !fittedOnce.current || !Number.isFinite(fromK) || !Number.isFinite(fromT[0]) || !Number.isFinite(fromT[1])) {
      setProjection(target);
      fittedOnce.current = true;
      resetTransform(false);
      bump();
      return;
    }
    const toK = target.scale();
    const toT = target.translate();
    if (Math.abs(fromK - toK) < 0.5 && Math.abs(fromT[0] - toT[0]) < 0.5 && Math.abs(fromT[1] - toT[1]) < 0.5) {
      setProjection(target);
      bump();
      return;
    }
    resetTransform(false);
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / FLIGHT_MS);
      const e = easeOutCubic(p);
      setProjection(
        geoMercator()
          .scale(fromK + (toK - fromK) * e)
          .translate([fromT[0] + (toT[0] - fromT[0]) * e, fromT[1] + (toT[1] - fromT[1]) * e]),
      );
      bump();
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, computeFit, w, h]);

  /* ── imperative controls ────────────────────────────────── */
  const centroidOf = useCallback((id: string) => {
    const f = features.find((ft) => featureId(ft) === id);
    if (!f) return null;
    const c = pathRef.current.centroid(f);
    if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
    const t = transformRef.current;
    return { x: t.applyX(c[0]), y: t.applyY(c[1]) };
  }, [features]);

  useImperativeHandle(ref, () => ({
    zoomIn() {
      const svg = svgRef.current;
      const behavior = zoomRef.current;
      if (!svg || !behavior) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (select(svg).transition().duration(200) as any).call(behavior.scaleBy, 1.6);
    },
    zoomOut() {
      const svg = svgRef.current;
      const behavior = zoomRef.current;
      if (!svg || !behavior) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (select(svg).transition().duration(200) as any).call(behavior.scaleBy, 1 / 1.6);
    },
    fitRegion() {
      resetTransform(true);
    },
    panBy(dx: number, dy: number) {
      const svg = svgRef.current;
      const behavior = zoomRef.current;
      if (!svg || !behavior) return;
      select(svg).call(behavior.translateBy, dx, dy);
    },
    centroidOf,
  }), [centroidOf, resetTransform]);

  /* ── interactions ───────────────────────────────────────── */
  const centroidPos = useCallback((f: AtlasFeature) => {
    const c = pathRef.current.centroid(f);
    if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) return { x: 0, y: 0 };
    const t = transformRef.current;
    return { x: t.applyX(c[0]), y: t.applyY(c[1]) };
  }, []);

  const onLongPressStart = (f: AtlasFeature) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      onMarkFeature(f);
      setTimeout(() => { suppressClick.current = false; }, 350);
    }, 550);
  };
  const onLongPressCancel = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const fillFor = (id: string): string => {
    const state = getState(id);
    if (state === 'wishlist') return 'url(#atlas-hatch)';
    if (state === 'partial') return isFullyExplored(id) ? 'var(--state-visited)' : 'url(#atlas-dots)';
    switch (state) {
      case 'visited': return 'var(--state-visited)';
      case 'lived': return 'var(--state-lived)';
      case 'transit': return 'var(--state-transit)';
      default: return 'var(--state-none-fill)';
    }
  };

  const strokeFor = (id: string): { stroke: string; width: number; dash?: string } => {
    const state = getState(id);
    switch (state) {
      case 'visited': return { stroke: 'var(--state-visited-stroke)', width: 1.5 };
      case 'lived': return { stroke: 'var(--state-lived-stroke)', width: 1.5 };
      case 'transit': return { stroke: 'var(--state-transit-stroke)', width: 1.5 };
      case 'wishlist': return { stroke: 'var(--state-wishlist-hatch)', width: 1.2, dash: '4 3' };
      case 'partial':
        return isFullyExplored(id)
          ? { stroke: 'var(--state-visited-stroke)', width: 1.5 }
          : { stroke: 'var(--state-partial-stroke)', width: 1 };
      default: return { stroke: 'var(--hairline-strong)', width: 0.7 };
    }
  };

  const labels = useMemo(() => {
    const out: Array<{ id: string; x: number; y: number; name: string }> = [];
    for (const f of features) {
      const id = featureId(f);
      if (id == null) continue;
      const emph = id === hoveredId || id === selectedId || id === highlightId;
      if (!showAllLabels && !emph) continue;
      const name = (f.properties as Record<string, unknown> | null)?.name;
      if (typeof name !== 'string' || !name) continue;
      const c = pathRef.current.centroid(f);
      if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
      out.push({ id, x: c[0], y: c[1], name });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, showAllLabels, hoveredId, selectedId, highlightId, tick]);

  return (
    <div ref={containerRef} className={cn('absolute inset-0 overflow-hidden bg-paper', className)}>
      <svg
        ref={svgRef}
        className="w-full h-full block touch-none select-none"
        role="application"
        aria-label="Interactive travel map. Use the region list to navigate by keyboard."
      >
        <defs>
          <pattern id="atlas-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--state-wishlist)" fillOpacity="0.55" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--state-wishlist-hatch)" strokeWidth="1" />
          </pattern>
          <pattern id="atlas-dots" width="7" height="7" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill="var(--state-partial)" />
            <circle cx="1.5" cy="1.5" r="1.2" fill="var(--state-partial-stroke)" />
            <circle cx="5" cy="5" r="1.2" fill="var(--state-partial-stroke)" />
          </pattern>
        </defs>
        <g ref={gRef}>
          {/* dimmed sibling context (non-interactive) */}
          {dimmed.map((f, i) => (
            <path
              key={`dim-${featureId(f) ?? i}`}
              d={pathRef.current(f) ?? undefined}
              fill="var(--paper-sunken)"
              fillOpacity={0.6}
              stroke="var(--hairline)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
          {/* parent boundary context outline */}
          {context && (
            <path
              d={pathRef.current(context) ?? undefined}
              className={cn(featureId(context) === highlightId ? 'atlas-highlight' : undefined)}
              fill="none"
              stroke="var(--ink-faint)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {/* current level regions */}
          {features.map((f) => {
            const id = featureId(f);
            if (id == null) return null;
            const st = strokeFor(id);
            const hovered = hoveredId === id;
            const selected = selectedId === id;
            const highlighted = highlightId === id;
            const loading = loadingFeatureId === id;
            const name = String((f.properties as Record<string, unknown> | null)?.name ?? id);
            return (
              <path
                key={id}
                d={pathRef.current(f) ?? undefined}
                className={cn(
                  'atlas-region',
                  hovered && 'atlas-region-hover',
                  selected && 'atlas-region-selected',
                  highlighted && 'atlas-highlight',
                  loading && 'atlas-loading-region',
                )}
                fill={fillFor(id)}
                stroke={st.stroke}
                strokeWidth={st.width}
                strokeDasharray={st.dash}
                vectorEffect="non-scaling-stroke"
                tabIndex={0}
                role="button"
                aria-label={`${name}, ${STATE_LABEL[getState(id)]}`}
                onMouseEnter={() => onHoverFeature(f, centroidPos(f))}
                onMouseLeave={() => onHoverFeature(null, null)}
                onClick={() => {
                  if (suppressClick.current) return;
                  onActivateFeature(f);
                }}
                onPointerDown={onLongPressStart(f)}
                onPointerUp={onLongPressCancel}
                onPointerMove={onLongPressCancel}
                onPointerCancel={onLongPressCancel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onActivateFeature(f);
                  } else if (e.key === ' ') {
                    e.preventDefault();
                    onMarkFeature(f);
                  }
                }}
              />
            );
          })}
          {/* labels */}
          <g pointerEvents="none" aria-hidden="true">
            {labels.map((l) => (
              <text
                key={l.id}
                x={l.x}
                y={l.y}
                textAnchor="middle"
                fontSize={11}
                fill="var(--ink-soft)"
                stroke="var(--paper)"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
              >
                {l.name}
              </text>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
});

export default MapCanvas;
