"""Nationwide Overture discovery for Dishloopr.

Same rules as discover.py (category, name, chain, OSM fast_food, website check),
applied to every Dutch food place in Overture Maps, with each place assigned to a
municipality (PDOK/Kadaster Bestuurlijke Gebieden, CC BY 4.0) and a Dishloopr city.

Inputs, downloaded once into output/nl/ (see README):
  overture_nl_food.parquet   Overture Places, food_and_drink, NL bounding box
  gemeenten.geojson          PDOK gemeentegebied in CRS84
  dishloopr_cities.json      public cities + city_aliases (for city naming)

Usage:
    python discover_nl.py            # full run incl. website check (slow, ~30 min)
    python discover_nl.py --no-web   # category/name rules only (minutes)

Writes output/nl/<provincie>.csv (with a `city` column for the admin import) and
output/nl/dekking.csv (coverage per municipality). Read-only towards Supabase.
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import duckdb

import discover as d
import webcheck

HERE = Path(__file__).resolve().parent
NL = HERE / "output" / "nl"
NL_BBOX = [3.2, 50.7, 7.3, 53.7]

# Dishloopr's city names for places whose official name differs.
CANONICAL = {"'s-gravenhage": "Den Haag", "s-gravenhage": "Den Haag", "the hague": "Den Haag", "'s-hertogenbosch": "Den Bosch",
             "s-hertogenbosch": "Den Bosch", "den bosch": "Den Bosch", "den haag": "Den Haag"}
MIN_CANDIDATES_FOR_OWN_CITY = 8


# --- Geometry -------------------------------------------------------------------

def _decimate(ring: list, keep: int = 400) -> list:
    step = max(1, len(ring) // keep)
    out = ring[::step]
    if out[-1] != ring[-1]:
        out.append(ring[-1])
    return out


def _in_ring(x: float, y: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi:
            inside = not inside
        j = i
    return inside


class Gemeenten:
    """Point-in-polygon over municipality boundaries, simplified to ~400 vertices per ring."""

    def __init__(self, path: Path):
        self.items = []
        for f in json.loads(path.read_text())["features"]:
            g = f["geometry"]
            polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
            simple = [[_decimate(r) for r in poly] for poly in polys]
            xs = [p[0] for poly in polys for p in poly[0]]
            ys = [p[1] for poly in polys for p in poly[0]]
            self.items.append({
                "naam": f["properties"]["naam"], "code": f["properties"]["identificatie"],
                "provincie": f["properties"]["ligt_in_provincie_naam"],
                "bbox": (min(xs), min(ys), max(xs), max(ys)), "polys": simple,
            })

    def find(self, lat: float, lng: float) -> dict | None:
        for g in self.items:
            x0, y0, x1, y1 = g["bbox"]
            if not (x0 <= lng <= x1 and y0 <= lat <= y1):
                continue
            for poly in g["polys"]:
                if _in_ring(lng, lat, poly[0]) and not any(_in_ring(lng, lat, h) for h in poly[1:]):
                    return g
        return None


class Grid:
    """Buckets (name, lat, lng) tuples in ~1 km cells for fast neighbour lookups."""

    def __init__(self, points):
        self.cells = defaultdict(list)
        for p in points:
            self.cells[(int(p[1] * 100), int(p[2] * 60))].append(p)

    def near(self, lat: float, lng: float) -> list:
        cy, cx = int(lat * 100), int(lng * 60)
        return [p for dy in (-1, 0, 1) for dx in (-1, 0, 1) for p in self.cells.get((cy + dy, cx + dx), [])]


# --- City naming -----------------------------------------------------------------

def place_name(locality: str | None) -> str:
    s = re.sub(r"\s*\([^)]*\)\s*$", "", (locality or "").strip())  # "Hengelo (O)" -> "Hengelo"
    if not s:
        return ""
    if s.isupper() or s.islower():
        s = " ".join(w if w.startswith("'") else w.capitalize() for w in s.lower().split())
        s = re.sub(r"\b(Aan|Den|De|Op|Van|Bij|Ter|Ten|In)\b(?!$)", lambda m: m.group(0).lower(), s)
        s = s[0].upper() + s[1:]
    return CANONICAL.get(s.lower(), s)


def load_city_lookup(path: Path) -> dict[str, tuple[str, str]]:
    """name or alias (lower) -> (Dishloopr city id, city name)."""
    data = json.loads(path.read_text())
    by_id = {c["id"]: c["name"] for c in data["cities"]}
    lookup = {c["name"].lower(): (c["id"], c["name"]) for c in data["cities"]}
    for a in data["aliases"]:
        if a["city_id"] in by_id:
            lookup.setdefault(a["alias_name"].lower(), (a["city_id"], by_id[a["city_id"]]))
    return lookup


def city_provinces(gem: "Gemeenten") -> dict[str, str]:
    """Province per Dishloopr city id, from where its public restaurants are (cities.province is empty)."""
    import urllib.request
    env = dict(l.split("=", 1) for l in (HERE.parent.parent / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
    url, key = env["VITE_SUPABASE_URL"].strip('"'), env["VITE_SUPABASE_PUBLISHABLE_KEY"].strip('"')
    votes: dict[str, Counter] = defaultdict(Counter)
    start = 0
    while True:
        req = urllib.request.Request(f"{url}/rest/v1/restaurants?select=city_id,geo_lat,geo_lng&geo_lat=not.is.null",
                                     headers={"apikey": key, "Authorization": f"Bearer {key}", "Range": f"{start}-{start + 999}"})
        page = json.load(urllib.request.urlopen(req, timeout=60))
        for r in page:
            g = gem.find(r["geo_lat"], r["geo_lng"])
            if g:
                votes[r["city_id"]][g["provincie"]] += 1
        if len(page) < 1000:
            break
        start += 1000
    return {cid: c.most_common(1)[0][0] for cid, c in votes.items()}


# --- Main --------------------------------------------------------------------------

def main() -> None:
    t0 = time.time()
    gem = Gemeenten(NL / "gemeenten.geojson")
    city_lookup = load_city_lookup(NL / "dishloopr_cities.json")
    city_prov = city_provinces(gem)

    con = duckdb.connect()
    cols = ["id", "name", "category", "basic_category", "hierarchy", "confidence", "operating_status",
            "websites", "phones", "street", "locality", "postcode", "country", "lat", "lng", "datasets", "licenses"]
    raw = [dict(zip(cols, r)) for r in con.sql(
        f"SELECT {', '.join(cols)} FROM '{NL / 'overture_nl_food.parquet'}' WHERE name IS NOT NULL "
        "AND (country = 'NL' OR country IS NULL)").fetchall()]

    by_gem: dict[str, list] = defaultdict(list)
    for p in raw:
        g = gem.find(p["lat"], p["lng"])
        if g:
            p["_gem"] = g
            by_gem[g["code"]].append(p)
    print(f"{len(raw)} Overture-plekken, {sum(map(len, by_gem.values()))} binnen een gemeente ({time.time() - t0:.0f}s)")

    nl_city = {"name": "Nederland", "bbox": NL_BBOX}
    osm_grid = Grid([] if "--no-osm" in sys.argv else d.load_osm_fast_food(nl_city))
    existing = d.load_existing(nl_city)
    ex_grid = Grid(existing)
    ex_per_gem = Counter((gem.find(la, ln) or {}).get("code") for _, la, ln in existing)
    print(f"OSM fast_food: {sum(map(len, osm_grid.cells.values()))}, bestaand op Dishloopr: {len(existing)}")

    rows = []
    for code, places in by_gem.items():
        for p in d.dedupe(places):
            status, reason = d.classify(p, osm_grid.near(p["lat"], p["lng"]), ex_grid.near(p["lat"], p["lng"]))
            g = p["_gem"]
            rows.append({
                "status": status, "reason": reason, "name": p["name"], "category": p["category"],
                "street": p["street"], "postcode": p["postcode"], "locality": p["locality"],
                "woonplaats": place_name(p["locality"]) or g["naam"],
                "gemeente": g["naam"], "gemeente_code": code, "provincie": g["provincie"],
                "lat": round(p["lat"], 6), "lng": round(p["lng"], 6),
                "website": (p["websites"] or [""])[0], "phone": (p["phones"] or [""])[0],
                "confidence": round(p["confidence"] or 0, 2), "operating_status": p["operating_status"] or "",
                "overture_id": p["id"], "sources": "|".join(p["datasets"] or []),
                "licenses": "|".join(p["licenses"] or []),
            })
    print(f"Ingedeeld: {dict(Counter(r['status'] for r in rows))} ({time.time() - t0:.0f}s)")

    if "--no-web" not in sys.argv:
        d.apply_website_check(rows, "nl", NL)
        print(f"Na websitecheck: {dict(Counter(r['status'] for r in rows))} ({time.time() - t0:.0f}s)")

    # City per row: an existing Dishloopr city or alias wins; a place with enough candidates
    # gets its own city; otherwise the municipality name keeps tiny villages together.
    # Aliases are ambiguous across the country ("Valkenburg" near Leiden vs Valkenburg aan de
    # Geul), so a name or alias only counts when the city's province matches the row's.
    def existing_city(name: str, prov: str) -> str | None:
        hit = city_lookup.get(name.lower())
        if hit and city_prov.get(hit[0], prov) == prov:
            return hit[1]
        return None

    for r in rows:
        g = place_name(r["gemeente"])
        if r["woonplaats"].lower().startswith(g.lower() + "-"):
            r["woonplaats"] = g
    cand = Counter((r["gemeente_code"], r["woonplaats"]) for r in rows if r["status"] in ("verified", "approve", "review"))
    for r in rows:
        wp, prov = r["woonplaats"], r["provincie"]
        gem_name = place_name(r["gemeente"])
        if wp.lower().startswith(gem_name.lower() + "-"):  # "Almere-Stad", "Almere-Buiten" -> "Almere"
            wp = r["woonplaats"] = gem_name
        r["city"] = (existing_city(wp, prov)
                     or (wp if cand[(r["gemeente_code"], wp)] >= MIN_CANDIDATES_FOR_OWN_CITY else None)
                     or existing_city(place_name(r["gemeente"]), prov)
                     or place_name(r["gemeente"]))
        r["city_is_new"] = "0" if existing_city(r["city"], prov) else "1"

    # A new city name used in two provinces (Hengelo, Bergen) gets a province suffix.
    PROV_ABBR = {"Drenthe": "Dr.", "Flevoland": "Fl.", "Friesland": "Fr.", "Fryslân": "Fr.", "Gelderland": "Gld.",
                 "Groningen": "Gr.", "Limburg": "L.", "Noord-Brabant": "N.-Br.", "Noord-Holland": "N.-H.",
                 "Overijssel": "Ov.", "Utrecht": "U.", "Zeeland": "Z.", "Zuid-Holland": "Z.-H."}
    provs_per_new = defaultdict(set)
    for r in rows:
        if r["city_is_new"] == "1" and r["status"] in ("verified", "approve", "review"):
            provs_per_new[r["city"]].add(r["provincie"])
    for r in rows:
        if r["city_is_new"] == "1" and len(provs_per_new.get(r["city"], ())) > 1:
            r["city"] = f"{r['city']} ({PROV_ABBR.get(r['provincie'], r['provincie'])})"

    order = {"verified": 0, "approve": 1, "review": 2, "duplicate": 3, "reject": 4}
    rows.sort(key=lambda r: (r["provincie"], r["city"], order[r["status"]], r["name"].lower()))
    fields = list(rows[0])
    per_prov = defaultdict(list)
    for r in rows:
        per_prov[r["provincie"]].append(r)
    for prov, prow in per_prov.items():
        with (NL / f"{d.norm(prov).replace(' ', '-')}.csv").open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(prow)

    cov = defaultdict(Counter)
    meta = {}
    for r in rows:
        cov[r["gemeente_code"]][r["status"]] += 1
        meta[r["gemeente_code"]] = (r["provincie"], r["gemeente"])
    with (NL / "dekking.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["provincie", "gemeente", "op_dishloopr", "zeker_goed", "sterk_extra_controle", "twijfel", "al_aanwezig", "afgewezen"])
        for code, c in sorted(cov.items(), key=lambda kv: -(kv[1]["verified"] + kv[1]["approve"] + kv[1]["review"])):
            w.writerow([*meta[code], ex_per_gem.get(code, 0), c["verified"], c["approve"], c["review"], c["duplicate"], c["reject"]])

    total = Counter(r["status"] for r in rows)
    print(f"Klaar in {time.time() - t0:.0f}s: {dict(total)}; {len(per_prov)} provinciebestanden + dekking.csv in {NL}")


if __name__ == "__main__":
    main()
    # Abandoned website-check threads (hung sockets) must not keep the process alive.
    sys.stdout.flush()
    os._exit(0)
