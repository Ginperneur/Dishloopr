"""Overture Maps discovery for Dishloopr (pilot).

Finds dish-first sit-down restaurants for one city from the Overture Maps
Places theme (CDLA Permissive 2.0 / CC0 / Apache 2.0, attribution required),
and sorts each candidate into approve / review / reject using the rules of the
restaurant-approval skill. No Google data is used.

OpenStreetMap fast_food points are queried live as an extra exclusion signal
only; no OSM data is written to the output (see README for the ODbL reason).

Usage:
    python discover.py zwolle            # writes output/zwolle.csv + summary
    python discover.py zwolle --no-osm   # skip the OSM cross-check

Needs: duckdb (pip install duckdb). Read-only: never writes to Supabase.
"""
from __future__ import annotations

import csv
import json
import math
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

import duckdb

HERE = Path(__file__).resolve().parent
RELEASE = os.environ.get("OVERTURE_RELEASE", "2026-10-21.0")

CITIES = json.loads((HERE / "cities.json").read_text())

# --- Category rules (Overture taxonomy.primary) ------------------------------

# Never a fit: fast food, takeaway snack formats, shops, drinks-first venues.
REJECT_CATEGORIES = {
    "fast_food_restaurant", "doner_kebab_restaurant", "cafeteria",
    "food_truck_stand", "food_court", "sandwich_shop", "bagel_shop",
    "bakery", "ice_cream_shop", "gelato_shop", "frozen_yogurt_shop",
    "dessert_shop", "cupcake_shop", "candy_store", "chocolatier",
    "delicatessen", "coffee_shop", "cafe", "tea_room", "bubble_tea_shop",
    "smoothie_juice_bar", "juice_bar", "bar", "pub", "lounge", "cocktail_bar",
    "wine_bar", "beer_bar", "night_club", "hookah_bar", "food_bank",
    "food_service", "caterer", "brewery", "distillery", "sports_bar",
    "hotel_bar", "gay_bar", "coffee_roastery", "beer_garden", "food_and_drink",
}

# Overture basic categories that are drinks/shop-first (checked in addition to the
# primary category, which is often too fine-grained to list exhaustively).
REJECT_BASIC = {"bar", "cafe", "coffee_shop", "food_and_beverage_store", "lounge",
                "alcoholic_beverage_venue", "non_alcoholic_beverage_venue"}

# Can be a fit, but often isn't: always needs a human look.
REVIEW_CATEGORIES = {
    "burger_restaurant", "chicken_restaurant", "chicken_wings_restaurant",
    "halal_restaurant", "theme_restaurant", "diner", "buffet_restaurant",
    "wok_restaurant", "falafel_restaurant", "hot_dog_restaurant",
    "fish_and_chips_restaurant", "breakfast_and_brunch_restaurant",
    "tapas_bar", "gastropub", "poke_restaurant",
}

# Drinks venues whose name says food is primary are worth a human look.
FOOD_FIRST_NAME = re.compile(r"\b(eetcaf[eé]|restaurant|brasserie|bistro|eethuis|keuken)\b", re.I)

# --- Name rules ----------------------------------------------------------------

CHAINS_REJECT = [
    "mcdonald", "burger king", "kfc", "domino", "new york pizza", "subway",
    "smullers", "kwalitaria", "febo", "bram ladage", "backwerk", "verhage",
    "taco bell", "five guys", "starbucks", "wok to walk", "eat fresh subs",
    "doner company", "bagels & beans", "spare rib express", "snackpoint",
    "manneken pis", "papa john", "popeyes", "wendy", "dunkin",
]

NAME_REJECT = re.compile(
    r"snack|cafetaria|frituur|friet|frites|fries\b|d[oö]ner|kebab|kebap|"
    r"shoarma|shawarma|lunchroom|broodje|sandwich|bakkerij|bakery|"
    r"\bijs(salon|winkel)?\b|gelato|foodtruck|food truck|oliebol|"
    r"kassasysteem|\bkantoor\b|coffee|koffie|lunch|shakes?\b|croissant|"
    r"cash and carry|dieetvoeding|leather",
    re.I,
)

# Self-service / fast-casual chains: not fastfood, but not clearly dish-first.
CHAINS_REVIEW = ["la place", "bagels", "poke bowl king", "wok to go"]

# Takeaway/delivery-first or non-restaurant wording: a human checks it.
NAME_REVIEW = re.compile(
    r"to go\b|afhaal|bezorg|take ?away|voor thuis|catering|\bgrill\s?room\b|"
    r"kantine|canteen|\btoko\b|\bexpress\b|street ?food|\bzorg\b|beaut|"
    r"\bbeer\b|\bpub\b|dublin|irish|spin\b|kumpir|\bhot ?dog|dogtails|rotishop|"
    r"food cent|\bgift\b|^restaurant$",
    re.I,
)

APPROVE_MIN_CONFIDENCE = 0.75
REJECT_MAX_CONFIDENCE = 0.5  # strictly below this is rejected


def norm(s: str | None) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def meters(lat1, lng1, lat2, lng2) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def similar(a: str, b: str) -> bool:
    a, b = norm(a), norm(b)
    if not a or not b:
        return False
    if a == b or a in b or b in a:
        return True
    ta, tb = set(a.split()), set(b.split())
    return len(ta & tb) / max(1, min(len(ta), len(tb))) >= 0.75


# --- Data loading ----------------------------------------------------------------

def load_overture(city: dict) -> list[dict]:
    con = duckdb.connect()
    con.sql("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
    w, s, e, n = city["bbox"]
    src = f"read_parquet('s3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*', hive_partitioning=1)"
    rows = con.sql(f"""
        SELECT id, names.primary AS name, taxonomy.primary AS category,
               basic_category, taxonomy.hierarchy AS hierarchy, confidence,
               operating_status, websites, phones,
               addresses[1].freeform AS street, addresses[1].locality AS locality,
               addresses[1].postcode AS postcode,
               (bbox.ymin + bbox.ymax) / 2 AS lat, (bbox.xmin + bbox.xmax) / 2 AS lng,
               list_distinct([x.dataset for x in sources]) AS datasets,
               list_distinct([x.license for x in sources]) AS licenses
        FROM {src}
        WHERE bbox.xmin BETWEEN {w} AND {e} AND bbox.ymin BETWEEN {s} AND {n}
          AND list_contains(taxonomy.hierarchy, 'food_and_drink')
    """).fetchall()
    cols = ["id", "name", "category", "basic_category", "hierarchy", "confidence",
            "operating_status", "websites", "phones", "street", "locality",
            "postcode", "lat", "lng", "datasets", "licenses"]
    return [dict(zip(cols, r)) for r in rows]


def in_city(p: dict, city: dict) -> bool:
    pc = (p["postcode"] or "").replace(" ", "")
    if pc and any(pc.startswith(x) for x in city["postcode_prefixes"]):
        return True
    return norm(p["locality"]) in {norm(x) for x in city["localities"]}


def load_osm_fast_food(city: dict) -> list[tuple[str, float, float]]:
    """Live OSM fast_food points, used only as an exclusion signal.

    Cached for 7 days in output/ (local working file, never imported) because
    the public Overpass service is often overloaded.
    """
    import time
    cache = HERE / "output" / f".osm_fast_food_{norm(city['name']).replace(' ', '_')}.json"
    if cache.exists() and time.time() - cache.stat().st_mtime < 7 * 86400:
        return [tuple(x) for x in json.loads(cache.read_text())]
    w, s, e, n = city["bbox"]
    q = f'[out:json][timeout:60];nwr["amenity"="fast_food"]({s},{w},{n},{e});out center tags;'
    els = None
    for endpoint in ["https://overpass-api.de/api/interpreter",
                     "https://overpass.kumi.systems/api/interpreter",
                     "https://overpass-api.de/api/interpreter"]:
        req = urllib.request.Request(
            endpoint, data=urllib.parse.urlencode({"data": q}).encode(),
            headers={"User-Agent": "overture-discovery-script"})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                els = json.load(r)["elements"]
            break
        except Exception as exc:  # flaky public service: try the next one
            print(f"Overpass {endpoint} faalde: {exc}", file=sys.stderr)
    if els is None:
        print("WAARSCHUWING: geen OSM-controle uitgevoerd", file=sys.stderr)
        return []
    out = []
    for el in els:
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lng = el.get("lon") or el.get("center", {}).get("lon")
        name = el.get("tags", {}).get("name")
        if lat and lng and name:
            out.append((name, lat, lng))
    cache.parent.mkdir(exist_ok=True)
    cache.write_text(json.dumps(out))
    return out


def load_existing(city: dict) -> list[tuple[str, float, float]]:
    """Existing Dishloopr restaurants near the city (public read), for dedup."""
    env = {}
    env_path = HERE.parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"')
    url, key = env.get("VITE_SUPABASE_URL"), env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        return []
    w, s, e, n = city["bbox"]
    out, start = [], 0
    while True:
        q = (f"{url}/rest/v1/restaurants?select=name,geo_lat,geo_lng"
             f"&geo_lat=gte.{s}&geo_lat=lte.{n}&geo_lng=gte.{w}&geo_lng=lte.{e}")
        req = urllib.request.Request(q, headers={
            "apikey": key, "Authorization": f"Bearer {key}", "Range": f"{start}-{start + 999}"})
        with urllib.request.urlopen(req, timeout=60) as r:
            page = json.load(r)
        out += [(x["name"], x["geo_lat"], x["geo_lng"]) for x in page if x["geo_lat"]]
        if len(page) < 1000:
            return out
        start += 1000


# --- Classification ------------------------------------------------------------

def classify(p: dict, osm_ff, existing) -> tuple[str, str]:
    name, cat = p["name"] or "", p["category"] or ""
    lname = name.lower()
    conf = p["confidence"] or 0

    if p["operating_status"] in ("permanently_closed", "temporarily_closed"):
        return "reject", f"status: {p['operating_status']}"
    for ex_name, la, ln in existing:
        if meters(p["lat"], p["lng"], la, ln) < 120 and similar(name, ex_name):
            return "duplicate", f"staat al op Dishloopr: {ex_name}"
    if any(c in lname for c in CHAINS_REJECT):
        return "reject", "fastfoodketen"
    if NAME_REJECT.search(name):
        return "reject", f"naam: {NAME_REJECT.search(name).group(0)}"
    drinks_first = cat in REJECT_CATEGORIES or p["basic_category"] in REJECT_BASIC
    if drinks_first and not FOOD_FIRST_NAME.search(name):
        return "reject", f"categorie: {cat}"
    if conf < REJECT_MAX_CONFIDENCE:
        return "reject", f"lage betrouwbaarheid ({conf:.2f})"
    # OSM sometimes tags sit-down pizzerias as fast_food, so this only demotes.
    for ff_name, la, ln in osm_ff:
        if meters(p["lat"], p["lng"], la, ln) < 60 and similar(name, ff_name):
            return "review", "OSM: fast_food"

    is_restaurant = "restaurant" in (p["hierarchy"] or []) or p["basic_category"] == "restaurant"
    if any(c in lname for c in CHAINS_REVIEW):
        return "review", "zelfbedienings- of fastcasualketen"
    if drinks_first:
        return "review", f"eetcafé-achtige naam, categorie {cat}"
    if cat in REVIEW_CATEGORIES:
        return "review", f"twijfelcategorie: {cat}"
    if NAME_REVIEW.search(name):
        return "review", f"naam wijst op afhaal: {NAME_REVIEW.search(name).group(0)}"
    if not is_restaurant:
        return "review", f"geen restaurantcategorie: {cat}"
    if conf < APPROVE_MIN_CONFIDENCE:
        return "review", f"betrouwbaarheid {conf:.2f}"
    if not (p["websites"] or p["phones"]):
        return "review", "geen website of telefoon"
    return "approve", f"{cat}, betrouwbaarheid {conf:.2f}"


def dedupe(places: list[dict]) -> list[dict]:
    """Collapse Overture rows for the same venue (same-ish name within 80 m)."""
    places = sorted(places, key=lambda p: -(p["confidence"] or 0))
    kept: list[dict] = []
    for p in places:
        if any(meters(p["lat"], p["lng"], k["lat"], k["lng"]) < 80 and similar(p["name"], k["name"]) for k in kept):
            continue
        kept.append(p)
    return kept


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args or args[0] not in CITIES:
        sys.exit(f"usage: discover.py <city> [--no-osm]   cities: {', '.join(CITIES)}")
    slug = args[0]
    city = CITIES[slug]

    raw = load_overture(city)
    places = dedupe([p for p in raw if p["name"] and in_city(p, city)])
    osm_ff = [] if "--no-osm" in sys.argv else load_osm_fast_food(city)
    existing = load_existing(city)

    out_dir = HERE / "output"
    out_dir.mkdir(exist_ok=True)
    rows = []
    for p in places:
        status, reason = classify(p, osm_ff, existing)
        rows.append({
            "status": status, "reason": reason, "name": p["name"],
            "category": p["category"], "street": p["street"],
            "postcode": p["postcode"], "locality": p["locality"],
            "lat": round(p["lat"], 6), "lng": round(p["lng"], 6),
            "website": (p["websites"] or [""])[0], "phone": (p["phones"] or [""])[0],
            "confidence": round(p["confidence"] or 0, 2),
            "operating_status": p["operating_status"] or "",
            "overture_id": p["id"], "sources": "|".join(p["datasets"] or []),
            "licenses": "|".join(p["licenses"] or []),
        })
    order = {"approve": 0, "review": 1, "duplicate": 2, "reject": 3}
    rows.sort(key=lambda r: (order[r["status"]], r["name"].lower()))

    path = out_dir / f"{slug}.csv"
    with path.open("w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0]))
        wr.writeheader()
        wr.writerows(rows)

    counts = Counter(r["status"] for r in rows)
    reasons = Counter(r["reason"].split(":")[0].split(" (")[0] for r in rows if r["status"] == "reject")
    print(f"{city['name']}: {len(raw)} eet/drink-plekken in kader, {len(places)} in stad na dedup")
    print(f"OSM fast_food-punten: {len(osm_ff)}, bestaande Dishloopr-restaurants in kader: {len(existing)}")
    print("Uitkomst:", dict(counts))
    print("Afwijsredenen:", dict(reasons.most_common()))
    print(f"Geschreven: {path}")


if __name__ == "__main__":
    main()
