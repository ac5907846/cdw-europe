/* Chart builders. Every function receives the shared DATA object and a DOM id,
   returns an initialized ECharts instance. Colours mirror the CSS variables. */

const C = {
  petrol: "#1b56ad", petrolMid: "#6f9bd6", petrolLight: "#bdd2ec",
  olive: "#0e7a43", clay: "#d98e12", bad: "#a92433",
  ink: "#1c1e26", ink2: "#494e5c", ink3: "#818697",
  rule: "#c9cdd8", grid: "#e9ebf1", wash: "#f3f4f8",
};
/* pathway fills and their darker lines */
const PATH = {
  recycling:   { name: "Recycling",                 fill: "#D9EAD3", line: "#0e7a43" },
  backfilling: { name: "Backfilling",               fill: "#D4EBF2", line: "#1b56ad" },
  energy:      { name: "Energy recovery",           fill: "#EAD1DC", line: "#a92458" },
  disposal:    { name: "Landfill and other disposal", fill: "#BFBFBF", line: "#494e5c" },
};
const PATH_KEYS = ["recycling", "backfilling", "energy", "disposal"];
const ARCH = {
  "recycling led": "#0e7a43",
  "transition to recycling": "#d98e12",
  "disposal reliant": "#a92458",
  "backfilling led": "#1b56ad",
};
const ARCH_ORDER = ["recycling led", "transition to recycling", "disposal reliant", "backfilling led"];
const KEYLINE = { borderColor: "#000", borderWidth: .5 };
const AXIS = {
  axisLine: { lineStyle: { color: C.rule } },
  axisTick: { show: false },
  axisLabel: { color: C.ink2 },
  splitLine: { lineStyle: { color: C.grid } },
};

/* Style rule: at most one decimal, no leading zero on decimals (".36"). */
function fmt(v, dec = 1, suffix = "") {
  if (v == null || Number.isNaN(+v)) return "no data";
  let s = (+v).toFixed(dec);
  if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  s = s.replace(/^(-?)0\./, "$1.");
  if (s === "-0") s = "0";
  return s + suffix;
}
function pct(v, dec = 1) { return fmt(v, dec, "%"); }
function fmtTonnes(t) {
  if (t == null) return "no data";
  if (t >= 1e6) return fmt(t / 1e6, 1) + " Mt";
  return fmt(t / 1e3, 0) + " kt";
}
function fmtInt(v) { return v == null ? "no data" : Math.round(v).toLocaleString("en-GB"); }
function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function baseGrid() {
  return { left: 60, right: 30, top: 40, bottom: 45 };
}

function swatch(color) {
  return `<span style="display:inline-block;width:10px;height:10px;background:${color};border:.5px solid #000;margin-right:5px"></span>`;
}

function mixTooltip(name, year, m) {
  const rows = PATH_KEYS.map((k) => `${swatch(PATH[k].fill)}${PATH[k].name}: ${pct(m[k])}`);
  return `<b>${name}</b> ${year || ""}<br>${rows.join("<br>")}<br>Recovery rate: ${pct(m.recovery)}`;
}

function coreCountries(DATA) {
  return Object.entries(DATA.countries).filter(([, c]) => c.core)
    .map(([geo, c]) => Object.assign({ geo }, c));
}

/* ---- Recovery mix: 30 horizontal stacked bars grouped by archetype ---- */
function chartMix(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const cs = coreCountries(DATA);
  const rows = [];
  ARCH_ORDER.forEach((a) => {
    const grp = cs.filter((c) => c.archetype === a)
      .sort((x, y) => y.latest.recycling - x.latest.recycling);
    rows.push({ header: true, label: `${capital(a)} (${grp.length})`, arch: a });
    grp.forEach((c) => rows.push({ header: false, label: c.name, c }));
  });
  const cats = rows.map((r, i) => (r.header ? `{h${ARCH_ORDER.indexOf(r.arch)}|${r.label}}` : r.label));
  const rich = {};
  ARCH_ORDER.forEach((a, i) => { rich["h" + i] = { color: ARCH[a], fontWeight: 700, fontSize: 12 }; });
  const series = PATH_KEYS.map((k) => ({
    name: PATH[k].name, type: "bar", stack: "mix", barWidth: 13,
    itemStyle: Object.assign({ color: PATH[k].fill }, KEYLINE),
    emphasis: { focus: "none" },
    data: rows.map((r) => (r.header ? null : r.c.latest[k])),
  }));
  series[0].markLine = {
    silent: true, symbol: "none", lineStyle: { color: C.ink2, type: "dashed", width: 1 },
    data: [{ xAxis: 70 }],
    label: { formatter: "70% target", position: "start", color: C.ink2, fontSize: 11 },
  };
  ch.setOption({
    grid: { left: 185, right: 60, top: 36, bottom: 48 },
    legend: { top: 4, textStyle: { color: C.ink2 }, itemWidth: 14, itemHeight: 10 },
    tooltip: { trigger: "item", formatter: (p) => {
      const r = rows[p.dataIndex];
      if (!r || r.header) return "";
      return mixTooltip(r.c.name, r.c.latest.year, r.c.latest) +
        `<br>${fmtTonnes(r.c.latest.treated_t)} treated, ${capital(r.c.archetype)}`;
    } },
    xAxis: { max: 100, ...AXIS, axisLabel: { color: C.ink2, formatter: "{value}%" },
             name: "Share of treated mineral CDW", nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "category", data: cats, inverse: true, ...AXIS,
             axisLabel: { color: C.ink, rich, fontSize: 11 },
             splitLine: { show: false } },
    series,
  });
  return ch;
}

/* ---- Stacked area trajectory of one country (or EU27), 2010 to 2022 ---- */
function trajectoryOption(c) {
  const s = c.series;
  const years = s.years.map(String);
  return {
    grid: baseGrid(),
    legend: { top: 4, textStyle: { color: C.ink2 }, itemWidth: 14, itemHeight: 10 },
    tooltip: { trigger: "axis", formatter: (ps) => {
      const i = ps[0].dataIndex;
      const m = { recycling: s.recycling[i], backfilling: s.backfilling[i],
                  energy: s.energy[i], disposal: s.disposal[i], recovery: s.recovery[i] };
      if (m.recycling == null) return `<b>${c.name}</b> ${years[i]}<br>no data reported`;
      return mixTooltip(c.name, years[i], m) + `<br>Treated: ${fmtTonnes(s.treated_t[i])}`;
    } },
    xAxis: { type: "category", data: years, boundaryGap: false, ...AXIS },
    yAxis: { max: 100, name: "Share of treated mineral CDW (%)", nameLocation: "middle",
             nameGap: 40, ...AXIS },
    series: PATH_KEYS.map((k) => ({
      name: PATH[k].name, type: "line", stack: "mix", symbol: "circle", symbolSize: 5,
      data: s[k], connectNulls: false,
      lineStyle: { color: PATH[k].line, width: 1.5 },
      itemStyle: { color: PATH[k].line },
      areaStyle: { color: PATH[k].fill, opacity: 1 },
      emphasis: { focus: "none" },
    })),
  };
}

function chartTrajectory(DATA, el, geo) {
  const ch = echarts.init(document.getElementById(el));
  ch.setOption(trajectoryOption(DATA.countries[geo]));
  return ch;
}

/* ---- EU27 mix by wave with treated tonnage under each year ---- */
function chartEU27(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const t = DATA.trends.eu27;
  const other = t.years.map((_, i) => 100 - t.recycling[i] - t.backfilling[i]);
  const bands = [
    ["Recycling", t.recycling, PATH.recycling],
    ["Backfilling", t.backfilling, PATH.backfilling],
    ["Disposal and energy recovery", other, PATH.disposal],
  ];
  ch.setOption({
    grid: { left: 60, right: 30, top: 40, bottom: 55 },
    legend: { top: 4, textStyle: { color: C.ink2 }, itemWidth: 14, itemHeight: 10 },
    tooltip: { trigger: "axis", formatter: (ps) => {
      const i = ps[0].dataIndex;
      return `<b>EU27</b> ${t.years[i]}<br>` +
        bands.map(([n, d, p]) => `${swatch(p.fill)}${n}: ${pct(d[i])}`).join("<br>") +
        `<br>Recovery rate: ${pct(t.recovery[i])}<br>Treated: ${fmt(t.treated_mt[i], 0)} Mt`;
    } },
    xAxis: { type: "category", boundaryGap: false, ...AXIS,
             data: t.years.map((y, i) => `${y}\n${fmt(t.treated_mt[i], 0)} Mt`),
             axisLabel: { color: C.ink2, lineHeight: 16 } },
    yAxis: { max: 100, name: "Share of treated mineral CDW (%)", nameLocation: "middle",
             nameGap: 40, ...AXIS },
    series: bands.map(([name, data, p]) => ({
      name, type: "line", stack: "eu", symbol: "circle", symbolSize: 5, data,
      lineStyle: { color: p.line, width: 1.5 }, itemStyle: { color: p.line },
      areaStyle: { color: p.fill, opacity: 1 }, emphasis: { focus: "none" },
    })),
  });
  return ch;
}

/* ---- Sigma convergence: SD across countries by wave ---- */
function chartSigma(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const s = DATA.trends.sigma;
  const lines = [
    ["Recycling", s.recycling_sd, PATH.recycling.line],
    ["Backfilling", s.backfilling_sd, PATH.backfilling.line],
    ["Landfill", s.landfill_sd, PATH.disposal.line],
  ];
  ch.setOption({
    grid: baseGrid(),
    legend: { top: 4, textStyle: { color: C.ink2 } },
    tooltip: { trigger: "axis", formatter: (ps) => {
      const i = ps[0].dataIndex;
      return `<b>${s.years[i]}</b> (${s.n[i]} countries)<br>` +
        lines.map(([n, d, col]) => `${swatch(col)}${n} SD: ${fmt(d[i], 1)} points`).join("<br>");
    } },
    xAxis: { type: "category", data: s.years.map(String), boundaryGap: false, ...AXIS },
    yAxis: { name: "Standard deviation of share (points)", nameLocation: "middle",
             nameGap: 40, min: 0, ...AXIS },
    series: lines.map(([name, data, color]) => ({
      name, type: "line", data, symbol: "circle", symbolSize: 7,
      lineStyle: { color, width: 2.5 }, itemStyle: { color },
    })),
  });
  return ch;
}

/* ---- EU27 construction sector composition ---- */
function chartComposition(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const c = DATA.trends.composition;
  const bands = [
    ["Soils and dredging spoils", c.soils_pct, "#dcd0b3"],
    ["Mineral CDW", c.mineral_cdw_pct, "#6f9bd6"],
    ["Wood, plastics, glass, mixed", c.other_pct, "#d98e12"],
    ["Other construction waste", c.remainder_pct, "#e3e6ee"],
  ];
  ch.setOption({
    grid: { left: 60, right: 30, top: 40, bottom: 55 },
    legend: { top: 4, textStyle: { color: C.ink2 }, itemWidth: 14, itemHeight: 10 },
    tooltip: { trigger: "axis", formatter: (ps) => {
      const i = ps[0].dataIndex;
      return `<b>EU27</b> ${c.years[i]}, ${fmt(c.total_mt[i], 0)} Mt generated<br>` +
        bands.map(([n, d, col]) => `${swatch(col)}${n}: ${pct(d[i])}`).join("<br>");
    } },
    xAxis: { type: "category", boundaryGap: false, ...AXIS,
             data: c.years.map((y, i) => `${y}\n${fmt(c.total_mt[i], 0)} Mt`),
             axisLabel: { color: C.ink2, lineHeight: 16 } },
    yAxis: { max: 100, name: "Share of construction sector waste (%)", nameLocation: "middle",
             nameGap: 40, ...AXIS },
    series: bands.map(([name, data, color]) => ({
      name, type: "line", stack: "comp", symbol: "circle", symbolSize: 5, data,
      lineStyle: { color: C.ink2, width: .8 }, itemStyle: { color: C.ink2 },
      areaStyle: { color, opacity: 1 }, emphasis: { focus: "none" },
    })),
  });
  return ch;
}

/* ---- Secondary aggregate share by archetype: jittered strip with medians ---- */
function chartSecondary(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const cs = DATA.construction.cross_section.filter((c) => c.secondary_share_pct != null);
  const groups = DATA.construction.groups;
  let seed = 7;
  /* horizontal jitter in pixels so points on a category axis do not overlap */
  const jitter = () => { seed = (seed * 9301 + 49297) % 233280; return (seed / 233280 - .5) * 44; };
  const series = ARCH_ORDER.map((a, ai) => ({
    name: capital(a), type: "scatter", symbolSize: 9,
    itemStyle: { color: ARCH[a], opacity: .85, borderColor: "#000", borderWidth: .5 },
    data: cs.filter((c) => c.archetype === a).map((c) => ({
      value: [ai, c.secondary_share_pct], symbolOffset: [jitter(), 0], name: c.country, c })),
  }));
  series.push({
    name: "Group median", type: "scatter", symbol: "rect", symbolSize: [46, 3],
    itemStyle: { color: C.ink }, z: 5,
    data: ARCH_ORDER.map((a, ai) => {
      const g = groups.find((x) => x.group === a);
      return { value: [ai, g.median], name: capital(a), n: g.n, median: true };
    }),
  });
  ch.setOption({
    grid: { left: 60, right: 20, top: 40, bottom: 60 },
    legend: { top: 4, textStyle: { color: C.ink2 }, data: ARCH_ORDER.map(capital) },
    tooltip: { formatter: (p) => {
      if (p.data.median) return `<b>${p.name}</b> (n = ${p.data.n})<br>median secondary share ${pct(p.value[1])}`;
      const c = p.data.c;
      return `<b>${c.country}</b> ${c.reporting_year}<br>secondary aggregates ${pct(c.secondary_share_pct)} of supply` +
        `<br>primary extraction ${fmt(c.primary_agg_t_per_cap, 1)} t per capita<br>backfilling ${pct(c.backfilling_pct)}, recycling ${pct(c.recycling_pct)}`;
    } },
    xAxis: { type: "category", data: ARCH_ORDER.map(capital), ...AXIS, splitLine: { show: false },
             axisLabel: { color: C.ink2, fontSize: 11, interval: 0,
               formatter: (v) => v.replace(" to ", "\nto ") } },
    yAxis: { type: "log", min: .002, max: 100, name: "Recycled CDW as share of aggregate supply (%, log)",
             nameLocation: "middle", nameGap: 42, ...AXIS,
             axisLabel: { color: C.ink2, formatter: (v) => fmt(v, 3) } },
    series,
  });
  return ch;
}

/* ---- Backfilling share vs primary aggregate extraction per capita ---- */
function chartExtraction(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const cs = DATA.construction.cross_section.filter((c) => c.primary_agg_t_per_cap != null);
  const lw = DATA.construction.lowess;
  const series = ARCH_ORDER.map((a) => ({
    name: capital(a), type: "scatter", symbolSize: 10,
    itemStyle: { color: ARCH[a], opacity: .85, borderColor: "#000", borderWidth: .5 },
    label: { show: true, position: "right", fontSize: 10, color: C.ink2,
             formatter: (p) => (p.data.c.label ? p.data.c.country : "") },
    data: cs.filter((c) => c.archetype === a).map((c) => ({
      value: [c.primary_agg_t_per_cap, c.backfilling_pct], name: c.country, c })),
  }));
  series.push({
    name: "Locally weighted fit", type: "line", symbol: "none", silent: true, z: 1,
    data: lw.primary_agg_t_per_cap.map((x, i) => [x, lw.lowess[i]]),
    lineStyle: { color: C.ink3, width: 2, type: "dashed" }, tooltip: { show: false },
  });
  ch.setOption({
    grid: baseGrid(),
    legend: { top: 4, textStyle: { color: C.ink2 }, data: ARCH_ORDER.map(capital) },
    tooltip: { formatter: (p) => {
      const c = p.data.c;
      return `<b>${c.country}</b> ${c.reporting_year}<br>primary extraction ${fmt(c.primary_agg_t_per_cap, 1)} t per capita` +
        `<br>backfilling ${pct(c.backfilling_pct)}, recycling ${pct(c.recycling_pct)}<br>${capital(c.archetype)}`;
    } },
    xAxis: { type: "log", min: .5, max: 40, name: "Primary aggregate extraction (t per capita, log)",
             nameLocation: "middle", nameGap: 28, ...AXIS,
             axisLabel: { color: C.ink2, formatter: (v) => fmt(v, 1) } },
    yAxis: { min: 0, max: 90, name: "Backfilling share (%)", nameLocation: "middle", nameGap: 40, ...AXIS },
    series,
  });
  return ch;
}

/* ---- Dumbbell: median recycling share with vs without each instrument ---- */
function chartDumbbell(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const rows = DATA.instruments.medians.slice()
    .sort((a, b) => b.n_with - a.n_with);
  const cats = rows.map((r) => r.label);
  const lbl = (side) => ({
    show: true, position: side === "with" ? "top" : "bottom", fontSize: 10, color: C.ink2,
    formatter: (p) => `${pct(p.value[0], 0)} (n = ${p.data.n})`,
  });
  ch.setOption({
    grid: { left: 190, right: 40, top: 40, bottom: 45 },
    legend: { top: 4, textStyle: { color: C.ink2 } },
    tooltip: { formatter: (p) => {
      const r = rows[p.dataIndex];
      return `<b>${r.label}</b><br>with (n = ${r.n_with}): median recycling ${pct(r.median_with)}` +
        `<br>without (n = ${r.n_without}): median recycling ${pct(r.median_without)}<br><span style="color:${C.ink3}">${r.countries_with}</span>`;
    } },
    xAxis: { min: 40, max: 100, name: "Median recycling share (%)", nameLocation: "middle",
             nameGap: 26, ...AXIS, axisLabel: { color: C.ink2, formatter: "{value}%" } },
    yAxis: { type: "category", data: cats, inverse: true, ...AXIS, splitLine: { show: false },
             axisLabel: { color: C.ink } },
    series: [
      { type: "custom", silent: true, z: 1,
        renderItem: (params, api) => {
          const a = api.coord([api.value(0), api.value(2)]);
          const b = api.coord([api.value(1), api.value(2)]);
          return { type: "line", shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] },
                   style: { stroke: C.rule, lineWidth: 3 } };
        },
        data: rows.map((r, i) => [r.median_with, r.median_without, i]) },
      { name: "Countries with the instrument", type: "scatter", symbolSize: 14, z: 3,
        itemStyle: { color: C.petrol, borderColor: "#000", borderWidth: .5 }, label: lbl("with"),
        data: rows.map((r, i) => ({ value: [r.median_with, i], n: r.n_with })) },
      { name: "Countries without", type: "scatter", symbolSize: 14, z: 3,
        itemStyle: { color: "#fff", borderColor: C.ink2, borderWidth: 1.4 }, label: lbl("without"),
        data: rows.map((r, i) => ({ value: [r.median_without, i], n: r.n_without })) },
    ],
  });
  return ch;
}

/* ---- Recycling share vs landfill tax rate, untaxed in a left column ---- */
function chartTaxRate(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const pts = DATA.instruments.tax_scatter;
  const taxed = pts.filter((p) => !p.zero_rate && p.tax_rate > 0);
  const untaxed = pts.filter((p) => p.zero_rate || !(p.tax_rate > 0));
  let seed = 3;
  const jitter = () => { seed = (seed * 9301 + 49297) % 233280; return (seed / 233280 - .5) * 60; };
  const tip = (p) => {
    const c = p.data.c;
    return `<b>${c.country}</b> ${c.reporting_year || ""}<br>` +
      (c.tax_rate > 0 ? `landfill tax ${fmt(c.tax_rate, 1)} EUR per tonne (2021)` : "no landfill tax rate in 2021") +
      `<br>recycling ${pct(c.recycling_pct)}, backfilling ${pct(c.backfilling_pct)}, landfill ${pct(c.landfill_pct)}` +
      `<br>${c.instrument_count} coded instruments`;
  };
  const style = (a) => ({ color: ARCH[a] || C.ink3, opacity: .85, borderColor: "#000", borderWidth: .5 });
  ch.setOption({
    grid: [{ left: 60, right: "78%", top: 40, bottom: 45 },
           { left: "27%", right: 20, top: 40, bottom: 45 }],
    legend: { top: 4, textStyle: { color: C.ink2 }, data: ARCH_ORDER.map(capital) },
    tooltip: { formatter: tip },
    xAxis: [
      { gridIndex: 0, type: "category", data: ["untaxed"], ...AXIS, splitLine: { show: false },
        axisLabel: { color: C.ink2 } },
      { gridIndex: 1, type: "log", min: 5, max: 120, name: "Landfill tax rate 2021 (EUR per tonne, log)",
        nameLocation: "middle", nameGap: 26, ...AXIS, axisLabel: { color: C.ink2, formatter: (v) => fmt(v, 0) } },
    ],
    yAxis: [
      { gridIndex: 0, min: 0, max: 105, name: "Recycling share (%)", nameLocation: "middle", nameGap: 40, ...AXIS },
      { gridIndex: 1, min: 0, max: 105, ...AXIS, axisLabel: { show: false } },
    ],
    series: ARCH_ORDER.flatMap((a) => [
      { name: capital(a), type: "scatter", xAxisIndex: 0, yAxisIndex: 0, symbolSize: 10,
        itemStyle: style(a),
        data: untaxed.filter((c) => c.archetype === a).map((c) => ({ value: [0, c.recycling_pct], symbolOffset: [jitter(), 0], c })) },
      { name: capital(a), type: "scatter", xAxisIndex: 1, yAxisIndex: 1, symbolSize: 10,
        itemStyle: style(a), labelLayout: { hideOverlap: true },
        label: { show: true, position: "right", fontSize: 10, color: C.ink2, formatter: (p) => p.data.c.country },
        data: taxed.filter((c) => c.archetype === a).map((c) => ({ value: [c.tax_rate, c.recycling_pct], c })) },
    ]),
  });
  return ch;
}

/* ---- Event style means around the start of a landfill tax ---- */
function chartEvent(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const ev = DATA.instruments.event;
  const rel = [...new Set(ev.map((e) => e.rel_year))].sort((a, b) => a - b);
  const get = (k) => rel.map((r) => ev.find((e) => e.rel_year === r && e.outcome === k));
  const lines = [
    ["Recycling", get("recycling_pct"), PATH.recycling.line],
    ["Backfilling", get("backfilling_pct"), PATH.backfilling.line],
    ["Landfill", get("landfill_pct"), PATH.disposal.line],
  ];
  ch.setOption({
    grid: baseGrid(),
    legend: { top: 4, textStyle: { color: C.ink2 } },
    tooltip: { trigger: "axis", formatter: (ps) => {
      const i = ps[0].dataIndex;
      const e = lines[0][1][i];
      const head = rel[i] === 0 ? "first wave with the tax" : rel[i] < 0 ? `${-rel[i]} years before` : `${rel[i]} years after`;
      return `<b>${head}</b> (n = ${e.n})<br>` +
        lines.map(([n, d, col]) => `${swatch(col)}${n}: ${pct(d[i] ? d[i].mean : null)}`).join("<br>") +
        `<br><span style="color:${C.ink3}">${e.countries}</span>`;
    } },
    xAxis: { type: "category", data: rel.map((r) => (r > 0 ? "+" + r : String(r))), boundaryGap: false,
             name: "Years relative to first wave with a landfill tax", nameLocation: "middle", nameGap: 26, ...AXIS },
    yAxis: { min: 0, max: 100, name: "Mean share (%)", nameLocation: "middle", nameGap: 40, ...AXIS },
    series: lines.map(([name, d, color], li) => ({
      name, type: "line", data: d.map((e) => (e ? e.mean : null)), symbol: "circle", symbolSize: 7,
      lineStyle: { color, width: 2.5 }, itemStyle: { color },
      markLine: li === 0 ? { silent: true, symbol: "none", lineStyle: { color: C.ink3, type: "dashed" },
        data: [{ xAxis: rel.indexOf(0) }], label: { formatter: "tax starts", color: C.ink3 } } : undefined,
    })),
  });
  return ch;
}

/* ---- World bubble chart: CDW per capita vs GDP per capita ---- */
function chartWorld(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const REGION = {
    "Europe and Central Asia": C.petrol,
    "Middle East and North Africa": C.clay,
    "Latin America and Caribbean": "#67b389",
    "East Asia and Pacific": "#a92458",
    "Sub-Saharan Africa": "#8a6d3b",
    "North America": "#494e5c",
    "South Asia": "#6f9bd6",
  };
  const LABEL = new Set(["China", "United States", "Germany", "India", "Luxembourg", "Zimbabwe"]);
  const cs = DATA.world.countries.filter((c) => c.cdw_t != null && c.gdp_pc_ppp != null && c.kg_per_cap > 0);
  const size = (t) => Math.max(5, Math.sqrt(t / 1e6) * 1.4);
  ch.setOption({
    grid: { left: 70, right: 30, top: 60, bottom: 50 },
    legend: { top: 4, textStyle: { color: C.ink2, fontSize: 11 }, data: Object.keys(REGION) },
    tooltip: { formatter: (p) => {
      const c = p.data.c;
      return `<b>${c.country}</b> (${c.region})<br>${fmt(c.kg_per_cap, 0)} kg CDW per capita, ${fmtTonnes(c.cdw_t)} total<br>GDP per capita ${fmtInt(c.gdp_pc_ppp)} USD PPP`;
    } },
    xAxis: { type: "log", min: 800, max: 200000, name: "GDP per capita (USD PPP, log)",
             nameLocation: "middle", nameGap: 28, ...AXIS, axisLabel: { color: C.ink2, formatter: (v) => fmtInt(v) } },
    yAxis: { type: "log", min: .02, max: 30000, name: "CDW (kg per capita, log)", nameLocation: "middle",
             nameGap: 48, ...AXIS, axisLabel: { color: C.ink2, formatter: (v) => fmt(v, 2) } },
    series: Object.keys(REGION).map((reg) => ({
      name: reg, type: "scatter",
      symbolSize: (v, p) => size(p.data.c.cdw_t),
      itemStyle: { color: REGION[reg], opacity: .6, borderColor: "#000", borderWidth: .5 },
      label: { show: true, position: "right", fontSize: 11, color: C.ink,
               formatter: (p) => (LABEL.has(p.data.c.country) ? p.data.c.country : "") },
      data: cs.filter((c) => c.region === reg).map((c) => ({ value: [c.gdp_pc_ppp, c.kg_per_cap], c })),
    })),
  });
  return ch;
}
