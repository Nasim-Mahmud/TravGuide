# Atlas — a personal travel atlas

An interactive, static travel atlas: drill from the world down to countries,
regions, districts, and upazilas, mark the places that mean something to you,
and watch your travel statistics grow. Warm paper, ink typography, brass
accents — a hand-bound atlas, alive.

Built with React 19 + TypeScript, Vite, Tailwind CSS, d3-geo / d3-zoom,
TopoJSON, MiniSearch, and Zustand. No backend — hosted on GitHub Pages.

## Features

- **Hierarchical drill-down map** — World → Country → Division → District →
  Upazila. Every level is its own map; every region is clickable, markable,
  and has its own bookmarkable URL (`/country/bgd/dhaka-division/…`).
- **Visit states** — mark places Visited, Lived, Transit, or Wishlist (or
  leave them unmarked). States are per-place and mutually exclusive.
- **Partial propagation** — marking a region never cascades down to its
  children, but child marks bubble up as "partially visited" all the way to
  the world map; complete every child and the atlas offers to mark the
  parent complete.
- **Statistics dashboard** (`/stats`) — world coverage, per-country X/N
  trackers (Bangladesh flagship: 8 divisions, 64 districts, 495 upazilas),
  state breakdown, wishlist and transit lists.
- **Search** — fuzzy, keyboard-first (⌘K) place search across every level.
- **Shareable deep links** — clean URLs restored through the GitHub Pages
  SPA fallback (404 redirect + restore snippet).
- **Private by design** — no accounts, no analytics, no trackers; your marks
  live in your browser and in a JSON file you own.
- Accessible: keyboard-operable map, state never conveyed by color alone,
  `prefers-reduced-motion` respected throughout.

## Local development

Requires Node.js 20.

```bash
npm install
npm run dev        # http://localhost:3000
```

## Build

```bash
npm run build      # type-checks (tsc -b) then emits dist/
npm run preview    # serve the production build locally
```

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` deploys on every push to `main`/`master`
(and on manual dispatch): checkout → Node 20 with npm cache → `npm ci` →
`npm run build` → upload `dist/` → `actions/deploy-pages`.

One-time repo setup: **Settings → Pages → Source: "GitHub Actions"**.

- **Project site** (`https://<user>.github.io/<repo>/`): set
  `base: '/<repo>/'` in `vite.config.ts` and `PATH_SEGMENTS_TO_KEEP = 1` in
  `public/404.html`.
- **User site / custom domain** (`<user>.github.io`): the shipped defaults
  work as-is.

Deep links are handled with the spa-github-pages pattern: `public/404.html`
rewrites `/path?query` to `/?/path?query`, and a small snippet in
`index.html` restores the clean URL with `history.replaceState` before the
app boots.

## Editing travel data

Your marks are the only data that changes:

- **Source of truth (repo):** `public/data/my/visits.json` — a versioned map
  of region id → state (`visited` / `lived` / `transit` / `wishlist`).
- **Live overrides:** marks made in the UI are stored in the browser's
  `localStorage` and layered over `visits.json`, so nothing ever leaves your
  browser unless you export it.
- **Export / import:** export your marks as JSON at any time; commit the
  exported file over `public/data/my/visits.json` to make them the new
  baseline for every device.

## Data pipeline (offline)

Boundary data is prepared offline, never at runtime:

1. **Sources** (see `public/data/ATTRIBUTION.md` for the full, binding
   attribution):
   - **Natural Earth** — world countries (110m / 50m), *public domain*.
   - **geoBoundaries (gbOpen)** — first-level regions (ADM1) for DEU, IND,
     USA, JPN, FRA, *CC-BY 4.0*.
   - **OCHA COD-AB via HDX** — Bangladesh divisions / districts / upazilas,
     source agency Bangladesh Bureau of Statistics, *CC BY-IGO*.
   - GADM is deliberately **not** used (its license forbids redistribution).
2. **Processing:** shapefiles/GeoJSON are simplified and converted to
   TopoJSON with [mapshaper](https://github.com/mbloch/mapshaper)
   (`-simplify … keep-shapes -clean`, quantization `1e5`), properties
   normalized to `id`, `name`, `pcode` (+ `parent` for Bangladesh ADM2/3).
3. **Emission:** per-level TopoJSON files under `public/data/**` plus
   `public/data/index.json` (the hierarchy index: slugs, counts, parents).

## Folder structure

```
├── .github/workflows/deploy.yml   # GitHub Pages deployment
├── index.html                     # shell + OG/SEO meta + SPA-restore snippet
├── public/
│   ├── 404.html                   # GitHub Pages SPA fallback (redirect script)
│   ├── robots.txt, sitemap.xml    # SEO
│   ├── logo.svg, compass-rose.svg, grain.svg, pattern-*.svg
│   └── data/
│       ├── index.json             # hierarchy index (slugs, counts, parents)
│       ├── ATTRIBUTION.md         # binding data attribution & licenses
│       ├── world/                 # ADM0 countries TopoJSON
│       ├── adm1/                  # per-country first-level regions
│       ├── bgd/                   # Bangladesh districts & upazilas
│       └── my/visits.json         # repo-versioned travel marks
└── src/
    ├── components/                # TopBar, breadcrumb, search, panel, legend, …
    ├── features/map/              # map canvas, data loading, state store, search
    ├── hooks/, lib/               # media queries, utilities
    └── pages/                     # MapPage, StatsPage, AboutPage, NotFoundPage
```
