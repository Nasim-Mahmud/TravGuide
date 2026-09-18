import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronRight, Download, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAtlasStore } from '@/features/map/store';
import { loadVisitsSeed } from '@/features/map/data';
import { STATE_LABEL } from '@/features/map/effective';
import type { StoredVisitState, VisitEntry, VisitsFile } from '@/features/map/types';
import { loadStatsHierarchy } from '@/features/stats/hierarchy';
import type { StatsHierarchy } from '@/features/stats/hierarchy';
import { computeStats, CONTINENTS } from '@/features/stats/derive';
import type { CountryCardModel, LevelTracker, StateRowModel, StatsModel } from '@/features/stats/derive';
import {
  VISITS_STORAGE_KEY,
  exportVisitsJson,
  hasUnsavedChanges,
  pushStatsToast,
  resetVisits,
  syncFromStorageEvent,
} from '@/features/stats/persistence';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const STATE_DOT: Record<StoredVisitState, string> = {
  visited: 'var(--state-visited)',
  lived: 'var(--state-lived)',
  transit: 'var(--state-transit)',
  wishlist: 'var(--state-wishlist)',
};

/* ────────────────────────────────────────────────────────────
   Number tween (design.md §5.3): count-up 400–900ms ease-out,
   500ms on live change, instant under prefers-reduced-motion.
   ──────────────────────────────────────────────────────────── */
function useTweenNumber(
  target: number,
  opts: { started: boolean; duration?: number; delay?: number },
): number {
  const { started, duration = 600, delay = 0 } = opts;
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);
  const hasRun = useRef(false);

  // Reduced motion: no tween bookkeeping, render jumps to the final value.
  useEffect(() => {
    if (started && reduced) {
      valueRef.current = target;
      hasRun.current = true;
    }
  }, [started, reduced, target]);

  useEffect(() => {
    if (!started || reduced) return;
    const from = hasRun.current ? valueRef.current : 0;
    const dur = hasRun.current ? 500 : duration;
    hasRun.current = true;
    if (from === target) {
      valueRef.current = target;
      return;
    }
    let raf = 0;
    const timeout = setTimeout(() => {
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const v = from + (target - from) * eased;
        valueRef.current = v;
        setValue(v);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [target, started, reduced, duration, delay]);

  return reduced && started ? target : value;
}

/** IntersectionObserver-style reveal trigger, fires once (stats.md §8). */
function useReveal(amount = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount });
  return { ref, inView };
}

function Fade({
  inView,
  delay = 0,
  y = 16,
  duration = 0.3,
  className,
  children,
}: {
  inView: boolean;
  delay?: number;
  y?: number;
  duration?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      animate={inView || reduced ? { opacity: 1, y: 0 } : {}}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Tweening number with an sr-only final value for screen readers. */
function TweenNum({
  value,
  started,
  duration,
  delay,
  format,
  className,
}: {
  value: number;
  started: boolean;
  duration?: number;
  delay?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const v = useTweenNumber(value, { started, duration, delay });
  const fmt = format ?? ((n: number) => String(Math.round(n)));
  return (
    <span className={cn('tnum', className)}>
      <span aria-hidden="true">{fmt(v)}</span>
      <span className="sr-only">{fmt(value)}</span>
    </span>
  );
}

function Bar({
  pct,
  started,
  duration = 700,
  delay = 0,
  height = 4,
  trackClassName,
  fillClassName,
  label,
}: {
  pct: number;
  started: boolean;
  duration?: number;
  delay?: number;
  height?: number;
  trackClassName?: string;
  fillClassName?: string;
  label: string;
}) {
  const v = useTweenNumber(pct, { started, duration, delay });
  return (
    <div
      className={cn('w-full rounded-full bg-paper-sunken overflow-hidden', trackClassName)}
      style={{ height }}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full bg-state-visited', fillClassName)}
        style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
      />
    </div>
  );
}

function StateDot({ state, className }: { state: StoredVisitState; className?: string }) {
  if (state === 'wishlist') {
    return (
      <span
        className={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0 border', className)}
        style={{
          backgroundColor: 'rgba(208,138,138,0.55)',
          backgroundImage: "url('/pattern-wishlist.svg')",
          borderColor: 'var(--state-wishlist-hatch)',
        }}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0', className)}
      style={{ backgroundColor: STATE_DOT[state] }}
      aria-hidden="true"
    />
  );
}

/* ────────────────────────────────────────────────────────────
   Section 1 — World coverage hero (stats.md §2)
   ──────────────────────────────────────────────────────────── */
function WorldHero({ model }: { model: StatsModel }) {
  const { ref, inView } = useReveal(0.2);
  const reducedChips = useReducedMotion() ?? false;
  const { world } = model;

  return (
    <div ref={ref}>
      <Fade inView={inView} y={24} duration={0.3}>
        <section
          aria-label="World coverage"
          className="bg-ink-panel text-paper rounded-lg px-6 py-8 sm:px-10 sm:py-12 lg:px-16 lg:py-16 text-center shadow-elev-2"
        >
          <p className="text-label font-semibold uppercase tracking-[0.08em] text-[rgba(247,243,235,0.6)]">
            The World
          </p>
          <h1 className="mt-3 font-display font-medium text-stat-hero text-paper leading-none">
            <TweenNum
              value={world.percent}
              started={inView}
              duration={900}
              format={(v) => `${v.toFixed(1)}%`}
            />
          </h1>
          <p className="mt-2 text-body text-[rgba(247,243,235,0.7)]">of the world explored</p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 divide-y divide-[rgba(247,243,235,0.12)] sm:divide-y-0 sm:divide-x">
            {[
              {
                node: (
                  <TweenNum
                    value={world.visited}
                    started={inView}
                    duration={700}
                    delay={120}
                    format={(v) => `${Math.round(v)} / ${world.total}`}
                    className="font-mono font-semibold text-stat-num text-paper"
                  />
                ),
                caption: 'countries visited',
              },
              {
                node: (
                  <TweenNum
                    value={world.continentsVisited}
                    started={inView}
                    duration={700}
                    delay={240}
                    format={(v) => `${Math.round(v)} / ${world.continentTotal}`}
                    className="font-mono font-semibold text-stat-num text-paper"
                  />
                ),
                caption: 'continents',
              },
              {
                node: (
                  <TweenNum
                    value={world.regionsVisited}
                    started={inView}
                    duration={700}
                    delay={360}
                    className="font-mono font-semibold text-stat-num text-paper"
                  />
                ),
                caption: 'regions & districts visited worldwide',
              },
            ].map((item, i) => (
              <div key={i} className="px-4 py-4 sm:py-0 flex flex-col items-center gap-1">
                {item.node}
                <span className="text-body-sm text-[rgba(247,243,235,0.6)]">{item.caption}</span>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Bar
              pct={world.percent}
              started={inView}
              duration={800}
              delay={300}
              height={4}
              trackClassName="bg-[rgba(247,243,235,0.12)]"
              label={`${world.percent.toFixed(1)}% of countries visited`}
            />
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Continents visited">
            {CONTINENTS.map(({ code, name }, i) => {
              const visited = world.visitedContinentCodes.has(code);
              return (
                <motion.li
                  key={code}
                  initial={reducedChips ? false : { opacity: 0, y: 8 }}
                  animate={inView || reducedChips ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.25, delay: 0.4 + i * 0.06, ease: EASE }}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[44px] min-h-[28px] px-2.5 py-1 rounded-sm font-mono text-mono-sm border',
                      visited
                        ? 'bg-state-visited text-paper border-transparent font-semibold'
                        : 'text-[rgba(247,243,235,0.5)] border-[rgba(247,243,235,0.3)]',
                    )}
                    aria-label={`${name} — ${visited ? 'visited' : 'not visited yet'}`}
                    title={name}
                  >
                    {code}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </section>
      </Fade>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Section 2 — Flagship tracker: Bangladesh (stats.md §3)
   ──────────────────────────────────────────────────────────── */
function FlagshipTrackerCard({
  tracker,
  url,
  countryName,
  index,
  inView,
}: {
  tracker: LevelTracker;
  url: string;
  countryName: string;
  index: number;
  inView: boolean;
}) {
  const pct = tracker.total > 0 ? (tracker.full / tracker.total) * 100 : 0;
  return (
    <Fade inView={inView} delay={index * 0.1} y={20}>
      <Link
        to={url}
        className="block bg-paper-raised border border-hairline rounded-md shadow-elev-1 p-7 transition-all duration-200 ease-atlas hover:border-accent hover:shadow-elev-2 hover:-translate-y-0.5 focus-visible:outline-accent"
        aria-label={`${tracker.label} of ${countryName}: ${tracker.full} of ${tracker.total} fully visited — open on the map`}
      >
        <p className="text-label font-semibold uppercase text-ink-faint">{tracker.label}</p>
        <p className="mt-3 font-mono font-semibold text-ink leading-none text-[clamp(2rem,5vw,3rem)]">
          <TweenNum
            value={tracker.full}
            started={inView}
            duration={700}
            delay={index * 0.15}
            format={(v) => `${Math.round(v)} / ${tracker.total}`}
          />
        </p>
        <p className="mt-2 text-body-sm text-ink-soft">
          {tracker.touched} touched · {tracker.full} fully visited
        </p>
        <Bar
          pct={pct}
          started={inView}
          duration={700}
          delay={index * 0.15}
          height={6}
          label={`${tracker.label}: ${Math.round(pct)}% fully visited`}
        />
      </Link>
    </Fade>
  );
}

function FlagshipSection({ model }: { model: StatsModel }) {
  const { ref, inView } = useReveal(0.25);
  const flagship = model.flagship;
  if (!flagship) return null;
  return (
    <section ref={ref} aria-labelledby="stats-flagship">
      <Fade inView={inView} y={16}>
        <p className="text-label font-semibold uppercase text-ink-faint">Flagship Atlas</p>
        <div className="mt-1 flex items-baseline gap-3 flex-wrap">
          <h2 id="stats-flagship" className="font-display font-medium text-display-lg text-ink">
            {flagship.name}
          </h2>
          {flagship.localName && <span className="text-body text-ink-faint">{flagship.localName}</span>}
        </div>
      </Fade>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {flagship.trackers.map((tracker, i) => (
          <FlagshipTrackerCard
            key={tracker.level}
            tracker={tracker}
            url={flagship.url}
            countryName={flagship.name}
            index={i}
            inView={inView}
          />
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
   Section 3 — Other countries (stats.md §4)
   ──────────────────────────────────────────────────────────── */
function CountryCard({ card, index, inView }: { card: CountryCardModel; index: number; inView: boolean }) {
  const pct = card.total > 0 ? (card.visited / card.total) * 100 : 0;
  return (
    <Fade inView={inView} delay={index * 0.06} y={16}>
      <Link
        to={card.url}
        className="block h-full bg-paper-raised border border-hairline rounded-md shadow-elev-1 p-5 transition-all duration-200 ease-atlas hover:border-accent hover:shadow-elev-2 hover:-translate-y-0.5"
        aria-label={`${card.name}: ${card.visited} of ${card.total} ${card.levelLabel} visited — open on the map`}
      >
        <div className="flex items-center gap-2.5">
          {card.flag && (
            <span className="text-xl leading-none" aria-hidden="true">
              {card.flag}
            </span>
          )}
          <span className="text-body font-semibold text-ink">{card.name}</span>
          {card.stored && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-hairline px-2 py-0.5 text-label font-semibold uppercase text-ink-soft">
              <StateDot state={card.stored} className="w-2 h-2" />
              {STATE_LABEL[card.stored]}
            </span>
          )}
        </div>
        <p className="mt-3 font-mono text-mono-sm text-ink-soft tnum">
          <TweenNum
            value={card.visited}
            started={inView}
            duration={600}
            delay={index * 0.06}
            format={(v) => `${Math.round(v)} / ${card.total}`}
          />{' '}
          <span className="text-ink-faint">{card.levelLabel}</span>
        </p>
        <div className="mt-2.5">
          <Bar
            pct={pct}
            started={inView}
            duration={600}
            delay={index * 0.06}
            height={4}
            label={`${card.name}: ${Math.round(pct)}% of ${card.levelLabel} visited`}
          />
        </div>
      </Link>
    </Fade>
  );
}

function CountriesSection({ model }: { model: StatsModel }) {
  const { ref, inView } = useReveal(0.2);
  return (
    <section ref={ref} aria-labelledby="stats-countries">
      <Fade inView={inView} y={16}>
        <h2 id="stats-countries" className="font-display font-semibold text-title text-ink">
          Around the world
        </h2>
        <p className="mt-1 text-body-sm text-ink-soft">
          First-level regions for every country you&apos;ve explored.
        </p>
      </Fade>
      {model.countries.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
          {model.countries.map((card, i) => (
            <CountryCard key={card.id} card={card} index={i} inView={inView} />
          ))}
        </div>
      ) : (
        <Fade inView={inView} y={16} className="mt-6">
          <div className="rounded-md border border-dashed border-hairline-strong p-6 text-center">
            <p className="text-body text-ink-soft">
              The rest of the world awaits — mark a country on the map
            </p>
            <Link
              to="/map"
              className="mt-2 inline-flex items-center gap-1 text-body font-semibold text-accent hover:text-accent-strong transition-colors rounded-sm"
            >
              Open the map <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </Fade>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
   Section 4 — States at a glance (stats.md §5)
   ──────────────────────────────────────────────────────────── */
const GLANCE_CARDS: Array<{ state: StoredVisitState; caption: string }> = [
  { state: 'visited', caption: "places you've been" },
  { state: 'lived', caption: "places you've called home" },
  { state: 'transit', caption: 'passed through only' },
  { state: 'wishlist', caption: 'dreaming of' },
];

function GlanceSection({ model }: { model: StatsModel }) {
  const { ref, inView } = useReveal(0.2);
  return (
    <section ref={ref} aria-labelledby="stats-glance">
      <Fade inView={inView} y={16}>
        <h2 id="stats-glance" className="font-display font-semibold text-title text-ink">
          States at a glance
        </h2>
      </Fade>
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {GLANCE_CARDS.map(({ state, caption }, i) => (
          <Fade key={state} inView={inView} delay={i * 0.08} y={16}>
            <div
              className="bg-paper-raised border border-hairline rounded-md shadow-elev-1 border-t-[3px] p-5"
              style={{ borderTopColor: STATE_DOT[state] }}
            >
              <p className="font-mono font-semibold text-stat-num text-ink">
                <TweenNum value={model.glance[state]} started={inView} duration={600} delay={i * 0.08} />
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-body-sm font-semibold text-ink">
                <StateDot state={state} className="w-2 h-2" />
                {STATE_LABEL[state]}
              </p>
              <p className="mt-0.5 text-body-sm text-ink-faint">{caption}</p>
            </div>
          </Fade>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <StateListCard
          title="Wishlist"
          state="wishlist"
          rows={model.wishlist}
          inView={inView}
          emptyText="No places on the wishlist yet"
        />
        <StateListCard
          title="In transit"
          state="transit"
          rows={model.transit}
          inView={inView}
          emptyText="No transit stopovers recorded"
        />
      </div>
    </section>
  );
}

function StateListCard({
  title,
  state,
  rows,
  inView,
  emptyText,
}: {
  title: string;
  state: StoredVisitState;
  rows: StateRowModel[];
  inView: boolean;
  emptyText: string;
}) {
  const shown = rows.slice(0, 8);
  const reduced = useReducedMotion() ?? false;
  return (
    <Fade inView={inView} y={16}>
      <div className="bg-paper-raised border border-hairline rounded-md shadow-elev-1 overflow-hidden h-full flex flex-col">
        <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-hairline">
          <StateDot state={state} />
          <h3 className="text-body font-semibold text-ink">{title}</h3>
          <span className="ml-auto font-mono text-mono-sm text-ink-faint tnum">{rows.length}</span>
        </div>
        {shown.length > 0 ? (
          <ul className="flex-1">
            {shown.map((row, i) => (
              <motion.li
                key={row.id}
                initial={reduced ? false : { opacity: 0, x: 8 }}
                animate={inView || reduced ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.2, delay: 0.15 + i * 0.04, ease: EASE }}
              >
                <Link
                  to={row.url}
                  className="flex items-center gap-3 px-5 py-3 min-h-[44px] hover:bg-paper-sunken transition-colors group"
                >
                  <StateDot state={state} className="w-2 h-2" />
                  <span className="min-w-0">
                    <span className="block text-body font-medium text-ink truncate">{row.name}</span>
                    {row.context && (
                      <span className="block text-body-sm text-ink-faint truncate">{row.context}</span>
                    )}
                  </span>
                  <ChevronRight
                    size={15}
                    strokeWidth={1.75}
                    className="ml-auto shrink-0 text-ink-faint group-hover:text-accent transition-colors"
                    aria-hidden="true"
                  />
                </Link>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="flex-1 px-5 py-6 text-body-sm text-ink-faint">{emptyText}</p>
        )}
        <div className="border-t border-hairline px-5 py-3">
          <Link
            to="/map"
            className="inline-flex items-center gap-1 text-body-sm font-semibold text-accent hover:text-accent-strong transition-colors rounded-sm"
          >
            View all on map <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Fade>
  );
}

/* ────────────────────────────────────────────────────────────
   Section 5 — Continent coverage (stats.md §6)
   ──────────────────────────────────────────────────────────── */
function ContinentsSection({ model }: { model: StatsModel }) {
  const { ref, inView } = useReveal(0.25);
  return (
    <section ref={ref} aria-labelledby="stats-continents">
      <Fade inView={inView} y={16}>
        <h2 id="stats-continents" className="font-display font-semibold text-title text-ink">
          Continents
        </h2>
      </Fade>
      <div className="mt-6 flex flex-col gap-4">
        {model.continents.map((row, i) => {
          const pct = row.total > 0 ? (row.visited / row.total) * 100 : 0;
          const empty = row.visited === 0;
          return (
            <Fade key={row.code} inView={inView} delay={i * 0.07} y={12} duration={0.25}>
              <div className="grid grid-cols-[7.5rem_1fr_auto] sm:grid-cols-[9rem_1fr_auto] items-center gap-3 sm:gap-5">
                <span
                  className={cn(
                    'text-body-sm font-medium',
                    empty ? 'text-ink-faint' : 'text-ink',
                  )}
                >
                  {row.name}
                </span>
                <Bar
                  pct={pct}
                  started={inView}
                  duration={700}
                  delay={i * 0.1}
                  height={8}
                  label={`${row.name}: ${row.visited} of ${row.total} countries visited`}
                />
                <span className="font-mono text-mono-sm text-ink-soft tnum w-14 text-right">
                  <TweenNum
                    value={row.visited}
                    started={inView}
                    duration={700}
                    delay={i * 0.1}
                    format={(v) => `${Math.round(v)} / ${row.total}`}
                  />
                </span>
              </div>
            </Fade>
          );
        })}
      </div>
      <p className="mt-4 text-body-sm text-ink-faint">
        Countries per continent follow UN M49 counts
      </p>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
   Section 6 — Export / data footing (stats.md §7)
   ──────────────────────────────────────────────────────────── */
function ExportSection({
  states,
  unsaved,
  onExported,
  onReset,
}: {
  states: Record<string, VisitEntry>;
  unsaved: boolean;
  onExported: () => void;
  onReset: () => void;
}) {
  const { ref, inView } = useReveal(0.2);
  const [confirming, setConfirming] = useState(false);

  return (
    <div ref={ref}>
      <Fade inView={inView} y={16} duration={0.2}>
        <section
          aria-label="Export your data"
          className="bg-paper-sunken border border-dashed border-hairline-strong rounded-md p-6 flex flex-col sm:flex-row sm:items-center gap-5 sm:justify-between"
        >
          <div>
            <h2 className="text-body font-semibold text-ink">Your atlas, your data</h2>
            <p className="mt-1 text-body-sm text-ink-soft max-w-md">
              Visit marks are stored in this browser. Export a JSON snapshot to back them up or
              move devices.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {unsaved && (
              <span className="inline-flex items-center gap-1.5 text-body-sm text-ink-soft">
                <span
                  className="w-2 h-2 rounded-full bg-state-visited"
                  aria-hidden="true"
                />
                Unsaved changes
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                exportVisitsJson(states);
                pushStatsToast('visits.json downloaded');
                onExported();
              }}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-sm border border-accent text-accent font-semibold text-body-sm transition-colors duration-150 hover:bg-[rgba(181,122,31,0.08)]"
            >
              <Download size={15} strokeWidth={2} aria-hidden="true" />
              Export JSON
            </button>
            {confirming ? (
              <span className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    void resetVisits().then(() => {
                      pushStatsToast('Atlas reset to the bundled seed');
                      onReset();
                    });
                  }}
                  className="inline-flex items-center min-h-[44px] px-3 rounded-sm bg-danger text-paper font-semibold text-body-sm hover:brightness-110 transition"
                >
                  Confirm reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="inline-flex items-center min-h-[44px] px-3 rounded-sm border border-hairline-strong text-ink-soft font-semibold text-body-sm hover:bg-paper-raised transition-colors"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-sm text-danger font-semibold text-body-sm hover:bg-[rgba(180,85,46,0.08)] transition-colors"
              >
                <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                Reset all
              </button>
            )}
          </div>
        </section>
      </Fade>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Skeletons / empty state / page
   ──────────────────────────────────────────────────────────── */
function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-16 lg:gap-24" aria-hidden="true">
      <div className="animate-pulse rounded-lg bg-paper-sunken h-[26rem]" />
      <div>
        <div className="animate-pulse rounded bg-paper-sunken h-4 w-32" />
        <div className="animate-pulse rounded bg-paper-sunken h-9 w-56 mt-3" />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-md bg-paper-sunken h-44" />
          ))}
        </div>
      </div>
      <div>
        <div className="animate-pulse rounded bg-paper-sunken h-6 w-44" />
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse rounded-md bg-paper-sunken h-28" />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyStateCard() {
  const { ref, inView } = useReveal(0.2);
  return (
    <div ref={ref}>
      <Fade inView={inView} y={16}>
        <div className="rounded-md border border-dashed border-hairline-strong bg-paper-raised p-10 text-center shadow-elev-1">
          <p className="font-display font-medium text-display-lg text-ink">No travels recorded yet</p>
          <p className="mt-2 text-body text-ink-soft max-w-md mx-auto">
            Your atlas is a blank page. Open the map and mark the places you&apos;ve been — every
            number here will come alive.
          </p>
          <Link
            to="/map"
            className="mt-6 inline-flex items-center gap-2 min-h-[44px] px-5 rounded-sm bg-accent text-paper font-semibold text-body hover:bg-accent-strong transition-colors"
          >
            Open the map <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </Fade>
    </div>
  );
}

export default function StatsPage() {
  const states = useAtlasStore((s) => s.states);
  const seedLoaded = useAtlasStore((s) => s.seedLoaded);
  const [hierarchy, setHierarchy] = useState<StatsHierarchy | null>(null);
  const [seed, setSeed] = useState<VisitsFile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retrySeq, setRetrySeq] = useState(0);
  const [liveMessage, setLiveMessage] = useState('');

  useEffect(() => {
    document.title = 'Statistics — Atlas';
  }, []);

  useEffect(() => {
    void useAtlasStore.getState().init();
    void loadVisitsSeed().then(setSeed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadStatsHierarchy()
      .then((h) => {
        if (!cancelled) setHierarchy(h);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [retrySeq]);

  // Live-update when another tab edits the visits overlay (stats.md §8)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== VISITS_STORAGE_KEY) return;
      void syncFromStorageEvent(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const model = useMemo<StatsModel | null>(() => {
    if (!hierarchy || !seedLoaded) return null;
    return computeStats(hierarchy, states);
  }, [hierarchy, states, seedLoaded]);

  const unsaved = hasUnsavedChanges(seed);
  const announce = useCallback((msg: string) => setLiveMessage(`${msg} (${Date.now()})`), []);

  return (
    <div className="flex-1">
      <div className="mx-auto w-full max-w-[1080px] px-5 lg:px-10 pt-8 lg:pt-12 pb-16 lg:pb-24">
        <span className="sr-only" aria-live="polite">
          {liveMessage}
        </span>
        {loadError ? (
          <div className="rounded-md border border-hairline bg-paper-raised p-10 text-center shadow-elev-1">
            <p className="font-display font-medium text-display-lg text-ink">
              The atlas index couldn&apos;t be loaded
            </p>
            <p className="mt-2 text-body text-ink-soft">Check your connection and try again.</p>
            <button
              type="button"
              onClick={() => {
                setLoadError(false);
                setRetrySeq((n) => n + 1);
              }}
              className="mt-6 inline-flex items-center min-h-[44px] px-5 rounded-sm bg-accent text-paper font-semibold text-body hover:bg-accent-strong transition-colors"
            >
              Retry
            </button>
          </div>
        ) : !model ? (
          <StatsSkeleton />
        ) : (
          <div className="flex flex-col gap-16 lg:gap-24">
            <WorldHero model={model} />
            {model.empty ? (
              <EmptyStateCard />
            ) : (
              <>
                <FlagshipSection model={model} />
                <CountriesSection model={model} />
                <GlanceSection model={model} />
                <ContinentsSection model={model} />
              </>
            )}
            <ExportSection
              states={states}
              unsaved={unsaved}
              onExported={() => announce('visits.json downloaded')}
              onReset={() => announce('Atlas reset to the bundled seed')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
