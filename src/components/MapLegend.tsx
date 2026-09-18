import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Swatch showing the true map treatment: fill + pattern + stroke */
function Swatch({ kind }: { kind: 'none' | 'visited' | 'lived' | 'transit' | 'wishlist' | 'partial' }) {
  const size = { width: 18, height: 12 };
  if (kind === 'wishlist') {
    return (
      <svg {...size} className="rounded-[3px] shrink-0" aria-hidden="true">
        <defs>
          <pattern id="lg-wishlist" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="4" fill="var(--state-wishlist)" fillOpacity="0.55" />
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--state-wishlist-hatch)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0.5" y="0.5" width="17" height="11" rx="2" fill="url(#lg-wishlist)" stroke="var(--state-wishlist-hatch)" strokeDasharray="2 1.5" />
      </svg>
    );
  }
  if (kind === 'partial') {
    return (
      <svg {...size} className="rounded-[3px] shrink-0" aria-hidden="true">
        <defs>
          <pattern id="lg-partial" width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="var(--state-partial)" />
            <circle cx="1.2" cy="1.2" r="0.7" fill="var(--state-partial-stroke)" />
            <circle cx="3.7" cy="3.7" r="0.7" fill="var(--state-partial-stroke)" />
          </pattern>
        </defs>
        <rect x="0.5" y="0.5" width="17" height="11" rx="2" fill="url(#lg-partial)" stroke="var(--state-partial-stroke)" />
      </svg>
    );
  }
  const fill = kind === 'none' ? 'var(--state-none-fill)' : `var(--state-${kind})`;
  const stroke = kind === 'none' ? 'var(--hairline-strong)' : `var(--state-${kind}-stroke)`;
  return (
    <svg {...size} className="rounded-[3px] shrink-0" aria-hidden="true">
      <rect x="0.5" y="0.5" width="17" height="11" rx="2" fill={fill} stroke={stroke} />
    </svg>
  );
}

const ROWS: Array<{ kind: Parameters<typeof Swatch>[0]['kind']; label: string }> = [
  { kind: 'none', label: 'Not visited' },
  { kind: 'visited', label: 'Visited' },
  { kind: 'lived', label: 'Lived' },
  { kind: 'transit', label: 'Transit' },
  { kind: 'wishlist', label: 'Wishlist' },
  { kind: 'partial', label: 'Partially visited' },
];

/**
 * MapLegend (design.md §7.6): collapsible paper card with six true-to-map
 * swatches. Mobile renders an ⓘ button that opens the card as a popover.
 */
export default function MapLegend({ mobile = false, className }: { mobile?: boolean; className?: string }) {
  // Auto-expand on first visit only (desktop)
  const [open, setOpen] = useState(() => {
    if (mobile) return false;
    try {
      return !localStorage.getItem('atlas.legend-seen');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!mobile && open) {
      try {
        localStorage.setItem('atlas.legend-seen', '1');
      } catch { /* ignore */ }
    }
  }, [mobile, open]);

  const card = (
    <div className={cn('atlas-card p-3 w-[188px]', className)}>
      <div className="flex items-center justify-between mb-1">
        <p className="atlas-label">Legend</p>
        {!mobile && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-ink-faint hover:text-ink text-body-sm px-1 rounded-sm"
            aria-label="Collapse legend"
          >
            −
          </button>
        )}
      </div>
      <ul className="space-y-1.5">
        {ROWS.map((row, i) => (
          <li
            key={row.kind}
            className="flex items-center gap-2 animate-fade-up"
            style={{ animationDelay: `${i * 40}ms`, animationDuration: '200ms' }}
          >
            <Swatch kind={row.kind} />
            <span className="text-body-sm text-ink-soft">{row.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 pt-2 border-t border-hairline text-[11px] text-ink-faint">◐ = partially visited (derived)</p>
    </div>
  );

  if (mobile) {
    return (
      <div className={cn('relative', className)}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle map legend"
          aria-expanded={open}
          className="atlas-card w-11 h-11 flex items-center justify-center text-ink-soft hover:text-ink transition-colors"
        >
          <Info size={18} strokeWidth={1.75} />
        </button>
        {open && <div className="absolute bottom-full mb-2 left-0 z-40 animate-fade-up">{card}</div>}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Expand map legend"
        className={cn('atlas-card flex items-center gap-1.5 px-2.5 py-2', className)}
      >
        {ROWS.map((r) => (
          <span key={r.kind} className="w-2 h-2 rounded-full border border-ink/15" style={{ backgroundColor: `var(--state-${r.kind === 'none' ? 'none-fill' : r.kind})` }} />
        ))}
      </button>
    );
  }
  return card;
}
