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

## All of the Netherlands

```bash
.venv/bin/python fetch_nl_inputs.py   # Overture NL food places, PDOK municipalities, Dishloopr cities
.venv/bin/python discover_nl.py       # ~30 min with website check; --no-web for a 1-minute dry run
```

Writes one CSV per province in `output/nl/` (upload each in the admin import;
it picks "Stad per rij uit het bestand" automatically) and `output/nl/dekking.csv`
with coverage per municipality (on Dishloopr now vs candidates).

City per row: an existing Dishloopr city or alias wins, but only when that
city's province matches (aliases like "Valkenburg" are ambiguous nationally);
a woonplaats with 8 or more candidates becomes its own city; smaller places use
their municipality name. Names Overture spells differently are mapped
("'s-Gravenhage" / "The Hague" to Den Haag, "'s-Hertogenbosch" to Den Bosch), and
a new name that exists in two provinces gets a suffix, e.g. "Hengelo (Ov.)".
New cities are created inactive and switch on with their first live restaurant.
A woonplaats that starts with its municipality name ("Almere-Stad") counts as
the municipality.

Nationwide run (16-11-2026, Overture 2026-10-21.0, `--retry-unreachable`):
80,496 Dutch food places in 342 municipalities, 35,170 websites checked, sites
that did not answer retried once with URL variants (about 1,100 recovered).

| Result | Count |
|---|---|
| Zeker goed (`verified`) | 6,254 |
| Sterk, extra controle (`approve`) | 3,544 |
| Twijfel (`review`) | 12,513 |
| Already on Dishloopr | 3,323 |
| Skipped (`reject`) | 53,819 |

Skips include 6,735 without an own website, 5,098 whose website failed twice,
644 spam/parked domains and 93 closure notices. "Zeker goed" covers 533 cities.

`verified` = the venue's own site names its postcode or street address, shows a
priced menu (5+ prices) or dine-in signals, has no closure/spam text and does not
call itself a lunchroom, café, coffee or high-tea place. Measured on 180
hand-checked venues: 39 right, 6 borderline (lunch cafés, grand cafés), 1 wrong.

### Cost of approving

Approving runs, per restaurant: Firecrawl `map` (1 credit) + `scrape` (1 credit,
2 if the menu page fails), menu extraction with Gemini 2.5 Flash (~5k tokens in,
~2-4k out) and a small Gemini 3 Flash classification, both through the Lovable AI
gateway; PDOK and reservation detection are free. At Google list prices the AI
part is about $0.01 per restaurant; Lovable bills it in workspace credits at a
rate it does not publish. Firecrawl is ~2.2 credits per restaurant.

| Approve | Firecrawl credits | AI at Google list price |
|---|---|---|
| 6,254 zeker goed | ~13,800 | ~$60 |
| + 3,544 sterk | ~21,600 total | ~$100 total |

On the Firecrawl Standard plan (100k credits/month) both fit in one month.
Haiku check, nationwide (run 17-11-2026, batch finished in 10 minutes): 9,693
requests, 0 errors, 38.8M input and 1.3M output tokens, $2.27 with the Batch API.
Haiku said approve 5,904, review 1,858, reject 1,931 (mostly delivery-only 619,
closed 314, not an eatery 299, lunch/coffee 217, catering/shops 210).

Final nationwide result after the Haiku check: 5,937 zeker goed (525 cities),
1,856 sterk with extra check, 13,377 twijfel, 54,960 skipped, 3,323 already on
Dishloopr. On the hand-checked samples "zeker goed" is now 50 right, 2 borderline,
0 wrong. Of 5 sample venues Haiku rejected, 2 were real restaurants (a sushi chain
called a "keten", a Greek restaurant whose site only shows ordering), so a Haiku
"reject" is not infallible.
### Extra check with Claude Haiku 5.5 (`haiku_check.py`)

Before approving, each strong candidate's own website text (homepage plus up to 3
menu/contact pages, max 12,000 characters) goes to `claude-haiku-5-5` through the
Message Batches API (half price) with the approval rules and a strict JSON schema
(`label` approve/review/reject, `reason`, `is_open`, `dine_in`, `dish_first`).

```bash
.venv/bin/python haiku_check.py prepare nl --include-verified   # offline: site text + cost estimate
uv pip install -p .venv/bin/python anthropic                     # once
# key: ANTHROPIC_API_KEY, an `ant auth login` profile, or ~/.config/dishloopr/anthropic_api_key (chmod 600)
.venv/bin/python haiku_check.py submit nl
.venv/bin/python haiku_check.py status nl                        # most batches finish within an hour
.venv/bin/python haiku_check.py collect nl
.venv/bin/python discover_nl.py                                  # applies the labels, then upload the CSVs
```

How labels are applied: a strong candidate becomes "zeker goed" only when Haiku
says approve, and is skipped when Haiku says reject; a site-verified candidate that
Haiku doubts goes back to "sterk, extra controle". Refusals, batch errors and
unreadable answers become "twijfel", never "goed". Website text is passed as data
inside `<website_tekst>` and the prompt tells the model not to follow instructions in it.

## Data sources and licences

| Source | Used for | Licence | What we must do |
|---|---|---|---|
| Overture Maps Places (release in `OVERTURE_RELEASE`, default `2026-10-21.0`) | The candidate list: name, address, category, website, phone, coordinates | CDLA Permissive 2.0 (most rows), CC0, Apache 2.0, per row in the `licenses` column | Attribution, e.g. "Bevat gegevens van Overture Maps Foundation" on the site's sources or about page |
| OpenStreetMap (live Overpass query) | Only as an extra signal: an Overture venue that OSM tags `amenity=fast_food` goes to `review` | ODbL | Nothing is stored in Dishloopr; the 7-day cache in `output/` is a local working file |
| PDOK / Kadaster Bestuurlijke Gebieden (gemeentegebied) | Assigning places to a municipality and province (nationwide run) | CC BY 4.0 | Boundaries are only used for processing, not published; credit Kadaster if they are ever shown |
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

Overture has no "dine-in" flag, so dine-in is inferred from category and name,
and then checked on the venue's own website.

### Website check (`webcheck.py`, skip with `--no-web`)

For approve/review rows, and for rejected bar/pub/café rows, the script fetches
only the homepage of the venue's own website (cached 7 days in `output/`):

- spam or parked domain, or a closure notice ("definitief gesloten", "na 46 mooie
  jaren sluiten wij ons restaurant") → `reject`;
- no own website, only social media, a delivery platform, unreachable, blocked,
  takeaway-only wording, or the site calls itself a cafetaria, snackbar,
  broodjeszaak, lunchroom, hostel, hotel, club → `review`;
- `approve` stays `approve` only if the site works and shows a menu or dine-in
  signal (reservations, Zenchef/TheFork, terras, diner);
- a rejected bar/café whose site shows reservations and a menu → `review`.

Plain "gesloten" is ignored on purpose: opening hours say "maandag gesloten".

### Measured quality

Hand-checked samples (own websites and other sources, never Google Maps).

| Sample | `approve` fits / unclear / wrong | `reject` that was a real restaurant |
|---|---|---|
| Zwolle, before website check (30 approve) | 18 / 5 / 7 | 0 of 15 |
| Maastricht, before website check (30 approve) | 13 / 7 / 10 | 1 of 15 |
| Fresh blind sample, both cities, with website check (40 approve) | 31 / 6 / 3 | 0 of 10 |

With the website check, `approve` is right about 4 in 5 times and wrong about
1 in 13; the unclear ones are mostly lunch cafés and mixed venues (park pavilion,
thrift shop with restaurant). `reject` is safe to trust. Still give `approve`
rows a quick look before approving.

Coverage: of 52 Dishloopr restaurants inside Maastricht, 46 were matched to an
Overture place; 6 have no Overture counterpart, so Overture misses roughly 1 in 10.

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

Schema: migration `0055_overture_discovery` (mirrored in `supabase/migrations`).
Tests: `deno run --config supabase/tests/deno.json supabase/tests/overture-import.ts`.

Attribution: shown on the About page (`about.dataSources`).
