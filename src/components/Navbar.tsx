import { Link, NavLink, useLocation } from 'react-router';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import SearchBox from './SearchBox';
import { useState } from 'react';

const NAV_LINKS = [
  { to: '/map', label: 'Map' },
  { to: '/stats', label: 'Stats' },
  { to: '/about', label: 'About' },
];

/**
 * TopBar (design.md §7.1): floating paper bar, sticky top-0 z-50.
 * Logo → /map; nav links with brass active underline; SearchBox inline on
 * desktop, collapsible magnifier on mobile.
 */
export default function Navbar() {
  const location = useLocation();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 lg:px-4 lg:pt-4">
      <div
        className="atlas-card flex items-center gap-2 h-12 lg:h-14 px-3 lg:px-4 animate-fade-down"
        style={{ animationDelay: '100ms' }}
      >
        <Link
          to="/map"
          className="flex items-center gap-2 shrink-0 rounded-sm"
          aria-label="Atlas — go to the map"
        >
          <img src="/logo.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" />
          <span className="font-display font-semibold text-title text-ink leading-none">Atlas</span>
        </Link>

        <nav className="flex items-center gap-1 lg:gap-2 ml-2 lg:ml-6" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active =
              link.to === '/map'
                ? location.pathname === '/' || location.pathname.startsWith('/map') || location.pathname.startsWith('/country')
                : location.pathname.startsWith(link.to);
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={cn(
                  'relative px-2 lg:px-2.5 py-1.5 text-label uppercase font-semibold transition-colors duration-200 rounded-sm',
                  active ? 'text-ink' : 'text-ink-soft hover:text-ink',
                )}
              >
                {link.label}
                <span
                  className={cn(
                    'absolute left-2 right-2 -bottom-[1px] h-0.5 bg-accent rounded-full transition-all duration-200',
                    active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-50',
                  )}
                  aria-hidden="true"
                />
              </NavLink>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Desktop search */}
        <div className="hidden lg:block w-[320px] xl:w-[320px] lg:max-w-[260px] xl:max-w-none">
          <SearchBox />
        </div>

        {/* Mobile search trigger */}
        <button
          type="button"
          className="lg:hidden flex items-center justify-center w-11 h-11 -mr-1.5 rounded-sm text-ink-soft hover:text-ink hover:bg-paper-sunken transition-colors"
          aria-label="Search places"
          onClick={() => setMobileSearchOpen(true)}
        >
          <Search size={19} strokeWidth={1.75} />
        </button>
      </div>

      {mobileSearchOpen && <SearchBox mobileOverlay onClose={() => setMobileSearchOpen(false)} />}
    </header>
  );
}
