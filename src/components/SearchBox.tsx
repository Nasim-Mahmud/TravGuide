import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAtlasStore } from '@/features/map/store';
import { searchNodes, type SearchResult } from '@/features/map/search';
import { nodeUrl } from '@/features/map/paths';
import { STATE_COLORS } from '@/features/map/stateMeta';
import type { AtlasIndex, AtlasNode } from '@/features/map/types';

function StateDot({ state }: { state: keyof typeof STATE_COLORS }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full border border-ink/20 shrink-0"
      style={{ backgroundColor: STATE_COLORS[state].dot }}
      aria-hidden="true"
    />
  );
}

interface SearchBoxProps {
  mobileOverlay?: boolean;
  onClose?: () => void;
}

/**
 * SearchBox (design.md §7.3 / map.md §3.3) — MiniSearch over the hierarchy
 * index, lazy-built on first focus; hierarchical, disambiguated results;
 * ⌘K / '/' to focus; quick "Mark visited" action per row.
 */
export default function SearchBox({ mobileOverlay = false, onClose }: SearchBoxProps) {
  const navigate = useNavigate();
  const index = useAtlasStore((s) => s.index);
  const indexStatus = useAtlasStore((s) => s.indexStatus);
  const loadIndex = useAtlasStore((s) => s.loadIndex);
  const states = useAtlasStore((s) => s.states);
  const setState = useAtlasStore((s) => s.setState);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(mobileOverlay);
  const [active, setActive] = useState(0);
  const [building, setBuilding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const ensureIndex = useCallback(() => {
    if (index || indexStatus === 'loading') return;
    const t = setTimeout(() => setBuilding(true), 150);
    void loadIndex().finally(() => {
      clearTimeout(t);
      setBuilding(false);
    });
  }, [index, indexStatus, loadIndex]);

  useEffect(() => {
    if (mobileOverlay) {
      void ensureIndex();
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [mobileOverlay, ensureIndex]);

  // Global ⌘K / '/' focuses the desktop field
  useEffect(() => {
    if (mobileOverlay) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        void ensureIndex();
        inputRef.current?.focus();
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        void ensureIndex();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOverlay, ensureIndex]);

  const results: SearchResult[] = useMemo(
    () => (index && query.trim() ? searchNodes(index, query, 12) : []),
    [index, query],
  );

  const goToNode = useCallback(
    (idx: AtlasIndex, node: AtlasNode) => {
      const target = node.children.length > 0
        ? nodeUrl(idx, node.id)
        : `${nodeUrl(idx, node.parent ?? node.id)}?sel=${encodeURIComponent(node.id)}`;
      navigate(target);
      setOpen(false);
      setQuery('');
      onClose?.();
      inputRef.current?.blur();
    },
    [navigate, onClose],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      onClose?.();
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active] && index) {
      goToNode(index, results[active].node);
    }
  };

  // Reset the active result on query change (render-time adjust pattern)
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setActive(0);
  }
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const resultList = (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Search results"
      className={cn(
        mobileOverlay
          ? 'flex-1 overflow-y-auto atlas-scroll'
          : 'absolute left-0 right-0 top-full mt-2 atlas-card-lg max-h-[420px] overflow-y-auto atlas-scroll z-50 origin-top animate-fade-in',
      )}
    >
      {query.trim() && results.length === 0 && (
        <p className="px-4 py-5 text-body-sm text-ink-faint">No places match “{query}”.</p>
      )}
      {results.map((r, i) => {
        const eff = states[r.node.id]?.state;
        return (
          <div
            key={r.node.id}
            role="option"
            aria-selected={i === active}
            className={cn(
              'group flex items-center gap-3 w-full text-left px-4 cursor-pointer transition-colors',
              mobileOverlay ? 'min-h-14 py-2.5' : 'py-2.5',
              i === active ? 'bg-paper-sunken' : 'hover:bg-paper-sunken',
              i < 8 && 'animate-fade-up',
            )}
            style={i < 8 ? { animationDelay: `${i * 30}ms`, animationDuration: '200ms' } : undefined}
            onMouseEnter={() => setActive(i)}
            onClick={() => index && goToNode(index, r.node)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink truncate">{r.node.name}</span>
                {r.matchedAlias && (
                  <span className="text-body-sm text-ink-faint truncate">({r.matchedAlias})</span>
                )}
                <span className="atlas-label shrink-0 rounded-sm border border-hairline px-1.5 py-0.5">
                  {r.levelName}
                </span>
                {eff && <StateDot state={eff} />}
              </div>
              {r.context && <p className="text-body-sm text-ink-faint truncate">{r.context}</p>}
            </div>
            <button
              type="button"
              title={`Mark ${r.node.name} visited`}
              aria-label={`Mark ${r.node.name} visited`}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 shrink-0 w-9 h-9 flex items-center justify-center rounded-sm text-ink-faint hover:text-state-visited-stroke hover:bg-paper"
              onClick={(e) => {
                e.stopPropagation();
                setState(r.node.id, 'visited', r.node.name);
              }}
            >
              <MapPin size={16} strokeWidth={1.75} />
            </button>
          </div>
        );
      })}
    </div>
  );

  if (mobileOverlay) {
    return (
      <div className="fixed inset-0 z-[60] bg-paper flex flex-col animate-fade-in" role="dialog" aria-label="Search places">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-hairline">
          <Search size={20} strokeWidth={1.75} className="text-ink-faint shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search countries, divisions, districts…"
            aria-label="Search places"
            className="flex-1 bg-transparent text-lg text-ink placeholder:text-ink-faint outline-none"
          />
          {building && <Loader2 size={18} className="animate-spin text-ink-faint" />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-sm text-ink-soft hover:text-ink"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
        {resultList}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 h-9 px-3 rounded-sm bg-paper-sunken border border-hairline focus-within:border-hairline-strong transition-colors">
        <Search size={15} strokeWidth={1.75} className="text-ink-faint shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { void ensureIndex(); setOpen(true); }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search places…"
          aria-label="Search places"
          className="flex-1 min-w-0 bg-transparent text-body-sm text-ink placeholder:text-ink-faint outline-none"
        />
        {building ? (
          <Loader2 size={13} className="animate-spin text-ink-faint shrink-0" />
        ) : (
          <kbd className="font-mono text-[10px] text-ink-faint border border-hairline rounded px-1 py-0.5 shrink-0">⌘K</kbd>
        )}
      </div>
      {open && query.trim() && resultList}
    </div>
  );
}
