import type { EffectiveState } from '@/features/map/types';
import { STATE_COLORS } from '@/features/map/stateMeta';
import { STATE_LABEL } from '@/features/map/effective';

export interface MapTooltipData {
  x: number;
  y: number;
  name: string;
  state: EffectiveState;
  /** e.g. "Dhaka Division · Bangladesh" or "12 of 44 visited" */
  context?: string;
  /** Leaf hint, e.g. "Tap to mark" */
  hint?: string;
}

/**
 * Tooltip (design.md §7.10): small paper card anchored to the feature
 * centroid; name + state dot/label + context line. Pointer-events none.
 */
export default function Tooltip({ data }: { data: MapTooltipData }) {
  return (
    <div
      className="absolute z-30 pointer-events-none atlas-card px-3 py-2 max-w-[240px] animate-fade-up"
      style={{
        left: data.x,
        top: data.y,
        transform: 'translate(-50%, calc(-100% - 10px))',
        animationDuration: '150ms',
      }}
      role="tooltip"
    >
      <p className="text-[13px] font-semibold text-ink leading-tight">{data.name}</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-mono text-mono-sm text-ink-soft">
        <span
          className="inline-block w-2 h-2 rounded-full border border-ink/20"
          style={{ backgroundColor: STATE_COLORS[data.state].dot }}
          aria-hidden="true"
        />
        {STATE_LABEL[data.state]}
      </p>
      {data.context && <p className="mt-0.5 text-body-sm text-ink-faint leading-snug">{data.context}</p>}
      {data.hint && <p className="mt-0.5 text-body-sm text-ink-faint italic">{data.hint}</p>}
    </div>
  );
}
