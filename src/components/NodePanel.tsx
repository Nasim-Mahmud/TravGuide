import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AtlasIndex, AtlasNode, EffectiveState, StoredVisitState } from '@/features/map/types';
import type { EffectiveIndex } from '@/features/map/effective';
import { STATE_LABEL } from '@/features/map/effective';
import { STATE_COLORS } from '@/features/map/stateMeta';
import { levelNameFor } from '@/features/map/search';
import { childLevelLabel } from '@/features/map/paths';
import { useAtlasStore } from '@/features/map/store';
import StatePicker from './StatePicker';

const ROW_H = 40;

function StateDotInline({ state }: { state: EffectiveState }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full border border-ink/20 shrink-0"
      style={{ backgroundColor: STATE_COLORS[state].dot }}
      aria-hidden="true"
    />
  );
}

/** Lightweight windowed list for >50 children (map.md §3.7) */
function VirtualChildren({
  items,
  renderRow,
}: {
  items: AtlasNode[];
  renderRow: (node: AtlasNode, i: number) => React.ReactNode;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const maxHeight = 320;
  if (items.length <= 50) {
    return (
      <div className="overflow-y-auto atlas-scroll" style={{ maxHeight }}>
        {items.map((n, i) => renderRow(n, i))}
      </div>
    );
  }
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 5);
  const end = Math.min(items.length, Math.ceil((scrollTop + maxHeight) / ROW_H) + 5);
  return (
    <div
      className="overflow-y-auto atlas-scroll"
      style={{ maxHeight }}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      <div style={{ height: items.length * ROW_H, position: 'relative' }}>
        <div style={{ transform: `translateY(${start * ROW_H}px)` }}>
          {items.slice(start, end).map((n, i) => renderRow(n, start + i))}
        </div>
      </div>
    </div>
  );
}

export interface NodePanelContentProps {
  index: AtlasIndex;
  node: AtlasNode;
  effective: EffectiveIndex;
  onDrill: (node: AtlasNode) => void;
  onSelectChild: (node: AtlasNode) => void;
}

/** Shared panel/sheet content (design.md §7.7, map.md §3.7) */
export function NodePanelContent({ index, node, effective, onDrill, onSelectChild }: NodePanelContentProps) {
  const states = useAtlasStore((s) => s.states);
  const setState = useAtlasStore((s) => s.setState);
  const setNote = useAtlasStore((s) => s.setNote);
  const markAllChildren = useAtlasStore((s) => s.markAllChildren);

  const [sort, setSort] = useState<'az' | 'visited'>('az');
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [noteDraft, setNoteDraft] = useState(states[node.id]?.note ?? '');

  // Reset drafts when the displayed node changes (render-time adjust pattern)
  const [prevNodeId, setPrevNodeId] = useState(node.id);
  if (prevNodeId !== node.id) {
    setPrevNodeId(node.id);
    setNoteDraft(states[node.id]?.note ?? '');
    setConfirmBulk(false);
  }

  const eff = effective.get(node.id);
  const stats = effective.stats(node.id);
  const country = node.country ? index.nodes[node.country] : node.level === 0 ? node : null;
  const levelName = levelNameFor(index, node);
  const childLabel = childLevelLabel(index, node);
  const stored = states[node.id];

  const children = useMemo(() => {
    const list = node.children.map((id) => index.nodes[id]).filter(Boolean);
    if (sort === 'az') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    const rank = (n: AtlasNode) => {
      const s = effective.get(n.id);
      return s === 'visited' || s === 'lived' ? 0 : s === 'partial' ? 1 : s === 'transit' ? 2 : s === 'wishlist' ? 3 : 4;
    };
    return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [node.children, index.nodes, sort, effective]);

  const pick = (state: StoredVisitState | null) => setState(node.id, state, node.name);

  const coords = node.bbox
    ? `${Math.abs((node.bbox[0] + node.bbox[2]) / 2).toFixed(1)}°${(node.bbox[0] + node.bbox[2]) / 2 >= 0 ? 'E' : 'W'} ${Math.abs((node.bbox[1] + node.bbox[3]) / 2).toFixed(1)}°${(node.bbox[1] + node.bbox[3]) / 2 >= 0 ? 'N' : 'S'}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* 1–2: eyebrow + name */}
      <div>
        <p className="atlas-label">
          {levelName}
          {country && node.level > 0 && <span> · {country.name}</span>}
        </p>
        <h2 className="font-display font-medium text-display-lg text-ink leading-tight mt-1">
          {node.name}
          {node.localName && (
            <span className="ml-2 font-sans font-normal text-body text-ink-faint">{node.localName}</span>
          )}
        </h2>
      </div>

      {/* 3: state row */}
      <div>
        {eff === 'none' ? (
          <p className="text-body-sm text-ink-faint">Not visited</p>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-sm border border-hairline px-2 py-1 text-label uppercase font-semibold text-ink"
              style={{ backgroundColor: `color-mix(in srgb, ${STATE_COLORS[eff].dot} 12%, transparent)` }}
            >
              <StateDotInline state={eff} />
              {STATE_LABEL[eff]}
            </span>
          </div>
        )}
        {eff === 'partial' && stats.total > 0 && (
          <div className="mt-2">
            <p className="text-body-sm text-ink-soft">
              ◐ Partial — {stats.visited} of {stats.total} {childLabel} visited
            </p>
            <div className="mt-1 h-1 rounded-full bg-paper-sunken overflow-hidden">
              <div className="h-full bg-state-partial-stroke rounded-full transition-[width] duration-300" style={{ width: `${(stats.visited / stats.total) * 100}%` }} />
            </div>
          </div>
        )}
        {eff !== 'none' && eff !== 'partial' && stats.total > 0 && (
          <p className="mt-1.5 font-mono text-mono-sm text-ink-faint tnum">
            {stats.visited} / {stats.total} {childLabel} visited
            {stats.partial > 0 && ` · ${stats.partial} partial`}
          </p>
        )}
      </div>

      {/* 4: state picker */}
      <StatePicker nodeName={node.name} current={eff} onPick={pick} />

      {/* notes (stored against the visit entry) */}
      {stored && (
        <div>
          <label htmlFor={`note-${node.id}`} className="atlas-label block mb-1">Note</label>
          <textarea
            id={`note-${node.id}`}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => noteDraft !== (stored.note ?? '') && setNote(node.id, noteDraft)}
            rows={2}
            placeholder="A line for the margins…"
            className="w-full resize-none rounded-sm border border-hairline bg-paper-sunken px-2.5 py-2 text-body-sm text-ink placeholder:text-ink-faint outline-none focus:border-hairline-strong"
          />
        </div>
      )}

      {/* 6: fully-explored suggestion */}
      {stats.fullyExplored && eff !== 'visited' && (
        <div className="rounded-sm border border-accent bg-paper-sunken p-3 animate-fade-up">
          <p className="text-body-sm text-ink flex items-start gap-1.5">
            <Sparkles size={15} className="text-accent shrink-0 mt-0.5" />
            <span>
              ✦ All {stats.total} {childLabel} visited — mark {node.name} as visited?
            </span>
          </p>
          <button
            type="button"
            onClick={() => pick('visited')}
            className="mt-2 h-8 px-3 rounded-sm bg-accent text-paper-raised text-label uppercase font-semibold hover:bg-accent-strong transition-colors"
          >
            Mark {node.name} as visited
          </button>
        </div>
      )}

      {/* 5: children list */}
      {children.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="atlas-label">
              {childLabel.charAt(0).toUpperCase() + childLabel.slice(1)} ({children.length})
            </p>
            <button
              type="button"
              onClick={() => setSort((s) => (s === 'az' ? 'visited' : 'az'))}
              className="text-[11px] font-semibold text-ink-faint hover:text-accent transition-colors rounded-sm px-1"
            >
              Sort: {sort === 'az' ? 'A–Z' : 'Most visited'}
            </button>
          </div>
          <VirtualChildren
            items={children}
            renderRow={(child, i) => {
              const cs = effective.get(child.id);
              const csStats = effective.stats(child.id);
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => (child.children.length > 0 ? onDrill(child) : onSelectChild(child))}
                  className="w-full flex items-center gap-2 px-2 rounded-sm hover:bg-paper-sunken transition-colors text-left animate-fade-up"
                  style={{ height: ROW_H, animationDelay: i < 10 ? `${i * 35}ms` : '0ms', animationDuration: '200ms' }}
                >
                  <StateDotInline state={cs} />
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-ink">{child.name}</span>
                  <span className="font-mono text-mono-sm text-ink-faint tnum shrink-0">
                    {cs !== 'none' ? STATE_LABEL[cs] : child.children.length > 0 ? csStats.total : ''}
                  </span>
                </button>
              );
            }}
          />
          {/* Explicit one-tap bulk action (plan §13 rule 3) */}
          {children.length > 1 && stats.visited < stats.total && (
            <div className="mt-2">
              {confirmBulk ? (
                <div className="flex items-center gap-2 animate-fade-in">
                  <button
                    type="button"
                    className="h-8 px-3 rounded-sm bg-accent text-paper-raised text-label uppercase font-semibold hover:bg-accent-strong transition-colors"
                    onClick={() => {
                      markAllChildren(children.map((c) => c.id));
                      setConfirmBulk(false);
                    }}
                  >
                    Confirm — mark {children.length} visited
                  </button>
                  <button
                    type="button"
                    className="h-8 px-2 rounded-sm text-label uppercase font-semibold text-ink-faint hover:text-ink"
                    onClick={() => setConfirmBulk(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmBulk(true)}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint hover:text-accent transition-colors rounded-sm"
                >
                  Mark all {childLabel} visited
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 7: footer meta */}
      <p className="font-mono text-mono-sm text-ink-faint border-t border-hairline pt-2.5">
        ID {node.id}
        {coords && ` · ${coords}`}
      </p>
    </div>
  );
}

interface NodePanelProps extends NodePanelContentProps {
  open: boolean;
  onClose: () => void;
}

/** Desktop floating right panel (map.md §3.7) */
export default function NodePanel({ open, onClose, ...contentProps }: NodePanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key={contentProps.node.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'atlas-card-lg absolute right-3 lg:right-4 top-14 z-40',
            'w-[320px] xl:w-[360px] max-h-[calc(100%-72px)] overflow-y-auto atlas-scroll p-5',
          )}
          aria-label={`${contentProps.node.name} details`}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-sm text-ink-faint hover:text-ink hover:bg-paper-sunken transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
          <NodePanelContent {...contentProps} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
