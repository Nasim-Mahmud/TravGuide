import { Globe, Maximize, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitRegion: () => void;
  onResetWorld: () => void;
  className?: string;
}

/**
 * MapControls (design.md §7.4): vertical floating stack — +, −, fit-to-region,
 * reset-to-world. 40px visual buttons, ≥44px touch targets.
 */
export default function MapControls({ onZoomIn, onZoomOut, onFitRegion, onResetWorld, className }: MapControlsProps) {
  const btn =
    'w-11 h-11 lg:w-10 lg:h-10 flex items-center justify-center text-ink-soft hover:text-ink hover:bg-paper-sunken active:scale-[0.94] transition-all duration-100 rounded-sm';

  return (
    <div className={cn('atlas-card flex flex-col p-1 gap-0.5', className)} role="group" aria-label="Map controls">
      <button type="button" className={btn} onClick={onZoomIn} aria-label="Zoom in">
        <Plus size={18} strokeWidth={1.75} />
      </button>
      <button type="button" className={btn} onClick={onZoomOut} aria-label="Zoom out">
        <Minus size={18} strokeWidth={1.75} />
      </button>
      <div className="h-px bg-hairline mx-1.5 my-0.5" aria-hidden="true" />
      <button type="button" className={btn} onClick={onFitRegion} aria-label="Fit to region">
        <Maximize size={17} strokeWidth={1.75} />
      </button>
      <button type="button" className={btn} onClick={onResetWorld} aria-label="Reset to world">
        <Globe size={17} strokeWidth={1.75} />
      </button>
    </div>
  );
}
