/* Bootstrap: load data, then run a hash-based tab router. Each view's charts
   are initialized lazily the first time the tab is opened (ECharts cannot
   size itself inside a hidden container) and resized on later visits. */

const DATA = {};
const viewCharts = {};

async function loadJSON(name) {
  const res = await fetch("data/" + name);
  if (!res.ok) throw new Error("failed to load " + name);
  return res.json();
}

function heroStats() {
  const m = DATA.meta;
  const items = [
    [`${m.n_above_target} of ${m.n_countries}`, "countries above the 70% recovery target, which counts recycling and backfilling alike"],
    [`${pct(m.recycling_min, 0)} to ${pct(m.recycling_max, 0)}`, "range of the recycling share across those same countries (median " + pct(m.recycling_median, 0) + ")"],
    [`${pct(m.eu27_recycling_2014, 0)} and ${pct(m.eu27_recycling_2022, 0)}`, "EU27 recycling share in 2014 and in 2022, while recovery rose from " + pct(m.eu27_recovery_2014, 0) + " to " + pct(m.eu27_recovery_2022, 0)],
    [pct(m.secondary_share_eu27_2022, 0), "of EU27 aggregate supply came from recycled mineral CDW in 2022 (" + pct(m.secondary_share_eu27_2010, 0) + " in 2010)"],
  ];
  document.getElementById("hero-stats").innerHTML = items.map(
    ([num, lbl]) => `<div class="stat"><div class="num">${num}</div>
                     <div class="lbl">${lbl}</div></div>`).join("");
}

function initMix() {
  const bars = chartMix(DATA, "chart-mix");
  const sel = document.getElementById("mix-country");
  const opts = [["EU27", "EU27 (aggregate)"]].concat(
    coreCountries(DATA).sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.geo, c.name]));
  opts.forEach(([geo, name]) => {
    const o = document.createElement("option");
    o.value = geo; o.textContent = name; sel.appendChild(o);
  });
  sel.value = "EU27";
  const traj = chartTrajectory(DATA, "chart-trajectory", "EU27");
  sel.addEventListener("change", () =>
    traj.setOption(trajectoryOption(DATA.countries[sel.value]), { notMerge: true }));
  return [bars, traj];
}

/* view name -> lazy initializer returning the charts it created */
const INIT = {
  overview: () => { heroStats(); return []; },
  data: () => [],
  map: () => [buildMap(DATA, DATA.geojson)],
  mix: () => initMix(),
  trend: () => [chartEU27(DATA, "chart-eu27"), chartSigma(DATA, "chart-sigma")],
  construction: () => [chartComposition(DATA, "chart-composition"),
                       chartSecondary(DATA, "chart-secondary"),
                       chartExtraction(DATA, "chart-extraction")],
  instruments: () => [chartDumbbell(DATA, "chart-dumbbell"),
                      chartTaxRate(DATA, "chart-taxrate"),
                      chartEvent(DATA, "chart-event")],
  world: () => [chartWorld(DATA, "chart-world")],
  profile: () => [initProfile(DATA)],
};
const initialized = new Set();

function activate(view) {
  if (!INIT[view]) view = "overview";
  document.querySelectorAll("main .view").forEach((s) =>
    s.classList.toggle("active", s.id === "view-" + view));
  document.querySelectorAll("#tabs a").forEach((a) =>
    a.classList.toggle("active", a.dataset.view === view));
  if (!initialized.has(view)) {
    initialized.add(view);
    viewCharts[view] = INIT[view]() || [];
  } else {
    (viewCharts[view] || []).forEach((c) => c && c.resize());
  }
  window.scrollTo(0, 0);
}

function router() {
  const view = (location.hash || "#overview").slice(1);
  activate(INIT[view] ? view : "overview");
}

async function main() {
  const [countries, trends, construction, instruments, world, meta, geojson] = await Promise.all([
    loadJSON("countries.json"), loadJSON("trends.json"), loadJSON("construction.json"),
    loadJSON("instruments.json"), loadJSON("world.json"), loadJSON("meta.json"),
    loadJSON("world.geojson"),
  ]);
  Object.assign(DATA, { countries, trends, construction, instruments, world, meta, geojson });

  window.addEventListener("hashchange", router);
  window.addEventListener("resize", () =>
    Object.values(viewCharts).flat().forEach((c) => c && c.resize()));
  router();
}

main().catch((e) => {
  console.error("[CDWEurope]", e);
  document.body.insertAdjacentHTML("beforeend",
    "<p style='color:#a92433;padding:1rem 4vw'>Data failed to load. " +
    "Serve this folder over HTTP (data files cannot load from file://).</p>");
});
