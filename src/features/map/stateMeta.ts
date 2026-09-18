import type { EffectiveState } from './types';

/** CSS-var driven visual metadata for each effective state (design.md §2.2) */
export const STATE_COLORS: Record<EffectiveState, { fill: string; stroke: string; dot: string }> = {
  none: { fill: 'var(--state-none-fill)', stroke: 'var(--hairline-strong)', dot: 'var(--state-none-fill)' },
  visited: { fill: 'var(--state-visited)', stroke: 'var(--state-visited-stroke)', dot: 'var(--state-visited)' },
  lived: { fill: 'var(--state-lived)', stroke: 'var(--state-lived-stroke)', dot: 'var(--state-lived)' },
  transit: { fill: 'var(--state-transit)', stroke: 'var(--state-transit-stroke)', dot: 'var(--state-transit)' },
  wishlist: { fill: 'var(--state-wishlist)', stroke: 'var(--state-wishlist-hatch)', dot: 'var(--state-wishlist)' },
  partial: { fill: 'var(--state-partial)', stroke: 'var(--state-partial-stroke)', dot: 'var(--state-partial)' },
};
