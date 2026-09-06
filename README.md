# CDW Europe: companion web app

Interactive companion to "Beyond the Recovery Rate: Recycling, Backfilling and the
Quality of Construction and Demolition Waste Recovery across Europe" (Journal of
Building Engineering). Planned domain: **cwd.electriai.com**.

Static site: one HTML page, vanilla JavaScript, ECharts 5.4.3 from cdnjs, hash
router with lazy chart initialization. No framework, no build step, no
node_modules. Same architecture as the Paper 1 app (epr.electriai.com).

## Layout

```
index.html          the eight views (overview, map, mix, trend, construction,
                    instruments, world, profile)
css/style.css       layout and the pathway / archetype colour tokens
js/charts.js        shared helpers (fmt, colours) and all chart builders
js/map.js           Europe choropleth and the country card
js/profile.js       country profile tool
js/app.js           data loading and hash router
data/*.json         built from ../02_analysis/*/results/*.csv
data/world.geojson  Europe window of the Paper 1 base map (Natural Earth 1:110m)
_build_data.py      rebuilds data/ (not deployed)
```

## Rebuild the data

Requires pandas and numpy. Run from this folder:

```
python _build_data.py
```

It reads the analysis results under `../02_analysis/` (folders 01, 04, 05, 08,
09, 12, 14 and 20) and the Paper 1 geojson, and writes `data/countries.json`,
`trends.json`, `construction.json`, `instruments.json`, `world.json`,
`meta.json` and `world.geojson`. Every file is parsed back after writing. The
script asserts that exactly 30 core countries and the EU27 aggregate are present.

## Serve locally

Data files load with `fetch`, so the folder must be served over HTTP:

```
python -m http.server 8765
```

then open http://localhost:8765/.

## Deploy

Deploy exactly as epr-world: push `index.html`, `css/`, `js/` and `data/` to the
static host and point cwd.electriai.com at it. `_build_data.py`, `README.md`
and `.gitignore` do not need to ship.

## Style rules

Percentages as "5%", decimals without a leading zero (".36"), at most one
decimal, no em dashes. Vocabulary is neutral: recovery mix, recovery quality,
material pathways, "the rate does not distinguish".
