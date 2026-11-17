"""Download the inputs for discover_nl.py into output/nl/ (re-run per Overture release).

- Overture Maps Places, food_and_drink inside the NL bounding box (~18 MB parquet)
- PDOK/Kadaster Bestuurlijke Gebieden: gemeentegebied in CRS84 (~28 MB, CC BY 4.0)
- Dishloopr public cities + city_aliases (for city naming)
"""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

import duckdb

HERE = Path(__file__).resolve().parent
NL = HERE / "output" / "nl"
RELEASE = os.environ.get("OVERTURE_RELEASE", "2026-10-21.0")
UA = {"User-Agent": "boundary-fetch-script"}


def overture() -> None:
    con = duckdb.connect()
    con.sql("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
    src = f"read_parquet('s3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*', hive_partitioning=1)"
    con.sql(f"""COPY (SELECT id, names.primary AS name, taxonomy.primary AS category, basic_category,
        taxonomy.hierarchy AS hierarchy, confidence, operating_status, websites, phones,
        addresses[1].freeform AS street, addresses[1].locality AS locality, addresses[1].postcode AS postcode,
        addresses[1].country AS country, (bbox.ymin + bbox.ymax) / 2 AS lat, (bbox.xmin + bbox.xmax) / 2 AS lng,
        list_distinct([x.dataset for x in sources]) AS datasets, list_distinct([x.license for x in sources]) AS licenses
        FROM {src} WHERE bbox.xmin BETWEEN 3.2 AND 7.3 AND bbox.ymin BETWEEN 50.7 AND 53.7
          AND list_contains(taxonomy.hierarchy, 'food_and_drink'))
        TO '{NL / 'overture_nl_food.parquet'}' (FORMAT parquet)""")


def gemeenten() -> None:
    url = ("https://api.pdok.nl/kadaster/bestuurlijkegebieden/ogc/v1/collections/gemeentegebied/items"
           "?f=json&limit=100&crs=http%3A%2F%2Fwww.opengis.net%2Fdef%2Fcrs%2FOGC%2F1.3%2FCRS84")
    feats = []
    while url:
        page = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120))
        feats += page["features"]
        url = next((l["href"] for l in page["links"] if l["rel"] == "next"), None)
    (NL / "gemeenten.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}))


def cities() -> None:
    env = dict(l.split("=", 1) for l in (HERE.parent.parent / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
    url, key = env["VITE_SUPABASE_URL"].strip('"'), env["VITE_SUPABASE_PUBLISHABLE_KEY"].strip('"')
    h = {"apikey": key, "Authorization": f"Bearer {key}"}
    get = lambda path: json.load(urllib.request.urlopen(urllib.request.Request(f"{url}/rest/v1/{path}", headers=h), timeout=60))
    (NL / "dishloopr_cities.json").write_text(json.dumps({
        "cities": get("cities?select=id,name,slug,is_active,province"),
        "aliases": get("city_aliases?select=alias_name,city_id"),
    }))


if __name__ == "__main__":
    NL.mkdir(parents=True, exist_ok=True)
    overture()
    gemeenten()
    cities()
    print(f"Invoer staat in {NL}")
