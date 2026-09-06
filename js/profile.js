/* Country profile: one country (default Poland) beside an optional comparison
   country (default Netherlands), with a scatter placing both among the 30. */

function profileSentence(c) {
  const m = c.latest;
  const rec = pct(m.recovery);
  switch (c.archetype) {
    case "backfilling led":
      return `${c.name} recovers ${rec} of its mineral CDW; ${fmt(m.backfilling)} points of that is backfilling, which places it in the backfilling led group.`;
    case "recycling led":
      return `${c.name} recovers ${rec} of its mineral CDW, ${fmt(m.recycling)} points of it through recycling, which places it in the recycling led group.`;
    case "disposal reliant":
      return `${c.name} recovers ${rec} of its mineral CDW and sends ${pct(m.disposal)} to landfill or other disposal, which places it in the disposal reliant group.`;
    case "transition to recycling":
      return `${c.name} recovers ${rec} of its mineral CDW with ${fmt(m.recycling)} points through recycling, up from ${pct(c.recycling_share_2014)} in 2014, which places it in the transition to recycling group.`;
    default:
      return `${c.name} recovers ${rec} of its mineral CDW.`;
  }
}

function profileCardHTML(c, other) {
  const m = c.latest;
  const compare = other
    ? ` Its recycling share ranks ${c.rank_recycling} of 30, against ${other.rank_recycling} for ${other.name}.`
    : "";
  return `
    <h3>${c.name}</h3>
    ${archPill(c)}
    <div style="font-size:.78rem;color:var(--ink3)">Recovery mix, ${m.year}</div>
    ${mixBarHTML(m)}
    <div class="row2">
      <div class="kpi"><div class="lbl">Recovery rate</div><div class="big">${pct(m.recovery)}</div>
        <div class="rank">rank ${c.rank_recovery} of 30</div></div>
      <div class="kpi"><div class="lbl">Recycling share</div><div class="big">${pct(m.recycling)}</div>
        <div class="rank">rank ${c.rank_recycling} of 30</div></div>
    </div>
    <dl>
      <dt>Treated mineral CDW (W121)</dt><dd>${fmtTonnes(m.treated_t)}</dd>
      <dt>Per capita</dt><dd>${m.kg_per_cap == null ? "no data" : fmt(m.kg_per_cap, 0) + " kg"}</dd>
      <dt>Per million EUR construction GVA</dt><dd>${m.t_per_meur_gva == null ? "no data" : fmt(m.t_per_meur_gva, 0) + " t"}</dd>
      <dt>Recycled CDW in aggregate supply</dt><dd>${c.secondary_share_pct == null ? "no material flow account" : pct(c.secondary_share_pct)}</dd>
      <dt>Landfill tax</dt><dd>${taxLine(c)}</dd>
      <dt>Regulatory quality (WGI)</dt><dd>${fmt(c.regulatory_quality, 2)}</dd>
      <dt>Coded instruments</dt><dd>${c.instrument_count} of 6</dd>
    </dl>
    <div class="pills">${instrumentPills(c)}</div>
    <p class="sentence">${profileSentence(c)}${compare}</p>`;
}

function initProfile(DATA) {
  const selA = document.getElementById("profile-a");
  const selB = document.getElementById("profile-b");
  const entries = coreCountries(DATA).sort((a, b) => a.name.localeCompare(b.name));
  const fill = (sel, withNone) => {
    if (withNone) {
      const o = document.createElement("option");
      o.value = ""; o.textContent = "None"; sel.appendChild(o);
    }
    entries.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.geo; o.textContent = c.name; sel.appendChild(o);
    });
  };
  fill(selA, false);
  fill(selB, true);
  selA.value = "PL" in DATA.countries ? "PL" : entries[0].geo;
  selB.value = "NL" in DATA.countries ? "NL" : "";

  const ch = echarts.init(document.getElementById("chart-profile"));

  function render() {
    const a = DATA.countries[selA.value];
    const b = selB.value ? DATA.countries[selB.value] : null;
    document.getElementById("profile-card-a").innerHTML = profileCardHTML(a, b);
    document.getElementById("profile-card-b").innerHTML = b ? profileCardHTML(b, a)
      : "<p style='color:var(--ink3)'>Pick a comparison country to see it beside the first one.</p>";

    const picked = new Set([selA.value, selB.value].filter(Boolean));
    const series = ARCH_ORDER.map((arch) => ({
      name: capital(arch), type: "scatter", symbolSize: 9,
      itemStyle: { color: ARCH[arch], opacity: .55, borderColor: "#000", borderWidth: .5 },
      data: entries.filter((c) => c.archetype === arch && !picked.has(c.geo))
        .map((c) => ({ value: [c.latest.recovery, c.latest.recycling], c })),
    }));
    series.push({
      name: "Selected", type: "scatter", symbolSize: 18, z: 5,
      itemStyle: { color: (p) => ARCH[p.data.c.archetype], borderColor: "#000", borderWidth: 1 },
      label: { show: true, position: "top", fontWeight: 600, color: C.ink,
               formatter: (p) => p.data.c.name },
      data: [a, b].filter(Boolean).map((c) => ({ value: [c.latest.recovery, c.latest.recycling], c })),
    });
    ch.setOption({
      grid: baseGrid(),
      legend: { top: 4, textStyle: { color: C.ink2 }, data: ARCH_ORDER.map(capital) },
      tooltip: { formatter: (p) => {
        const c = p.data.c;
        return `<b>${c.name}</b> ${c.latest.year}<br>recovery ${pct(c.latest.recovery)}, recycling ${pct(c.latest.recycling)}<br>${capital(c.archetype)}`;
      } },
      xAxis: { min: 65, max: 100, name: "Recovery rate, recycling plus backfilling (%)",
               nameLocation: "middle", nameGap: 28, ...AXIS },
      yAxis: { min: 0, max: 100, name: "Recycling share (%)", nameLocation: "middle", nameGap: 40, ...AXIS },
      series,
    }, { notMerge: true });
  }

  selA.addEventListener("change", render);
  selB.addEventListener("change", render);
  render();
  return ch;
}
