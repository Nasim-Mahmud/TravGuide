import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface StatsChipProps {
  /** Current node name (eyebrow, label style) */
  eyebrow: string;
  /** "3 / 13" */
  value: string;
  /** "districts visited · 2 partial" */
  caption: string;
  /** 0..1 */
  progress: number;
  className?: string;
  compact?: boolean;
}

/**
 * StatsChip (design.md §7.5 / map.md §3.6): persistent completion meter.
 * Number tweens on change; progress bar animates width; subtle "breath".
 */
export default function StatsChip({ eyebrow, value, caption, progress, className, compact = false }: StatsChipProps) {
  const [displayed, setDisplayed] = useState(value);
  const [breath, setBreath] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    // Simple count-up tween of the leading number (500ms ease-out)
    const from = parseInt(displayed, 10) || 0;
    const to = parseInt(value, 10) || 0;
    const suffix = value.replace(/^\d+/, '');
    if (from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(value);
    } else {
      const start = performance.now();
      let raf = 0;
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 500);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplayed(`${Math.round(from + (to - from) * eased)}${suffix}`);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    setBreath(true);
    const t = setTimeout(() => setBreath(false), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      className={cn(
        'atlas-card px-3.5 py-2.5 min-w-[150px]',
        breath && 'animate-breath',
        className,
      )}
      aria-live="off"
    >
      <p className="atlas-label truncate">{eyebrow}</p>
      <div className={cn('flex items-baseline gap-2', compact && 'gap-1.5')}>
        <span className={cn('font-mono font-semibold text-ink tnum', compact ? 'text-base' : 'text-stat-num')}>
          {displayed}
        </span>
      </div>
      <p className="text-body-sm text-ink-faint truncate">{caption}</p>
      <div className="mt-1.5 h-1 rounded-full bg-paper-sunken overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full rounded-full bg-state-visited transition-[width] duration-[400ms] ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>
    </div>
  );
}
