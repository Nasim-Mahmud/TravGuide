# Data Attribution

All boundary data in this directory is derived from the sources below.
GADM data is **not** used anywhere in this project (its license forbids
redistribution).

## World — ADM0 countries

- **Natural Earth** — `ne_110m_admin_0_countries` and `ne_10m_admin_0_countries` (v5.1.1)
  - License: **Public domain** (https://www.naturalearthdata.com/about/terms-of-use/)
  - URLs:
    - https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip
    - https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip
  - Used for: `world/adm0.topojson`, `world/adm0-hi.topojson`, country list + continent
    assignments in `index.json`.

## Bangladesh — ADM1 divisions, ADM2 districts, ADM3 upazilas

- **OCHA COD-AB — Bangladesh Subnational Administrative Boundaries, dataset version 03 (v03)**,
  via the Humanitarian Data Exchange (HDX). Source agency: Bangladesh Bureau of
  Statistics (BBS). Dataset reviewed 2025-06-01; resource last modified 2026-01-26.
  - License: **Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)**
    (https://data.humdata.org/faqs/licenses)
  - Dataset: https://data.humdata.org/dataset/cod-ab-bgd
  - Downloaded resource: `bgd_admin_boundaries.geojson.zip`
    (https://data.humdata.org/dataset/401d3fae-4262-48c9-891f-461fd776d49b/resource/cec2abe3-d8b7-4025-9362-9f7e780f2a07/download/bgd_admin_boundaries.geojson.zip)
  - Used for: `adm1/BGD.topojson` (8 divisions), `bgd/adm2-districts.topojson`
    (64 districts), `bgd/adm3-upazilas.topojson` (495 upazilas; the 12 overlapping
    city-corporation features present in COD-AB ADM3 were filtered out — they
    spatially overlap regular upazilas). P-codes (e.g. `BD10`, `BD1004`,
    `BD20030004`) are retained as stable feature ids.

## ADM1 — Germany, India, United States, Japan, France

- **geoBoundaries (gbOpen)**, William & Mary geoLab, release `9469f09` (current release
  as of download).
  - License: **Creative Commons Attribution 4.0 (CC-BY 4.0)**
    (https://www.geoboundaries.org/about.html)
  - API pattern: `https://www.geoboundaries.org/api/current/gbOpen/{ISO3}/ADM1/`
  - Downloaded files:
    - https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/DEU/ADM1/geoBoundaries-DEU-ADM1.geojson
    - https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IND/ADM1/geoBoundaries-IND-ADM1.geojson
    - https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/USA/ADM1/geoBoundaries-USA-ADM1.geojson
    - https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/JPN/ADM1/geoBoundaries-JPN-ADM1.geojson
    - https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/FRA/ADM1/geoBoundaries-FRA-ADM1.geojson
  - Used for: `adm1/DEU.topojson`, `adm1/IND.topojson`, `adm1/USA.topojson`,
    `adm1/JPN.topojson`, `adm1/FRA.topojson`. Feature ids are the geoBoundaries
    `shapeISO` codes (e.g. `DE-BW`, `US-CA`).

## Processing

All files were simplified (`-simplify … keep-shapes -clean`) and converted to
TopoJSON with quantization `1e5` using [mapshaper](https://github.com/mbloch/mapshaper)
v0.7.61. Feature properties were normalized to `id`, `name`, and `pcode` (plus
`parent` p-code for Bangladesh ADM2/ADM3).
