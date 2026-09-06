/* Europe choropleth with five colouring modes and a country detail card.
   The base map is the Paper 1 world geojson cut to a Europe window; the view
   is fixed with boundingCoords so Europe fills the canvas. Core countries too
   small for the base map (Malta) are drawn as clickable markers. */

function buildMap(DATA, geojson) {
  echarts.registerMap("europe", geojson);
  const ch = echarts.init(document.getElementById("chart-map"));

  const byGeoName = {};
  Object.entries(DATA.countries).forEach(([geo, c]) => {
    if (c.core && c.geo_name) byGeoName[c.geo_name] = geo;
  });
  const core = Object.entries(DATA.countries).filter(([, c]) => c.core);

  function value(c, mode) {
    if (mode === "recycling") return c.latest.recycling;
    if (mode === "backfilling") return c.latest.backfilling;
    if (mode === "recovery") return c.latest.recovery;
    if (mode === "archetype") return ARCH_ORDER.indexOf(c.archetype);
    if (mode === "instruments") return c.instrument_count;
    return null;
  }
  const mapData = (mode) => core.filter(([, c]) => !c.point)
    .map(([, c]) => ({ name: c.geo_name, value: value(c, mode) }));
  const pointData = (mode) => core.filter(([, c]) => c.point)
    .map(([geo, c]) => ({ name: c.name, value: [c.point[0], c.point[1], value(c, mode)], geo }));

  const vmBase = { left: 10, bottom: 10, textStyle: { color: C.ink2 } };
  const VISUAL = {
    recycling: { ...vmBase, type: "continuous", min: 0, max: 100, text: ["100%", "0%"],
      inRange: { color: ["#f3f9f5", "#D9EAD3", "#6fb98b", "#0e7a43", "#07472a"] } },
    backfilling: { ...vmBase, type: "continuous", min: 0, max: 100, text: ["100%", "0%"],
      inRange: { color: ["#f4f7fb", "#D4EBF2", "#6f9bd6", "#1b56ad", "#0d2f63"] } },
    recovery: { ...vmBase, type: "continuous", min: 70, max: 100, text: ["100%", "70%"],
      inRange: { color: ["#f3f4f8", "#bdd2ec", "#6f9bd6", "#1b56ad"] } },
    archetype: { ...vmBase, type: "piecewise",
      pieces: ARCH_ORDER.map((a, i) => ({ value: i, label: capital(a), color: ARCH[a] })) },
    instruments: { ...vmBase, type: "piecewise", splitNumber: 7,
      pieces: [0, 1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })),
      inRange: { color: ["#f3f4f8", "#d8e2f1", "#bdd2ec", "#98b7e0", "#6f9bd6", "#3f74bd", "#1b56ad"] } },
  };

  function tip(geo) {
    const c = DATA.countries[geo];
    if (!c) return null;
    return `<b>${c.name}</b> ${c.latest.year}<br>${capital(c.archetype)}` +
      `<br>recycling ${pct(c.latest.recycling)}, backfilling ${pct(c.latest.backfilling)}` +
      `<br>recovery rate ${pct(c.latest.recovery)}<br>${c.instrument_count} coded instruments`;
  }

  function render(mode) {
    ch.setOption({
      tooltip: { formatter: (p) => {
        const geo = p.seriesType === "scatter" ? p.data.geo : byGeoName[p.name];
        return tip(geo) || `${p.name}<br><span style="color:${C.ink3}">not in the 30 country sample</span>`;
      } },
      /* one visible legend for the map regions, a hidden twin for the point markers */
      visualMap: [{ ...VISUAL[mode], seriesIndex: 0 },
                  { ...VISUAL[mode], seriesIndex: 1, dimension: 2, show: false }],
      geo: { map: "europe", nameProperty: "iso3c", roam: true, scaleLimit: { min: .8, max: 6 },
        zoom: 1.22, center: [12, 53.5],
        itemStyle: { areaColor: "#e6e8ee", borderColor: "#fff", borderWidth: .6 },
        emphasis: { label: { show: false }, itemStyle: { areaColor: "#d98e12" } },
        select: { disabled: true } },
      series: [
        { type: "map", map: "europe", geoIndex: 0, nameProperty: "iso3c", data: mapData(mode) },
        { type: "scatter", coordinateSystem: "geo", symbolSize: 12, z: 5,
          itemStyle: { borderColor: "#000", borderWidth: .5 },
          emphasis: { itemStyle: { color: "#d98e12" } },
          data: pointData(mode) },
      ],
    }, { notMerge: true });
  }

  ch.on("click", (p) => {
    const geo = p.seriesType === "scatter" ? p.data.geo : byGeoName[p.name];
    showCountry(DATA, geo, p.name);
  });
  render("recycling");

  document.querySelectorAll("#map-modes button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#map-modes button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      render(b.dataset.mode);
    });
  });
  return ch;
}

const INSTRUMENT_LABELS = {
  landfill_tax: "Landfill tax",
  cdw_landfill_restriction: "CDW landfill restriction",
  predemolition_audit: "Pre demolition audit",
  sorting_obligation: "Sorting obligation",
  recycled_aggregate_regulation: "Recycled aggregate regulation",
  aggregates_levy: "Aggregates levy",
  construction_epr: "Construction EPR",
};

function mixBarHTML(m) {
  const seg = (k, cls) => `<span class="${cls}" style="width:${Math.max(0, m[k] || 0)}%" title="${PATH[k].name} ${pct(m[k])}"></span>`;
  return `<div class="mixbar">${seg("recycling", "rec")}${seg("backfilling", "bf")}${seg("energy", "en")}${seg("disposal", "lf")}</div>` +
    `<div class="mixkey">` + PATH_KEYS.map((k) =>
      `<span><i style="background:${PATH[k].fill}"></i>${PATH[k].name} ${pct(m[k], 0)}</span>`).join("") + `</div>`;
}

function archPill(c) {
  return `<span class="arch-pill" style="background:${ARCH[c.archetype] || C.ink3}">${capital(c.archetype || "not classified")}</span>`;
}

function instrumentPills(c, onlyPresent = false) {
  return Object.entries(c.instruments).filter(([, v]) => !onlyPresent || v)
    .map(([k, v]) => `<span class="${v ? "" : "off"}">${INSTRUMENT_LABELS[k]}</span>`).join("");
}

function taxLine(c) {
  if (c.instruments.landfill_tax && c.landfill_tax_rate > 0) {
    return `${fmt(c.landfill_tax_rate, 1)} EUR per t (2021)` + (c.landfill_tax_since ? `, since ${c.landfill_tax_since}` : "");
  }
  if (c.instruments.landfill_tax) return "in force, rate not listed for 2021";
  return "none";
}

function showCountry(DATA, geo, fallbackName) {
  const c = DATA.countries[geo];
  const el = document.getElementById("country-card");
  if (!c) {
    el.innerHTML = `<p class='hint'>${fallbackName || "This territory"} is not among the 30 countries treating more than 100 kt of mineral CDW in 2022.</p>`;
    return;
  }
  const m = c.latest;
  el.innerHTML = `
    <h3>${c.name}</h3>
    ${archPill(c)}
    <div style="font-size:.78rem;color:var(--ink3)">Recovery mix, ${m.year}</div>
    ${mixBarHTML(m)}
    <dl>
      <dt>Recovery rate</dt><dd>${pct(m.recovery)}</dd>
      <dt>Treated (W121)</dt><dd>${fmtTonnes(m.treated_t)}</dd>
      <dt>Per capita</dt><dd>${m.kg_per_cap == null ? "no data" : fmt(m.kg_per_cap, 0) + " kg"}</dd>
      <dt>Landfill tax</dt><dd>${taxLine(c)}</dd>
      <dt>Regulatory quality</dt><dd>${fmt(c.regulatory_quality, 2)}</dd>
    </dl>
    <div style="font-size:.78rem;color:var(--ink3);margin-top:.7rem">Instruments coded as present</div>
    <div class="pills" style="margin-top:.3rem">${c.instrument_count ? instrumentPills(c, true) : "<span class='off'>none coded</span>"}</div>`;
}
