import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, WifiOff } from 'lucide-react';
import MapCanvas, { type MapCanvasHandle } from '@/features/map/MapCanvas';
import { featureId, loadView } from '@/features/map/data';
import { buildEffectiveIndex, STATE_LABEL } from '@/features/map/effective';
import { childLevelLabel, nodeChain, nodeUrl, resolvePath } from '@/features/map/paths';
import { contextFor } from '@/features/map/search';
import { useAtlasStore } from '@/features/map/store';
import type { AtlasFeature, AtlasNode, ViewData } from '@/features/map/types';
import BreadcrumbBar from '@/components/BreadcrumbBar';
import MapControls from '@/components/MapControls';
import MapLegend from '@/components/MapLegend';
import StatsChip from '@/components/StatsChip';
import Tooltip, { type MapTooltipData } from '@/components/Tooltip';
import NodePanel from '@/components/NodePanel';
import NodeSheet, { StatePickerSheet } from '@/components/NodeSheet';
import NotFoundCard from '@/components/NotFoundCard';
import { useIsMobileLayout, useReducedMotion } from '@/hooks/use-media-query';

/** Cache loaded views so back/forward navigation is instant */
const viewCache = new Map<string, ViewData>();

export default function MapPage() {
  const params = useParams<{ countryId?: string; l1slug?: string; l2slug?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobileLayout();
  const reducedMotion = useReducedMotion();
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

  const index = useAtlasStore((s) => s.index);
  const indexStatus = useAtlasStore((s) => s.indexStatus);
  const loadIndex = useAtlasStore((s) => s.loadIndex);
  const initStore = useAtlasStore((s) => s.init);
  const states = useAtlasStore((s) => s.states);
  const setState = useAtlasStore((s) => s.setState);
  const announce = useAtlasStore((s) => s.announce);
  const announcement = useAtlasStore((s) => s.announcement);

  const canvasRef = useRef<MapCanvasHandle>(null);
  const [view, setView] = useState<{ key: string; data: ViewData } | null>(null);
  const [viewStatus, setViewStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [retryKey, setRetryKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [panelClosed, setPanelClosed] = useState(false);
  const [pickerNodeId, setPickerNodeId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<MapTooltipData | null>(null);
  const [pulse, setPulse] = useState<{ x: number; y: number; key: number } | null>(null);
  const hoverIntent = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesturing = useRef(false);

  /* ── boot ───────────────────────────────────────────────── */
  useEffect(() => {
    void loadIndex();
    void initStore();
  }, [loadIndex, initStore]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  /* ── route resolution ───────────────────────────────────── */
  const resolution = useMemo(
    () => (index ? resolvePath(index, params.countryId, params.l1slug, params.l2slug) : null),
    [index, params.countryId, params.l1slug, params.l2slug],
  );
  const notFound = !!resolution && resolution.notFound;

  // Leaf URLs (a node with no children) show the parent view with the node selected
  const { viewNode, autoSelect } = useMemo((): { viewNode: AtlasNode | null; autoSelect: string | null } => {
    const node = resolution?.node ?? null;
    if (!index || !node) return { viewNode: null, autoSelect: null };
    if (node.level >= 0 && node.children.length === 0 && node.parent && index.nodes[node.parent]) {
      return { viewNode: index.nodes[node.parent], autoSelect: node.id };
    }
    return { viewNode: node, autoSelect: null };
  }, [index, resolution]);

  const selParam = searchParams.get('sel');

  /* ── view loading (lazy level fetch) ────────────────────── */
  const viewNodeId = viewNode?.id ?? null;
  useEffect(() => {
    if (!index || !viewNodeId || !viewNode) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && !viewCache.has(viewNodeId)) setViewStatus('loading');
    });
    const cached = viewCache.get(viewNodeId);
    const promise = cached ? Promise.resolve(cached) : loadView(index, viewNode);
    promise
      .then((data) => {
        if (cancelled) return;
        viewCache.set(viewNodeId, data);
        setView({ key: viewNodeId, data });
        setViewStatus('idle');
      })
      .catch(() => {
        if (!cancelled) setViewStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [index, viewNodeId, viewNode, retryKey]);

  /* ── selection lifecycle (render-time adjust on route change) ── */
  const sel = autoSelect ?? selParam;
  const validSel = sel && index?.nodes[sel] ? sel : null;
  const [prevSelKey, setPrevSelKey] = useState('');
  const selKey = `${viewNodeId ?? ''}|${validSel ?? ''}`;
  if (prevSelKey !== selKey) {
    setPrevSelKey(selKey);
    setSelectedId(validSel);
    setPanelClosed(false);
    if (validSel) setHighlightId(validSel);
  }
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 2600);
    return () => clearTimeout(t);
  }, [highlightId]);

  /* ── effective states ───────────────────────────────────── */
  const effective = useMemo(
    () => (index ? buildEffectiveIndex(index, states) : null),
    [index, states],
  );

  /* ── document title + drill announcement ────────────────── */
  useEffect(() => {
    if (!viewNode) return;
    document.title =
      viewNode.level === -1 ? 'Atlas — a personal travel atlas' : `${viewNode.name} — Atlas`;
  }, [viewNode]);

  const announcedView = useRef<string | null>(null);
  useEffect(() => {
    if (!index || !viewNode || !view || view.key !== viewNode.id) return;
    if (announcedView.current === viewNode.id) return;
    announcedView.current = viewNode.id;
    const count = view.data.features.length;
    announce(
      viewNode.level === -1
        ? `Now viewing the world, ${count} countries`
        : `Now viewing ${childLevelLabel(index, viewNode)} of ${viewNode.name}, ${count} regions`,
    );
  }, [index, viewNode, view, announce]);

  /* ── state-change pulse on canvas (store subscription) ──── */
  useEffect(() => {
    return useAtlasStore.subscribe((s, prev) => {
      if (s.lastChanged && s.lastChanged.seq !== prev.lastChanged?.seq) {
        const pos = canvasRef.current?.centroidOf(s.lastChanged.nodeId);
        if (pos) setPulse({ x: pos.x, y: pos.y, key: s.lastChanged.seq });
      }
    });
  }, []);
  useEffect(() => {
    if (!pulse) return;
    const t = setTimeout(() => setPulse(null), 520);
    return () => clearTimeout(t);
  }, [pulse]);

  /* ── interactions ───────────────────────────────────────── */
  const drillTo = useCallback(
    (id: string) => {
      if (!index) return;
      navigate(nodeUrl(index, id));
    },
    [index, navigate],
  );

  const activateFeature = useCallback(
    (f: AtlasFeature) => {
      if (!index) return;
      const id = featureId(f);
      if (id == null) return;
      const node = index.nodes[id];
      const hasChildren = !!node && node.children.length > 0;
      if (isMobile) {
        if (!hasChildren) {
          // Leaf regions: single tap opens the StatePicker directly
          setSelectedId(id);
          setPickerNodeId(id);
          return;
        }
        if (selectedId === id) {
          drillTo(id);
          return;
        }
        setSelectedId(id);
        setPanelClosed(false);
        return;
      }
      if (hasChildren) {
        drillTo(id);
      } else {
        setSelectedId(id);
        setPanelClosed(false);
      }
    },
    [index, isMobile, selectedId, drillTo],
  );

  const markFeature = useCallback(
    (f: AtlasFeature) => {
      const id = featureId(f);
      if (id == null) return;
      setSelectedId(id);
      if (isMobile) setPickerNodeId(id);
      else setPanelClosed(false);
    },
    [isMobile],
  );

  const onHoverFeature = useCallback(
    (f: AtlasFeature | null, pos: { x: number; y: number } | null) => {
      if (hoverIntent.current) clearTimeout(hoverIntent.current);
      if (!f || !pos || !index || !effective) {
        setHoveredId(null);
        setTooltip(null);
        return;
      }
      const id = featureId(f);
      if (id == null) return;
      setHoveredId(id);
      hoverIntent.current = setTimeout(() => {
        if (gesturing.current) return;
        const node = index.nodes[id];
        const state = effective.get(id);
        const name = node?.name ?? String((f.properties as Record<string, unknown> | null)?.name ?? id);
        let context: string | undefined;
        let hint: string | undefined;
        if (state === 'partial' && node) {
          const s = effective.stats(id);
          context = `${s.visited} of ${s.total} ${childLevelLabel(index, node)} visited`;
        } else if (node) {
          context = contextFor(index, node) || undefined;
        }
        if (!node || node.children.length === 0) hint = isMobile ? 'Tap to mark' : 'Click to mark';
        else hint = isMobile ? 'Tap again to view' : 'Click to drill down';
        setTooltip({ x: pos.x, y: pos.y, name, state, context, hint });
      }, 120);
    },
    [index, effective, isMobile],
  );

  const onGesture = useCallback((active: boolean) => {
    gesturing.current = active;
    if (active) setTooltip(null);
  }, []);

  /* ── keyboard shortcuts (+ / − / 0 / arrows) ────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const c = canvasRef.current;
      if (!c) return;
      if (e.key === '+' || e.key === '=') c.zoomIn();
      else if (e.key === '-' || e.key === '_') c.zoomOut();
      else if (e.key === '0') c.fitRegion();
      else if (e.key === 'ArrowUp') { e.preventDefault(); c.panBy(0, 80); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); c.panBy(0, -80); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); c.panBy(80, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); c.panBy(-80, 0); }
      else if (e.key === 'Escape') { setSelectedId(null); setPickerNodeId(null); setPanelClosed(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ── derived view model ─────────────────────────────────── */
  const panelNode: AtlasNode | null = useMemo(() => {
    if (!index || !viewNode) return null;
    if (selectedId && index.nodes[selectedId]) return index.nodes[selectedId];
    return viewNode.level >= 0 ? viewNode : null;
  }, [index, viewNode, selectedId]);

  const panelOpen = !!panelNode && !panelClosed && !!effective;

  const chain = useMemo(() => {
    if (!index || !viewNode) return [{ label: 'World', url: '/map' }];
    return nodeChain(index, viewNode.id).map((n) => ({
      label: n.level === -1 ? 'World' : n.name,
      url: nodeUrl(index, n.id),
    }));
  }, [index, viewNode]);

  const chip = useMemo(() => {
    if (!index || !viewNode || !effective) return null;
    if (viewNode.level === -1) {
      const ws = effective.worldStats();
      return {
        eyebrow: 'World',
        value: `${ws.visited} / ${ws.total}`,
        caption: ws.visited === 0 && ws.partial === 0
          ? 'countries — tap a place to begin'
          : `countries · ${ws.continents} / ${ws.continentTotal} continents`,
        progress: ws.total > 0 ? ws.visited / ws.total : 0,
      };
    }
    const s = effective.stats(viewNode.id);
    const label = childLevelLabel(index, viewNode);
    return {
      eyebrow: viewNode.name,
      value: `${s.visited} / ${s.total}`,
      caption: `${label} visited${s.partial > 0 ? ` · ${s.partial} partial` : ''}`,
      progress: s.total > 0 ? s.visited / s.total : 0,
    };
  }, [index, viewNode, effective]);

  const panelInsetRight = !isMobile && panelOpen ? 392 : 0;
  const sheetInsetBottom = isMobile && panelOpen ? Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.33) : 0;
  const fitInset = useMemo(
    () => ({ top: 48, right: panelInsetRight, bottom: sheetInsetBottom, left: 0 }),
    [panelInsetRight, sheetInsetBottom],
  );

  const showAllLabels = !!view && (viewNode?.level === -1 || view.data.features.length <= 70);
  const loadingFeatureId =
    viewStatus === 'loading' && view && viewNodeId && view.key !== viewNodeId ? viewNodeId : null;

  const pickerNode = pickerNodeId && index ? index.nodes[pickerNodeId] : null;

  /* ── boot / error gates ─────────────────────────────────── */
  if (indexStatus === 'error' && !index) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="atlas-card-lg p-8 max-w-sm text-center animate-fade-up">
          <AlertTriangle className="mx-auto text-danger" size={28} strokeWidth={1.5} />
          <h1 className="font-display text-display-lg text-ink mt-3">Couldn't load the atlas</h1>
          <p className="text-body-sm text-ink-soft mt-1">The geography index failed to load.</p>
          <button
            type="button"
            onClick={() => void loadIndex()}
            className="mt-4 h-10 px-5 rounded-sm bg-accent text-paper-raised text-label uppercase font-semibold hover:bg-accent-strong transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!index || !effective || !viewNode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-paper">
        <img src="/logo.svg" alt="" width={48} height={48} className={reducedMotion ? '' : 'animate-spin-slow'} />
        <p className="font-display font-medium text-2xl text-ink">Atlas</p>
        <div className="w-32 h-0.5 rounded-full bg-paper-sunken overflow-hidden">
          <div className="h-full w-1/2 bg-accent rounded-full animate-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-[calc(100dvh-120px)]">
      {/* map canvas */}
      <MapCanvas
        ref={canvasRef}
        viewKey={view?.key ?? viewNode.id}
        features={view?.data.features ?? []}
        context={view?.key === viewNode.id ? view.data.context : null}
        dimmed={view?.key === viewNode.id ? view.data.dimmed : []}
        getState={effective.get}
        isFullyExplored={(id) => effective.stats(id).fullyExplored}
        selectedId={selectedId}
        hoveredId={hoveredId}
        highlightId={highlightId}
        loadingFeatureId={loadingFeatureId}
        showAllLabels={showAllLabels}
        reducedMotion={reducedMotion}
        fitInset={fitInset}
        onHoverFeature={onHoverFeature}
        onActivateFeature={activateFeature}
        onMarkFeature={markFeature}
        onGesture={onGesture}
      />

      {/* level loading bar */}
      {viewStatus === 'loading' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 z-30 bg-paper-sunken overflow-hidden">
          <div className="h-full w-1/3 bg-accent animate-shimmer" />
        </div>
      )}

      {/* offline note */}
      {!isOnline && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 atlas-card px-3 py-1.5 flex items-center gap-2 text-body-sm text-ink-soft">
          <WifiOff size={14} /> You're offline — geography may not load
        </div>
      )}

      {/* state-change pulse */}
      {pulse && (
        <div key={pulse.key} className="absolute z-20 pointer-events-none" style={{ left: pulse.x, top: pulse.y }}>
          <div className="w-16 h-16 -ml-8 -mt-8 rounded-full border-2 border-accent animate-pulse-ring" />
        </div>
      )}

      {/* tooltip */}
      {tooltip && !isMobile && <Tooltip data={tooltip} />}

      {/* breadcrumb */}
      <BreadcrumbBar
        chain={chain}
        className="absolute z-30 left-2 right-2 top-2 lg:left-4 lg:right-auto lg:top-3 lg:max-w-[60%]"
      />

      {/* stats chip */}
      {chip && (
        <StatsChip
          {...chip}
          compact={isMobile}
          className="absolute z-30 left-2 top-14 lg:left-4 lg:top-auto lg:bottom-4"
        />
      )}

      {/* legend */}
      <MapLegend mobile={isMobile} className="absolute z-30 left-2 bottom-3 lg:left-4 lg:bottom-[132px]" />

      {/* controls */}
      <MapControls
        className="absolute z-30 right-2 lg:right-4 bottom-[116px] lg:bottom-4"
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFitRegion={() => canvasRef.current?.fitRegion()}
        onResetWorld={() => navigate('/map')}
      />

      {/* node panel (desktop) / sheet (mobile) */}
      {!isMobile && effective && panelNode && (
        <NodePanel
          open={panelOpen}
          onClose={() => {
            setPanelClosed(true);
            setSelectedId(null);
          }}
          index={index}
          node={panelNode}
          effective={effective}
          onDrill={(n) => drillTo(n.id)}
          onSelectChild={(n) => setSelectedId(n.id)}
        />
      )}
      {isMobile && effective && panelNode && (
        <NodeSheet
          open={panelOpen}
          onClose={() => {
            setPanelClosed(true);
            setSelectedId(null);
          }}
          index={index}
          node={panelNode}
          effective={effective}
          onDrill={(n) => drillTo(n.id)}
          onSelectChild={(n) => setSelectedId(n.id)}
        />
      )}

      {/* state picker sheet (long-press / leaf tap) */}
      {pickerNode && (
        <StatePickerSheet
          open
          nodeName={pickerNode.name}
          current={effective.get(pickerNode.id)}
          onPick={(state) => setState(pickerNode.id, state, pickerNode.name)}
          onClose={() => setPickerNodeId(null)}
        />
      )}

      {/* view error */}
      {viewStatus === 'error' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-paper/60">
          <div className="atlas-card-lg p-6 max-w-xs text-center animate-fade-up">
            <AlertTriangle className="mx-auto text-danger" size={24} strokeWidth={1.5} />
            <p className="font-display text-title text-ink mt-2">Couldn't load geography</p>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="mt-3 h-9 px-4 rounded-sm bg-accent text-paper-raised text-label uppercase font-semibold hover:bg-accent-strong transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* unknown place */}
      {notFound && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
          <NotFoundCard />
        </div>
      )}

      {/* off-screen region mirror for screen readers */}
      <ul className="sr-only" aria-label="Regions in the current view">
        {(view?.data.features ?? []).map((f) => {
          const id = featureId(f);
          if (id == null) return null;
          const node = index.nodes[id];
          const name = node?.name ?? String((f.properties as Record<string, unknown> | null)?.name ?? id);
          return (
            <li key={id}>
              <Link to={node && node.children.length > 0 ? nodeUrl(index, id) : `${nodeUrl(index, viewNode.id)}?sel=${encodeURIComponent(id)}`}>
                {name}, {STATE_LABEL[effective.get(id)]}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* live region announcements */}
      <div aria-live="polite" className="sr-only">
        {announcement.replace(/#\d+$/, '')}
      </div>
    </div>
  );
}
