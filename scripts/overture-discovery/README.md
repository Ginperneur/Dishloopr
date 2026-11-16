# Overture discovery (pilot)

Finds candidate restaurants for a city without Google data, and sorts them into
`approve` / `review` / `reject` / `duplicate` with the same rules as the
restaurant-approval skill (dish-first sit-down eateries only; no snackbars,
döner, cafetaria, lunchrooms, fastfood chains, shops or plain bars).

Read-only: the script never writes to Supabase. It produces `output/<city>.csv`.

## Run

```bash
uv venv -p python3.12 .venv && uv pip install -p .venv/bin/python duckdb
.venv/bin/python discover.py zwolle
```

Add a city by adding an entry to `cities.json` (bounding box, postcode prefixes,
locality names). The script reads only the Overture rows inside the bounding box
from the public S3 bucket, so a city takes seconds.

## Data sources and licences

| Source | Used for | Licence | What we must do |
|---|---|---|---|
| Overture Maps Places (release in `OVERTURE_RELEASE`, default `2026-10-21.0`) | The candidate list: name, address, category, website, phone, coordinates | CDLA Permissive 2.0 (most rows), CC0, Apache 2.0, per row in the `licenses` column | Attribution, e.g. "Bevat gegevens van Overture Maps Foundation" on the site's sources or about page |
| OpenStreetMap (live Overpass query) | Only as an extra signal: an Overture venue that OSM tags `amenity=fast_food` goes to `review` | ODbL | Nothing is stored in Dishloopr; the 7-day cache in `output/` is a local working file |
| Dishloopr public API | Deduplication against restaurants already on the platform | n/a | n/a |

No Google Maps Platform data is used anywhere in this pipeline (EEA terms forbid
storing names and addresses from Google).

## Rules (see `discover.py`)

1. `reject`: closed per Overture, fastfood chain, name blocklist (snack, cafetaria,
   döner, kebab, shoarma, friet, lunchroom, broodje, bakkerij, ijssalon, koffie…),
   drinks- or shop-first category without a food-first name, confidence < 0.5.
2. `duplicate`: same-ish name within 120 m of a restaurant already on Dishloopr.
3. `review`: OSM says fast_food, borderline category (burger, chicken, halal,
   diner, tapas bar, buffet, wok…), takeaway wording (afhaal, to go, voor thuis,
   bezorg, grillroom, rotishop…), self-service chains (La Place), eetcafé-like name
   on a bar/café category, confidence 0.5 to 0.75, or no website and no phone.
4. `approve`: everything else in a restaurant category.

Overture has no "dine-in" flag, so dine-in is inferred from category and name.
That is why takeaway-sounding names go to review rather than approve.

### Measured quality (Zwolle pilot, 15-11-2026, 60-row sample checked by hand)

| Machine label | Truly fits | Unclear | Does not fit |
|---|---|---|---|
| approve (30) | 18 | 5 | 7 |
| review (15) | 2 | 6 | 7 |
| reject (15) | 0 | 0 | 15 |

`reject` is safe to trust. `approve` is a strong candidate, not a decision:
the misses were closed venues still marked open, a hostel bar, a delivery-only
webshop and a beach club. Confidence, operating status and website presence did
not separate right from wrong, so `approve` rows still need a quick human check
(or a website liveness + menu check) before going live.

## Getting results into Dishloopr

1. Run `discover.py <city>` and open Admin → Discovery → Review Queue.
2. In "Stad importeren uit Overture Maps", choose the CSV and the city (or
   "+ Nieuwe stad"; a new city starts inactive and switches on with its first live
   restaurant that has dishes). Only `approve` and `review` rows are uploaded, as
   `discovery_results` with `source = 'overture'`; re-uploading the same file adds
   nothing twice (unique on `source, external_id`). Afterwards the existing
   duplicate rescan marks candidates that are already on Dishloopr.
3. Filter the queue on "Overture: sterke kandidaten", check each one briefly and
   approve. `approve-discovery-restaurant` then creates the restaurant from the
   Overture row (BAG address and coordinates via PDOK, Overture coordinates as
   fallback, `restaurants.overture_id` set) and runs classify, menu scrape,
   reservation detection and activation. Google rows still return 410.

Schema: migration `0052_overture_discovery` (mirrored in `supabase/migrations`).
Tests: `deno run --config supabase/tests/deno.json supabase/tests/overture-import.ts`.

Attribution: shown on the About page (`about.dataSources`).
