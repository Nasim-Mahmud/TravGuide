import { useState } from 'react';
import { Check, Home, MapPin, Heart, Plane, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EffectiveState, StoredVisitState } from '@/features/map/types';
import { PICKER_OPTIONS } from '@/features/map/effective';
import { STATE_COLORS } from '@/features/map/stateMeta';

const STATE_ICONS: Record<StoredVisitState, typeof MapPin> = {
  visited: MapPin,
  lived: Home,
  transit: Plane,
  wishlist: Heart,
};

function Dot({ state }: { state: StoredVisitState }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full border border-ink/15 shrink-0"
      style={{ backgroundColor: STATE_COLORS[state].dot }}
      aria-hidden="true"
    />
  );
}

interface StatePickerProps {
  nodeName: string;
  /** Effective state shown as active */
  current: EffectiveState;
  onPick: (state: StoredVisitState | null) => void;
  variant?: 'chips' | 'rows';
}

/**
 * StatePicker (design.md §7.8): Visited / Lived / Transit / Wishlist / Clear.
 * Wishlist over a been-there state requires an inline confirm (plan §12.2).
 */
export default function StatePicker({ nodeName, current, onPick, variant = 'chips' }: StatePickerProps) {
  const [confirming, setConfirming] = useState(false);
  const beenThere = current === 'visited' || current === 'lived' || current === 'transit';

  const pick = (state: StoredVisitState | null) => {
    if (state === 'wishlist' && beenThere) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onPick(state);
  };

  if (confirming) {
    return (
      <div className="rounded-sm border border-hairline bg-paper-sunken p-3 animate-fade-in">
        <p className="text-body-sm text-ink-soft">
          This will downgrade <span className="font-semibold text-ink">{nodeName}</span> to wishlist.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="px-3 h-8 rounded-sm bg-accent text-paper-raised text-label uppercase font-semibold hover:bg-accent-strong transition-colors"
            onClick={() => { setConfirming(false); onPick('wishlist'); }}
          >
            Confirm
          </button>
          <button
            type="button"
            className="px-3 h-8 rounded-sm border border-hairline text-label uppercase font-semibold text-ink-soft hover:text-ink hover:bg-paper-raised transition-colors"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'rows') {
    return (
      <ul className="divide-y divide-hairline">
        {PICKER_OPTIONS.map((opt, i) => {
          const Icon = STATE_ICONS[opt.state];
          const active = current === opt.state;
          return (
            <li key={opt.state}>
              <button
                type="button"
                onClick={() => pick(opt.state)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 min-h-14 text-left hover:bg-paper-sunken transition-colors animate-fade-up',
                  active && 'bg-paper-sunken',
                )}
                style={{ animationDelay: `${i * 50}ms`, animationDuration: '250ms' }}
              >
                <Icon size={18} strokeWidth={1.75} style={{ color: STATE_COLORS[opt.state].dot }} className="shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink">{opt.label}</span>
                  <span className="block text-body-sm text-ink-faint">{opt.description}</span>
                </span>
                {active && <Check size={16} className="text-accent shrink-0" />}
              </button>
            </li>
          );
        })}
        {current !== 'none' && (
          <li>
            <button
              type="button"
              onClick={() => pick(null)}
              className="w-full flex items-center gap-3 px-4 min-h-14 text-left hover:bg-paper-sunken transition-colors animate-fade-up"
              style={{ animationDelay: '200ms', animationDuration: '250ms' }}
            >
              <X size={18} strokeWidth={1.75} className="text-danger shrink-0" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-danger">Clear</span>
                <span className="block text-body-sm text-ink-faint">Remove mark</span>
              </span>
            </button>
          </li>
        )}
      </ul>
    );
  }

  // Compact segmented chips (NodePanel)
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Set visit state for ${nodeName}`}>
      {PICKER_OPTIONS.map((opt) => {
        const active = current === opt.state;
        return (
          <button
            key={opt.state}
            type="button"
            onClick={() => pick(opt.state)}
            aria-pressed={active}
            className={cn(
              'flex items-center gap-1.5 h-8 px-2.5 rounded-sm border text-label uppercase font-semibold transition-all duration-150',
              active
                ? 'border-current text-ink'
                : 'border-hairline text-ink-soft hover:text-ink hover:border-hairline-strong',
            )}
            style={active ? { backgroundColor: `color-mix(in srgb, ${STATE_COLORS[opt.state].dot} 12%, transparent)`, color: 'var(--ink)', borderColor: STATE_COLORS[opt.state].dot } : undefined}
          >
            <Dot state={opt.state} />
            {opt.label}
          </button>
        );
      })}
      {current !== 'none' && (
        <button
          type="button"
          onClick={() => pick(null)}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-sm border border-hairline text-label uppercase font-semibold text-danger hover:bg-danger/5 transition-colors"
        >
          <X size={12} strokeWidth={2} />
          Clear
        </button>
      )}
    </div>
  );
}
