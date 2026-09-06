"""Build the web app data files (data/*.json) from 02_analysis results.

Not deployed: only index.html, css/, js/, data/ ship. Run again whenever the
analyses change:  python _build_data.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
A = HERE.parent / "02_analysis"
P1_GEO = HERE.parent.parent / "Paper_1_EPR" / "05_web_app" / "data" / "world.geojson"
DATA = HERE / "data"
DATA.mkdir(exist_ok=True)

YEARS = [2010, 2012, 2014, 2016, 2018, 2020, 2022]

# Eurostat geo (ISO2 with EL and UK) -> ISO3 used by the geojson "iso3c" field.
ISO2_TO_ISO3 = {
    "AL": "ALB", "AT": "AUT", "BA": "BIH", "BE": "BEL", "BG": "BGR", "CH": "CHE",
    "CY": "CYP", "CZ": "CZE", "DE": "DEU", "DK": "DNK", "EE": "EST", "EL": "GRC",
    "ES": "ESP", "FI": "FIN", "FR": "FRA", "HR": "HRV", "HU": "HUN", "IE": "IRL",
    "IS": "ISL", "IT": "ITA", "LI": "LIE", "LT": "LTU", "LU": "LUX", "LV": "LVA",
    "ME": "MNE", "MK": "MKD", "MT": "MLT", "NL": "NLD", "NO": "NOR", "PL": "POL",
    "PT": "PRT", "RO": "ROU", "RS": "SRB", "SE": "SWE", "SI": "SVN", "SK": "SVK",
    "TR": "TUR", "UK": "GBR", "XK": "XKX", "UA": "UKR", "MD": "MDA", "BY": "BLR",
}
# Countries too small for the 1:110m base map get a clickable point marker.
POINT_COORDS = {"MT": [14.40, 35.90], "LI": [9.55, 47.15]}

INSTRUMENTS = [
    ("landfill_tax", "Landfill tax"),
    ("cdw_landfill_restriction", "CDW landfill restriction"),
    ("predemolition_audit", "Pre demolition audit"),
    ("sorting_obligation", "Sorting obligation"),
    ("recycled_aggregate_regulation", "Recycled aggregate regulation"),
    ("aggregates_levy", "Aggregates levy"),
    ("construction_epr", "Construction EPR"),
]


def r(folder, name):
    return pd.read_csv(A / folder / "results" / name)


def clean(o):
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.bool_, bool)):
        return bool(o)
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if o != o else round(float(o), 4)
    return o


def dump(obj, name):
    (DATA / name).write_text(json.dumps(clean(obj), ensure_ascii=False,
                                        separators=(",", ":")), encoding="utf-8")
    print(f"data/{name}  {(DATA / name).stat().st_size / 1e3:.0f} KB")


def val(x):
    return None if pd.isna(x) else x


def flag(x):
    return None if pd.isna(x) else int(x)


# ---------- countries.json ----------
panel = r("01_descriptives", "cdw_master_panel.csv")
static = r("01_descriptives", "cdw_country_static.csv").set_index("geo")
typ = r("04_pathway_typology", "typology_assignments.csv").set_index("geo")
agg = r("20_aggregates_supply", "cross_section.csv").set_index("geo")
tax = r("08_policy_instruments", "tax_rate_scatter.csv").set_index("geo")

panel = panel[panel["geo"] != "EU28"].copy()
panel.loc[panel["geo"] == "EU27_2020", "geo"] = "EU27"

# Ranks among the 30 core countries (1 = highest), on the typology reporting year.
typ["rank_recovery"] = typ["recovery_r_b_pct"].rank(ascending=False, method="min").astype(int)
typ["rank_recycling"] = typ["recycling_share"].rank(ascending=False, method="min").astype(int)

countries = {}
for geo, g in panel.groupby("geo"):
    g = g.set_index("year")
    core = geo in typ.index
    is_eu = geo == "EU27"

    def series(col):
        return [val(g.at[y, col]) if y in g.index else None for y in YEARS]

    ser = {
        "years": YEARS,
        "recycling": series("recycling_pct"),
        "backfilling": series("backfilling_pct"),
        "energy": series("energy_recovery_pct"),
        "disposal": series("disposal_pct"),
        "landfill": series("landfill_pct"),
        "recovery": series("recovery_r_b_pct"),
        "treated_t": series("w121_treated_t"),
    }

    # Reference year: typology reporting year for core countries (Sweden 2020),
    # otherwise the latest wave with data.
    ref_year = int(typ.at[geo, "reporting_year"]) if core else int(g.index.max())
    row = g.loc[ref_year]
    latest = {
        "year": ref_year,
        "recycling": val(row["recycling_pct"]),
        "backfilling": val(row["backfilling_pct"]),
        "energy": val(row["energy_recovery_pct"]),
        "disposal": val(row["disposal_pct"]),
        "landfill": val(row["landfill_pct"]),
        "recovery": val(row["recovery_r_b_pct"]),
        "treated_t": val(row["w121_treated_t"]),
        "kg_per_cap": val(row["w121_kg_per_cap"]),
        "t_per_meur_gva": val(row["w121_t_per_meur_gva"]),
    }

    st = static.loc[geo] if geo in static.index else None
    name = "EU27" if is_eu else g["country"].iloc[0]
    entry = {
        "name": name,
        "geo_name": None if is_eu else ISO2_TO_ISO3.get(geo),
        "point": POINT_COORDS.get(geo),
        "core": core,
        "aggregate": is_eu,
        "eu27": flag(row["eu27"]) if not is_eu else 1,
        "archetype": typ.at[geo, "archetype"] if core else None,
        "archetype_order": int(typ.at[geo, "archetype_order"]) if core else None,
        "series": ser,
        "latest": latest,
        "population": val(row["population"]),
        "constr_gva_meur": val(row["constr_gva_meur"]),
        "gdp_per_cap_eur": val(row["gdp_per_cap_eur"]),
        "governance": val(row["governance"]),
        "regulatory_quality": val(row["regulatory_quality"]),
        "instruments": {k: (flag(st[k]) if st is not None else None) for k, _ in INSTRUMENTS},
        "instrument_count": (int(sum((flag(st[k]) or 0) for k, _ in INSTRUMENTS[:6]))
                             if st is not None else None),
        "landfill_tax_rate": val(st["landfill_tax_rate_eur_t_2021"]) if st is not None else None,
        "landfill_tax_since": flag(st["landfill_tax_since"]) if st is not None else None,
        "secondary_share_pct": val(agg.at[geo, "secondary_share_pct"]) if geo in agg.index else None,
        "primary_agg_t_per_cap": val(agg.at[geo, "primary_agg_t_per_cap"]) if geo in agg.index else None,
        "rank_recovery": int(typ.at[geo, "rank_recovery"]) if core else None,
        "rank_recycling": int(typ.at[geo, "rank_recycling"]) if core else None,
        "recycling_share_2014": val(typ.at[geo, "recycling_share_2014"]) if core else None,
        "d_recycling": val(typ.at[geo, "d_recycling"]) if core else None,
    }
    countries[geo] = entry

n_core = sum(1 for c in countries.values() if c["core"])
assert n_core == 30, n_core
assert "EU27" in countries
dump(countries, "countries.json")

# ---------- world.geojson (Europe window of the Paper 1 base map) ----------
geo = json.loads(P1_GEO.read_text(encoding="utf-8"))
# Europe proper plus its eastern neighbours; Russia, Greenland and the Middle
# East are left out so the auto fit of the view centres on the 30 countries.
EUROPE_ISO3 = set(ISO2_TO_ISO3.values()) | {"UKR", "BLR", "MDA", "TUR"}

LON0, LON1, LAT0, LAT1 = -26, 46, 33, 72


def in_window(poly):
    """Keep a polygon part only if its outer ring lies inside the Europe window
    (drops French Guiana, Svalbard, the Canaries and similar)."""
    ring = poly[0]
    lon = sum(p[0] for p in ring) / len(ring)
    lat = sum(p[1] for p in ring) / len(ring)
    return LON0 <= lon <= LON1 and LAT0 <= lat <= LAT1


feats = []
for f in geo["features"]:
    if f["properties"]["iso3c"] not in EUROPE_ISO3:
        continue
    g = f["geometry"]
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    polys = [p for p in polys if in_window(p)]
    if not polys:
        continue
    feats.append({"type": "Feature",
                  "properties": {"iso3c": f["properties"]["iso3c"],
                                 "NAME": f["properties"].get("NAME")},
                  "geometry": {"type": "MultiPolygon", "coordinates": polys}})
(DATA / "world.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats},
                                               separators=(",", ":")), encoding="utf-8")
print(f"data/world.geojson  {(DATA / 'world.geojson').stat().st_size / 1e3:.0f} KB "
      f"({len(feats)} features)")
geo_names = {f["properties"]["iso3c"] for f in feats}
missing = [g for g, c in countries.items() if c["core"] and c["geo_name"] not in geo_names]
print("core countries not in base map (drawn as markers):", missing)

# ---------- trends.json ----------
eu = panel[panel["geo"] == "EU27"].sort_values("year")
sigma = r("12_convergence", "sigma_convergence.csv").sort_values("year")
comp = r("05_sector_composition", "eu27_composition.csv").sort_values("year")
aggt = r("20_aggregates_supply", "eu27_trend.csv").sort_values("year")
trends = {
    "eu27": {
        "years": eu["year"].tolist(),
        "recycling": eu["recycling_pct"].tolist(),
        "backfilling": eu["backfilling_pct"].tolist(),
        "energy": eu["energy_recovery_pct"].tolist(),
        "disposal": eu["disposal_pct"].tolist(),
        "landfill": eu["landfill_pct"].tolist(),
        "recovery": eu["recovery_r_b_pct"].tolist(),
        "treated_mt": (eu["w121_treated_t"] / 1e6).tolist(),
    },
    "sigma": {
        "years": sigma["year"].tolist(),
        "n": sigma["n"].tolist(),
        "recycling_sd": sigma["recycling_sd"].tolist(),
        "backfilling_sd": sigma["backfilling_sd"].tolist(),
        "landfill_sd": sigma["landfill_sd"].tolist(),
        "recycling_mean": sigma["recycling_mean"].tolist(),
        "backfilling_mean": sigma["backfilling_mean"].tolist(),
        "landfill_mean": sigma["landfill_mean"].tolist(),
    },
    "composition": {
        "years": comp["year"].tolist(),
        "total_mt": comp["total_mt"].tolist(),
        "soils_pct": comp["soils_pct"].tolist(),
        "mineral_cdw_pct": comp["mineral_cdw_pct"].tolist(),
        "other_pct": (comp["wood_pct"] + comp["plastics_pct"] + comp["glass_pct"]
                      + comp["mixed_pct"]).tolist(),
        "remainder_pct": comp["remainder_pct"].tolist(),
    },
    "aggregates": {
        "years": aggt["year"].tolist(),
        "secondary_share_pct": aggt["secondary_share_pct"].tolist(),
        "primary_agg_t_per_cap": aggt["primary_agg_t_per_cap"].tolist(),
        "recycled_t_per_cap": aggt["recycled_t_per_cap"].tolist(),
    },
}
dump(trends, "trends.json")

# ---------- construction.json ----------
cs = r("20_aggregates_supply", "cross_section.csv")
grp = r("20_aggregates_supply", "secondary_share_groups.csv")
lw = r("20_aggregates_supply", "lowess_backfilling.csv")
construction = {
    "cross_section": [{
        "geo": row["geo"], "country": row["country"], "archetype": row["archetype"],
        "archetype_order": int(row["archetype_order"]),
        "secondary_share_pct": val(row["secondary_share_pct"]),
        "primary_agg_t_per_cap": val(row["primary_agg_t_per_cap"]),
        "backfilling_pct": val(row["backfilling_pct"]),
        "recycling_pct": val(row["recycling_pct"]),
        "reporting_year": int(row["reporting_year"]),
        "label": bool(row["label_in_scatter"]),
    } for _, row in cs.iterrows()],
    "groups": grp[grp["group_kind"] == "archetype"][
        ["group", "n", "median", "q1", "q3", "min", "max"]].to_dict("records"),
    "all_median": float(grp.loc[grp["group_kind"] == "all", "median"].iloc[0]),
    "lowess": lw[["primary_agg_t_per_cap", "lowess", "band_lo", "band_hi"]].to_dict("list"),
}
dump(construction, "construction.json")

# ---------- instruments.json ----------
gm = r("08_policy_instruments", "group_medians.csv")
gm = gm[gm["outcome"] == "recycling_pct"]
ts = r("08_policy_instruments", "tax_rate_scatter.csv")
ev = r("09_panel_fixed_effects", "event_means.csv")
sw = r("09_panel_fixed_effects", "switchers.csv")
switchers = sw[sw["tax_switch"] == 1]
instruments = {
    "medians": [{
        "instrument": row["instrument"], "label": row["label"],
        "n_with": int(row["n_with"]), "median_with": val(row["median_with"]),
        "n_without": int(row["n_without"]), "median_without": val(row["median_without"]),
        "countries_with": row["countries_with"],
    } for _, row in gm.iterrows()],
    "tax_scatter": [{
        "geo": row["geo"], "country": row["country"], "tax_rate": val(row["tax_rate"]),
        "zero_rate": bool(row["zero_rate"]), "recycling_pct": val(row["recycling_pct"]),
        "backfilling_pct": val(row["backfilling_pct"]), "landfill_pct": val(row["landfill_pct"]),
        "instrument_count": flag(row["instrument_count"]),
        "archetype": typ.at[row["geo"], "archetype"] if row["geo"] in typ.index else None,
    } for _, row in ts.iterrows()],
    "event": [{
        "rel_year": int(row["rel_year"]), "outcome": row["outcome"], "n": int(row["n"]),
        "mean": val(row["mean"]), "countries": row["countries"],
    } for _, row in ev.iterrows() if row["n"] >= 3],
    "switchers": [{
        "geo": row["geo"], "country": row["country"],
        "tax_since": flag(row["landfill_tax_since"]),
        "first_wave": flag(row["tax_first_wave_in_force"]),
    } for _, row in switchers.iterrows()],
}
dump(instruments, "instruments.json")

# ---------- world.json ----------
w = r("14_global_context", "waw3_cdw_countries.csv")
world = {
    "countries": [{
        "iso3": row["iso3"], "country": row["country"], "region": row["region"],
        "income": row["income_group"], "cdw_t": val(row["cdw_t"]),
        "kg_per_cap": val(row["cdw_kg_per_cap"]), "gdp_pc_ppp": val(row["gdp_pc_ppp"]),
        "europe": flag(row["europe"]),
    } for _, row in w.iterrows()],
    "n_reporting": int(w["cdw_t"].notna().sum()),
    "total_gt": float(w["cdw_t"].sum() / 1e9),
    "top3_share_pct": float(w.nlargest(3, "cdw_t")["cdw_t"].sum() / w["cdw_t"].sum() * 100),
    "top3": w.nlargest(3, "cdw_t")["country"].tolist(),
}
dump(world, "world.json")

# ---------- meta.json (headline numbers used in copy) ----------
core = typ.copy()
eu22 = eu[eu["year"] == 2022].iloc[0]
eu14 = eu[eu["year"] == 2014].iloc[0]
meta = {
    "n_countries": int(len(core)),
    "n_above_target": int((core["recovery_r_b_pct"] >= 70).sum()),
    "recovery_min": float(core["recovery_r_b_pct"].min()),
    "recovery_max": float(core["recovery_r_b_pct"].max()),
    "recovery_median": float(core["recovery_r_b_pct"].median()),
    "recycling_min": float(core["recycling_share"].min()),
    "recycling_max": float(core["recycling_share"].max()),
    "recycling_median": float(core["recycling_share"].median()),
    "spearman_recovery_recycling": float(core["recovery_r_b_pct"].corr(
        core["recycling_share"], method="spearman")),
    "eu27_recycling_2014": float(eu14["recycling_pct"]),
    "eu27_recycling_2022": float(eu22["recycling_pct"]),
    "eu27_recovery_2014": float(eu14["recovery_r_b_pct"]),
    "eu27_recovery_2022": float(eu22["recovery_r_b_pct"]),
    "eu27_landfill_2014": float(eu14["landfill_pct"]),
    "eu27_landfill_2022": float(eu22["landfill_pct"]),
    "eu27_backfilling_2014": float(eu14["backfilling_pct"]),
    "eu27_backfilling_2022": float(eu22["backfilling_pct"]),
    "secondary_share_eu27_2022": float(aggt.loc[aggt["year"] == 2022, "secondary_share_pct"].iloc[0]),
    "secondary_share_eu27_2010": float(aggt.loc[aggt["year"] == 2010, "secondary_share_pct"].iloc[0]),
    "sector_total_mt_2022": float(comp.loc[comp["year"] == 2022, "total_mt"].iloc[0]),
    "sector_total_mt_2010": float(comp.loc[comp["year"] == 2010, "total_mt"].iloc[0]),
    "archetype_counts": core["archetype"].value_counts().to_dict(),
    "backfilling_led": core[core["archetype"] == "backfilling led"]["country"].tolist(),
    "built": "2026-09-05",
}
dump(meta, "meta.json")

# Sanity: every JSON parses.
for p in DATA.glob("*.json"):
    json.loads(p.read_text(encoding="utf-8"))
json.loads((DATA / "world.geojson").read_text(encoding="utf-8"))
print("done")
