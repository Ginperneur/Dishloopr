"""Builds the dish import for the Overture bulk route from the Python menu scrape.

Input: one or more scraped_dishes_v5.csv files from menu_scraper_v5.py (run with the Overture id
as restaurant id) and the screening_decisions_v5.csv from dish_screen_local_v5.py over the same
rows. Both scripts live in the Dishloopr data folder, not in this repo.

Output: a CSV for Admin → Wachtrijen → Discovery → "Overture in bulk", step 2
(columns overture_id, dish_slug, dish_name, canonical_slug, course, tier, price, ...).

Rules, as in the earlier imports (kaartmotor/import/osm_build_dish_import.py) plus the
kaartmotor gate:
  - only screening decision "approve";
  - canonical items always; a menu-only item only with evidence (a price or a menu section),
    which drops site text such as "Parkeren" or "Direct online boeken";
  - extra junk filter for site chrome; a "dish" that is the restaurant name is dropped;
  - drinks capped at 20 per restaurant; first (restaurant, dish) wins.

    python build_dish_import.py --screening screening_decisions_v5.csv --out import.csv s*/scraped_dishes_v5.csv
"""
from __future__ import annotations

import argparse
import csv
import re
from collections import Counter

DRINK_CAP = 20
FIELDS = ["overture_id", "restaurant_name", "city", "dish_slug", "dish_name", "canonical_slug",
          "course", "tier", "price", "description", "menu_section", "sort_order"]

EXTRA_JUNK = re.compile(
    r"veelgestelde vragen|schrijf een review|^faq$|^navigatie$|^loading\.*$|^inloggen$|^over ons\b|"
    r"^bel ons$|toevoegen aan winkelwagen|wachtwoord:|^instagram$|^linkedin$|^facebook$|^twitter$|"
    r"^whatsapp$|we zoeken collega|sitedish|powered by|totaaloplossing|\bformitable\b|\bdeliverect\b|"
    r"\bresengo\b|mogelijk gemaakt door|website door \w|^webdesign\b|alle rechten voorbehouden|"
    r"^copyright\b|uitverkocht|sold out|op voorraad|selecteer opties|kies opties|select options|"
    r"\d+k?\s*views?\b|\d+\s*likes?\b|"
    # seen in the Almere test (17-11-2026)
    r"^parkeren\b|bereikbaar|online (boeken|bestellen|reserveren)|^order online$|^direct (online )?boeken|"
    r"^adres\b|\{\{|^nieuwe locatie$|elke dag van \d|^(lunch|diner)kaart\b.*\d{1,2}[:.]\d{2}|"
    r"^to share$|^voor (de )?maand\b|^(poedersuiker|slagroom) en\b|en/of",
    re.I,
)
FRAGMENT = re.compile(r"^(for|and|en|the|van|met|of|or|a|de|het)$", re.I)
# Site widgets glued to the dish name ("Runder carpaccio Allergenen", "... Allergenen sesamzaad").
TRAILING_CHROME = re.compile(r"\s+(allergenen|allergens|meer info|bestel|toevoegen)\b.*$", re.I)


def slugify(text: str) -> str:
    import unicodedata
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("scraped", nargs="+")
    ap.add_argument("--screening", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    decisions = {r["dish_slug"]: r for r in csv.DictReader(open(a.screening, newline="", encoding="utf-8"))}
    seen: set[tuple[str, str]] = set()
    drinks: Counter = Counter()
    order: Counter = Counter()
    skipped: Counter = Counter()
    out = []
    for path in a.scraped:
        for r in csv.DictReader(open(path, newline="", encoding="utf-8")):
            rid, slug = r["restaurant_id"], r["dish_slug"]
            d = decisions.get(slug)
            if not d or d["decision"] != "approve":
                skipped["screening"] += 1
                continue
            name = (r["dish_name"] or "").strip()
            cleaned = TRAILING_CHROME.sub("", name).strip()
            cleaned = re.sub(r"^\d{2,4}[.)]?\s+", "", cleaned)          # menu numbers: "0083 Ossenhaas"
            if cleaned.count("(") > cleaned.count(")"):                   # cut-off note: "Koe Loe Kai (kipballetjes"
                cleaned = cleaned[:cleaned.rfind("(")].strip()
            if cleaned != name and len(cleaned) >= 3:
                name, slug = cleaned, slugify(cleaned)
            if EXTRA_JUNK.search(name) or FRAGMENT.match(name) or name.lower() == r["restaurant_name"].strip().lower():
                skipped["rommel"] += 1
                continue
            canonical = d.get("canonical_slug") or ""
            tier = "canonical" if canonical else "menu_only"
            price, section = (r.get("price") or "").strip(), (r.get("section") or "").strip()
            if tier == "menu_only" and not price and not section:
                skipped["zonder bewijs"] += 1
                continue
            if (rid, slug) in seen:
                skipped["dubbel"] += 1
                continue
            course = d.get("course") or ""
            if course == "drank":
                if drinks[rid] >= DRINK_CAP:
                    skipped["drankplafond"] += 1
                    continue
                drinks[rid] += 1
            seen.add((rid, slug))
            order[rid] += 1
            out.append({
                "overture_id": rid, "restaurant_name": r["restaurant_name"], "city": r["city"],
                "dish_slug": slug, "dish_name": name if slug != r["dish_slug"] else (d.get("menu_name") or name), "canonical_slug": canonical,
                "course": course, "tier": tier, "price": price, "description": "",
                "menu_section": section, "sort_order": order[rid],
            })

    with open(a.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(out)
    food = Counter(r["overture_id"] for r in out if r["course"] != "drank")
    print(f"{len(out)} rijen voor {len(order)} restaurants -> {a.out}")
    print(f"restaurants met 5+ gerechten (zonder drank): {sum(1 for n in food.values() if n >= 5)}")
    print(f"overgeslagen: {dict(skipped)}")


if __name__ == "__main__":
    main()
