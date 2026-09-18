import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Shield, Code } from 'lucide-react';

/**
 * About & Methodology — the editorial colophon of the atlas (design/about.md).
 * Paper-toned, typography-led, scrollable; carries the binding data
 * attribution (public/data/ATTRIBUTION.md). All reveals fire once at
 * ~25% viewport; Layout's MotionConfig collapses everything under
 * prefers-reduced-motion.
 */

const EASE_ATLAS = [0.22, 1, 0.36, 1] as [number, number, number, number];
const VIEWPORT_25 = { once: true, amount: 0.25 } as const;

const H1_TEXT = 'Every place has a story. This is mine, on a map.';

const PRINCIPLES = [
  {
    numeral: '01',
    title: 'Drill down, level by level',
    body: 'World → Country → Division → District → Upazila. Every level is its own map; every region is clickable, markable, and has its own URL you can bookmark or share.',
  },
  {
    numeral: '02',
    title: 'Mark what each place means',
    body: 'Visited, Lived, Transit, Wishlist — or leave it unmarked. States are per-place and mutually exclusive; marking a place visited quietly retires it from the wishlist.',
  },
  {
    numeral: '03',
    title: 'Partials bubble up, nothing cascades down',
    body: 'Marking a district never marks its upazilas. But visit one upazila and its district shows as "partially visited" — all the way up to the world map. Finish every child, and the atlas offers to mark the parent complete.',
  },
] as const;

const ROUTE_ROWS = [
  { name: 'World', context: '195 countries' },
  { name: 'Bangladesh', context: 'country' },
  { name: 'Dhaka Division', context: '1 of 8 divisions' },
  { name: 'Dhaka District', context: '1 of 64 districts' },
  { name: 'Savar Upazila', context: '1 of 495 upazilas' },
] as const;

/** The six visit states exactly as rendered on the map (design.md §2.2). */
const LEGEND_SWATCHES = [
  { label: 'Unvisited', fill: 'var(--state-none-fill)', stroke: 'var(--hairline-strong)', strokeWidth: 1 },
  { label: 'Visited', fill: 'var(--state-visited)', stroke: 'var(--state-visited-stroke)', strokeWidth: 1.5 },
  { label: 'Lived', fill: 'var(--state-lived)', stroke: 'var(--state-lived-stroke)', strokeWidth: 1.5 },
  { label: 'Transit', fill: 'var(--state-transit)', stroke: 'var(--state-transit-stroke)', strokeWidth: 1.5 },
  { label: 'Wishlist', fill: 'url(#about-swatch-hatch)', stroke: 'var(--state-wishlist-hatch)', strokeWidth: 1.2, dash: '4 3' },
  { label: 'Partially visited', fill: 'url(#about-swatch-dots)', stroke: 'var(--state-partial-stroke)', strokeWidth: 1 },
] as const;

/** Binding attribution — mirrors public/data/ATTRIBUTION.md. */
const DATA_SOURCES = [
  {
    label: 'World countries',
    source: 'Natural Earth — Admin 0 countries, 110m / 50m (v5.1.1)',
    license: 'Public domain',
    href: 'https://www.naturalearthdata.com/',
  },
  {
    label: 'First-level regions (ADM1)',
    source: 'geoBoundaries (gbOpen), William & Mary geoLab — Germany, India, USA, Japan, France',
    license: 'CC-BY 4.0',
    href: 'https://www.geoboundaries.org/',
  },
  {
    label: 'Bangladesh divisions, districts, upazilas',
    source: 'OCHA COD-AB (v03) via HDX — source agency: Bangladesh Bureau of Statistics',
    license: 'CC BY-IGO',
    href: 'https://data.humdata.org/dataset/cod-ab-bgd',
  },
  {
    label: 'Counts authority (8 / 64 / 495)',
    source: 'Bangladesh Bureau of Statistics',
    license: null,
    href: 'https://bbs.gov.bd/',
  },
] as const;

/** Internal link with the brass underline that slides in from the left on hover. */
function BrassLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="group relative inline-flex items-baseline font-sans font-medium text-[15px] text-accent hover:text-accent-strong transition-colors duration-200"
    >
      {children}
      <span
        aria-hidden="true"
        className="absolute left-0 -bottom-0.5 h-px w-full origin-left scale-x-0 bg-accent transition-transform duration-200 ease-atlas group-hover:scale-x-100"
      />
    </Link>
  );
}

function PrincipleBlock({ numeral, title, body, index }: { numeral: string; title: string; body: string; index: number }) {
  return (
    <motion.div
      className="flex gap-5 lg:gap-8"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_25}
      transition={{ duration: 0.45, delay: index * 0.12, ease: EASE_ATLAS }}
    >
      <motion.span
        aria-hidden="true"
        className="font-mono text-[2rem] leading-none text-accent select-none shrink-0 w-[3.25rem] text-right"
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT_25}
        transition={{ duration: 0.35, delay: index * 0.12 + 0.08, ease: EASE_ATLAS }}
      >
        {numeral}
      </motion.span>
      <div>
        <h3 className="font-display font-semibold text-title text-ink">{title}</h3>
        <p className="mt-2 text-body text-ink-soft max-w-[56ch]">{body}</p>
      </div>
    </motion.div>
  );
}

const swatchContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
} as const;

const swatchItem = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE_ATLAS } },
} as const;

/** Canonical palette reference: the six map state swatches with their real fills/patterns. */
function LegendStrip() {
  return (
    <motion.div
      className="mt-12 rounded-md border border-hairline bg-paper-sunken px-6 py-6"
      variants={swatchContainer}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT_25}
    >
      <p className="atlas-label text-center">The six states of the atlas</p>
      <div className="mt-5 flex flex-wrap items-start justify-center gap-x-8 gap-y-5">
        {/* Pattern defs shared by the swatches below — same hatch/dots as the map */}
        <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
          <defs>
            <pattern id="about-swatch-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--state-wishlist)" fillOpacity="0.55" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--state-wishlist-hatch)" strokeWidth="1" />
            </pattern>
            <pattern id="about-swatch-dots" width="7" height="7" patternUnits="userSpaceOnUse">
              <rect width="7" height="7" fill="var(--state-partial)" />
              <circle cx="1.5" cy="1.5" r="1.2" fill="var(--state-partial-stroke)" />
              <circle cx="5" cy="5" r="1.2" fill="var(--state-partial-stroke)" />
            </pattern>
          </defs>
        </svg>
        {LEGEND_SWATCHES.map((swatch) => (
          <motion.div key={swatch.label} variants={swatchItem} className="flex flex-col items-center gap-2">
            <svg width="44" height="28" viewBox="0 0 44 28" aria-hidden="true" focusable="false">
              <rect
                x="1"
                y="1"
                width="42"
                height="26"
                rx="6"
                fill={swatch.fill}
                stroke={swatch.stroke}
                strokeWidth={swatch.strokeWidth}
                strokeDasharray={'dash' in swatch ? swatch.dash : undefined}
              />
            </svg>
            <span className="text-body-sm text-ink-soft">{swatch.label}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/** Section 3 — the five-level route diagram card. */
function RouteDiagram() {
  return (
    <motion.div
      className="mx-auto mt-10 w-full max-w-[560px] rounded-md border border-hairline bg-paper-raised p-6 shadow-elev-2"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_25}
      transition={{ duration: 0.45, ease: EASE_ATLAS }}
    >
      <div className="relative">
        <motion.span
          aria-hidden="true"
          className="absolute left-[3px] top-3 bottom-3 w-px origin-top bg-hairline-strong"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={VIEWPORT_25}
          transition={{ duration: 0.6, ease: EASE_ATLAS }}
        />
        <ul className="space-y-5">
          {ROUTE_ROWS.map((row, i) => (
            <motion.li
              key={row.name}
              className="relative flex items-baseline justify-between gap-4 pl-7"
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={VIEWPORT_25}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.08, ease: EASE_ATLAS }}
            >
              <span
                aria-hidden="true"
                className="absolute left-0 top-[6px] h-[7px] w-[7px] rounded-full bg-accent"
              />
              <span className="font-sans font-semibold text-[15px] text-ink">{row.name}</span>
              <span className="tnum font-mono text-mono-sm text-ink-faint">{row.context}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function CraftCard({
  icon,
  title,
  body,
  footnote,
  index,
}: {
  icon: 'shield' | 'code';
  title: string;
  body: string;
  footnote?: string;
  index: number;
}) {
  const [revealed, setRevealed] = useState(false);
  const Icon = icon === 'shield' ? Shield : Code;
  return (
    <motion.div
      className="rounded-md border border-hairline bg-paper-raised p-6 shadow-elev-2"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_25}
      onViewportEnter={() => setRevealed(true)}
      transition={{ duration: 0.4, delay: index * 0.1, ease: EASE_ATLAS }}
    >
      <span className={revealed ? 'about-icon-draw inline-flex text-accent' : 'inline-flex text-accent opacity-0'}>
        <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h3 className="mt-3 font-display font-semibold text-title text-ink">{title}</h3>
      <p className="mt-2 text-body text-ink-soft">{body}</p>
      {footnote && <p className="mt-3 tnum font-mono text-mono-sm text-ink-faint">{footnote}</p>}
    </motion.div>
  );
}

export default function AboutPage() {
  useEffect(() => {
    document.title = 'About & Methodology — Atlas';
  }, []);

  return (
    <article className="flex-1 pb-24">
      {/* Icon draw-in keyframes (scoped to this page; collapses under reduced-motion
          via the global prefers-reduced-motion rule in index.css) */}
      <style>{`
        .about-icon-draw svg path,
        .about-icon-draw svg polyline,
        .about-icon-draw svg line,
        .about-icon-draw svg circle,
        .about-icon-draw svg rect {
          stroke-dasharray: 80;
          stroke-dashoffset: 80;
          animation: about-icon-draw 500ms ease-out forwards;
        }
        @keyframes about-icon-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* ── Section 1 — Hero ─────────────────────────────────────────── */}
      <section className="mx-auto flex w-full max-w-[720px] flex-col items-center px-5 pt-16 text-center lg:px-10 lg:pt-24">
        <motion.img
          src="/compass-rose.svg"
          alt=""
          width={200}
          height={200}
          className="h-[140px] w-[140px] lg:h-[200px] lg:w-[200px]"
          initial={{ opacity: 0, rotate: 0 }}
          animate={{ opacity: 1, rotate: 15 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        <p className="atlas-label mt-8">A personal travel atlas</p>
        <h1 className="mt-4 max-w-[14ch] font-display font-medium text-display-xl text-ink">
          {H1_TEXT.split(' ').map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              className="inline-block"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.05, ease: EASE_ATLAS }}
            >
              {word}
              {i < H1_TEXT.split(' ').length - 1 ? ' ' : ''}
            </motion.span>
          ))}
        </h1>
        <motion.p
          className="mt-6 max-w-[52ch] font-sans text-[17px] leading-[1.55] text-ink-soft"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 + H1_TEXT.split(' ').length * 0.05, ease: 'easeOut' }}
        >
          Atlas is an interactive record of where I&rsquo;ve been, where I&rsquo;ve lived, and
          where I still dream of going — from countries down to the 495 upazilas of Bangladesh.
        </motion.p>
        <motion.div
          className="mt-6 flex items-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.45 + H1_TEXT.split(' ').length * 0.05, ease: 'easeOut' }}
        >
          <BrassLink to="/map">Open the map ›</BrassLink>
          <BrassLink to="/stats">See the numbers ›</BrassLink>
        </motion.div>
      </section>

      {/* ── Section 2 — How the atlas works (+ legend strip, widened) ── */}
      <section className="mx-auto mt-[72px] w-full max-w-[920px] px-5 lg:mt-24 lg:px-10">
        <div className="mx-auto max-w-[720px]">
          <h2 className="font-display font-medium text-display-lg text-ink">How the atlas works</h2>
          <p className="mt-3 text-body text-ink-soft">
            Three small rules govern every mark on the map — and one palette carries them all.
          </p>
          <div className="mt-12 flex flex-col gap-10">
            <PrincipleBlock {...PRINCIPLES[0]} index={0} />
            <PrincipleBlock {...PRINCIPLES[1]} index={1} />
          </div>
        </div>

        <LegendStrip />

        <div className="mx-auto mt-12 max-w-[720px]">
          <PrincipleBlock {...PRINCIPLES[2]} index={2} />
        </div>
      </section>

      {/* ── Section 3 — The map, level by level ──────────────────────── */}
      <section className="mx-auto mt-[72px] w-full max-w-[720px] px-5 lg:mt-24 lg:px-10">
        <h2 className="font-display font-medium text-display-lg text-ink">Five levels deep</h2>
        <RouteDiagram />
        <motion.p
          className="mx-auto mt-6 max-w-[560px] text-body-sm text-ink-soft"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={VIEWPORT_25}
          transition={{ duration: 0.3, delay: 0.2, ease: 'easeOut' }}
        >
          Bangladesh is mapped to full depth — divisions, districts, and upazilas. Germany,
          India, the USA, Japan, and France carry first-level regions, with more countries and
          deeper levels added over time.
        </motion.p>
      </section>

      {/* ── Section 4 — Boundaries & data (binding attribution) ──────── */}
      <section className="mx-auto mt-[72px] w-full max-w-[720px] px-5 lg:mt-24 lg:px-10">
        <h2 className="font-display font-medium text-display-lg text-ink">Boundaries &amp; data</h2>
        <motion.dl
          className="mt-8 divide-y divide-hairline border-y border-hairline"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_25}
        >
          {DATA_SOURCES.map((row) => (
            <motion.div
              key={row.label}
              className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_ATLAS } },
              }}
            >
              <div>
                <dt className="font-sans font-semibold text-[15px] text-ink">{row.label}</dt>
                <dd className="mt-0.5 text-body-sm text-ink-soft">
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-hairline-strong underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
                  >
                    {row.source}
                  </a>
                </dd>
              </div>
              {row.license && (
                <dd className="tnum shrink-0 font-mono text-mono-sm text-accent">{row.license}</dd>
              )}
            </motion.div>
          ))}
        </motion.dl>
        <motion.p
          className="mt-6 text-body text-ink-soft"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={VIEWPORT_25}
          transition={{ duration: 0.2, delay: 0.15, ease: 'easeOut' }}
        >
          Boundaries follow Natural Earth&rsquo;s de-facto interpretations and the sources above;
          they are drawn for personal record-keeping, not as political statements. Administrative
          totals come from the data itself, so when boundaries change, the atlas&rsquo;s numbers
          change with them. GADM data is deliberately not used anywhere in this project — its
          license forbids redistribution.
        </motion.p>
      </section>

      {/* ── Section 5 — Privacy & craft ──────────────────────────────── */}
      <section className="mx-auto mt-[72px] w-full max-w-[720px] px-5 lg:mt-24 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-2">
          <CraftCard
            icon="shield"
            title="Private by design"
            body="No accounts, no analytics, no ads, no trackers. Your data never leaves your browser — travel marks live in localStorage and in a JSON file in the repo that you can export anytime."
            index={0}
          />
          <CraftCard
            icon="code"
            title="Built as a static site"
            body="Plain HTML, SVG maps, and open data — hosted on GitHub Pages, fast everywhere, and entirely self-contained."
            footnote="React 19 · TypeScript · Vite · Tailwind · d3-geo"
            index={1}
          />
        </div>
      </section>

      {/* ── Section 6 — Colophon lead-in ─────────────────────────────── */}
      <motion.section
        className="mx-auto mt-[72px] flex w-full max-w-[720px] items-center justify-center gap-3 px-5 lg:mt-24 lg:px-10"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <img src="/logo.svg" alt="" width={20} height={20} className="h-5 w-5" />
        <p className="font-display text-[1.25rem] italic leading-[1.3] text-ink-soft">
          Made with ink, paper, and open data.
        </p>
      </motion.section>
    </article>
  );
}
