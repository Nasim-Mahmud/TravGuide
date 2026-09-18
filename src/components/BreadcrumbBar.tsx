import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  url: string;
}

/**
 * BreadcrumbBar (design.md §7.2 / map.md §3.2): World › Bangladesh › …
 * Non-current segments are links; leading back-chevron below world.
 * Mobile: horizontally scrollable with edge fades, auto-scrolls to current.
 */
export default function BreadcrumbBar({ chain, className }: { chain: Crumb[]; className?: string }) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'auto' });
  }, [chain.length]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else if (chain.length > 1) navigate(chain[chain.length - 2].url);
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('atlas-card flex items-center h-9 pl-1.5 pr-3 gap-0.5 min-w-0', className)}
    >
      {chain.length > 1 && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="w-11 h-11 lg:w-7 lg:h-7 flex items-center justify-center rounded-sm text-ink-soft hover:text-ink hover:bg-paper-sunken transition-colors shrink-0"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
      )}
      <div ref={scrollRef as React.RefObject<HTMLDivElement>} className="breadcrumb-scroll flex items-center gap-0.5 overflow-x-auto min-w-0">
        {chain.map((crumb, i) => {
          const current = i === chain.length - 1;
          return (
            <span key={`${crumb.url}-${i}`} className="flex items-center gap-0.5 shrink-0 animate-slide-right-12">
              {i > 0 && <span className="text-ink-faint text-body-sm px-0.5 select-none" aria-hidden="true">›</span>}
              {current ? (
                <span aria-current="page" className="text-body-sm font-semibold text-ink whitespace-nowrap">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.url}
                  className="text-body-sm font-medium text-ink-soft hover:text-accent hover:underline underline-offset-2 whitespace-nowrap transition-colors rounded-sm"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
