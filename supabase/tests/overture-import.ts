// Checks the Overture discovery import: CSV parsing and required columns, triage and validation of
// the rows written by discover.py, city and restaurant slugs, website normalising, and the
// restaurants row built from an Overture candidate (with and without a PDOK geocode).
// Usage from the repo root: deno run --config supabase/tests/deno.json supabase/tests/overture-import.ts
import { citySlug, missingColumns, parseCsv, parseCsvTable, toDiscoveryRows } from "../../src/lib/overtureImport.ts";
import { normalizeWebsite, restaurantFromOverture, restaurantSlug } from "../functions/_shared/overtureRestaurant.ts";

let ok = true;
const check = (label: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  ok &&= pass;
  console.log(pass ? "PASS" : "FAIL", label, pass ? "" : `kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`);
};

// parseCsv
check("CSV: komma binnen aanhalingstekens", parseCsv('name,street\n"Café, Bar",Dam 1\n'), [{ name: "Café, Bar", street: "Dam 1" }]);
check("CSV: dubbele aanhalingsteken binnen quotes", parseCsv('name\n"Zus ""De Kroeg"""\n'), [{ name: 'Zus "De Kroeg"' }]);
check("CSV: newline binnen quotes", parseCsv('name,street\n"Regel 1\nRegel 2",Dam 1\n'), [{ name: "Regel 1\nRegel 2", street: "Dam 1" }]);
check("CSV: CRLF regeleinden", parseCsv("name,lat\r\nA,1\r\nB,2\r\n"), [{ name: "A", lat: "1" }, { name: "B", lat: "2" }]);
check("CSV: BOM aan het begin verwijderd", Object.keys(parseCsv("﻿name,lat\nA,1")[0]), ["name", "lat"]);
check("CSV: lege regels aan het eind genegeerd", parseCsv("name\nA\n\n\n"), [{ name: "A" }]);

// missingColumns
check("ontbrekende kolom overture_id", missingColumns(parseCsvTable("status,name,lat,lng\napprove,A,52,4").header), ["overture_id"]);
check("leeg bestand: alle verplichte kolommen", missingColumns(parseCsvTable("").header), ["status", "name", "lat", "lng", "overture_id"]);
check("alleen header met alle kolommen: niets ontbreekt", missingColumns(parseCsvTable("status,name,lat,lng,overture_id").header), []);

// toDiscoveryRows
const row = (over: Record<string, string>): Record<string, string> => ({
  status: "approve", overture_id: "ov-1", name: "Dam Eten", street: "Damrak 1", postcode: "8011 AB",
  lat: "52.37", lng: "4.89", website: "dameten.nl", phone: "038 123", category: "restaurant",
  confidence: "0.92", reason: "naam en adres ok", licenses: "CDLA-Permissive-2.0|CC0-1.0", ...over,
});
const csv = [
  row({}),
  row({ status: "review", overture_id: "ov-2", name: "Lijst Eten", confidence: "", licenses: "CC0-1.0" }),
  row({ status: "reject", overture_id: "ov-3", name: "Afgewezen" }),
  row({ status: "duplicate", overture_id: "ov-4", name: "Dubbel Eten" }),
  row({ overture_id: "", name: "Zonder ID" }),
  row({ overture_id: "ov-5", name: "Ver weg", lat: "48" }),
  row({ overture_id: "ov-1", name: "Herhaald" }),
];
const s = toDiscoveryRows(csv, "c1");
const first = s.rows[0];
check("approve en review worden bewaard", s.rows.length, 2);
check("triage per rij", s.rows.map((r) => r.triage), ["approve", "review"]);
check("reject en duplicate alleen geteld, invalid geteld", s.skipped, { reject: 1, duplicate: 1, invalid: 3 });
check("invalid-redenen per rij", s.invalid, [
  "Zonder ID: geen overture_id",
  "Ver weg: coördinaten buiten Nederland",
  "Herhaald: dubbel in bestand",
]);
check("postcode 8011 AB wordt 8011AB", first.postcode, "8011AB");
check("licenses gesplitst op |", first.licenses, ["CDLA-Permissive-2.0", "CC0-1.0"]);
check("confidence wordt getal", first.confidence, 0.92);
check("lege confidence wordt null", s.rows[1].confidence, null);
check("place_id null en source overture", [first.place_id, first.source], [null, "overture"]);
check("external_id is overture_id", first.external_id, "ov-1");
check("city_id, venue_category en status", [first.city_id, first.venue_category, first.status], ["c1", "restaurant", "pending"]);

// citySlug
check("citySlug Den Haag", citySlug("Den Haag"), "den-haag");
check("citySlug 's-Hertogenbosch", citySlug("'s-Hertogenbosch"), "s-hertogenbosch");
check("citySlug Bergen op Zoom", citySlug("Bergen op Zoom"), "bergen-op-zoom");

// restaurantSlug
check("restaurantSlug: diakrieten weg", restaurantSlug("Café Ömer", "OVT-9f8e7d"), "cafe-omer-9f8e7d");
check("restaurantSlug: apostrof weg", restaurantSlug("Ben's Grill", "abc-123456"), "bens-grill-123456");
check("restaurantSlug: lege naam valt terug op restaurant", restaurantSlug("", "abc-123456"), "restaurant-123456");

// normalizeWebsite
check("normalizeWebsite: zonder schema krijgt https", normalizeWebsite("example.nl"), "https://example.nl/");
check("normalizeWebsite: http met pad blijft", normalizeWebsite("http://x.nl/menu"), "http://x.nl/menu");
check("normalizeWebsite: leeg wordt null", normalizeWebsite(""), null);
check("normalizeWebsite: localhost wordt null", normalizeWebsite("localhost"), null);

// restaurantFromOverture
const cand = {
  external_id: "OVT-9f8e7d", name: "Café Ömer", address: "Damrak 1", postcode: "1012AB",
  lat: 52.1, lng: 4.1, website: "example.nl", phone: "020 1234", city_id: "c1",
};
const hit = { ok: true, lat: 52.3733, lng: 4.8937, label: "Damrak 1, 1012AB Amsterdam" };
const miss = { ok: false, reason: "not_found" };

const fromPdok = restaurantFromOverture(cand, "Amsterdam", hit);
check("PDOK: adres uit label", fromPdok.address, "Damrak 1, 1012AB Amsterdam");
check("PDOK: coördinaten uit geocode", [fromPdok.geo_lat, fromPdok.geo_lng], [52.3733, 4.8937]);

const fallback = restaurantFromOverture(cand, "Amsterdam", miss);
check("geen PDOK: adres samengesteld", fallback.address, "Damrak 1, 1012AB Amsterdam");
check("geen PDOK: kandidaat-coördinaten", [fallback.geo_lat, fallback.geo_lng], [52.1, 4.1]);
check("geen PDOK: lege adresgegevens worden Onbekend", restaurantFromOverture({ ...cand, address: null, postcode: null }, null, miss).address, "Onbekend");
check("slug, website en contactgegevens", [fallback.slug, fallback.website_url, fallback.phone], ["cafe-omer-9f8e7d", "https://example.nl/", "020 1234"]);
check("postal_code en city_id", [fallback.postal_code, fallback.city_id], ["1012AB", "c1"]);
check("niet actief, bron discovery, overture_id gezet", [fallback.is_active, fallback.added_by_source, fallback.overture_id], [false, "discovery", "OVT-9f8e7d"]);

let threw = false;
try {
  restaurantFromOverture({ ...cand, city_id: null }, "Amsterdam", miss);
} catch {
  threw = true;
}
check("zonder city_id wordt een fout gegooid", threw, true);

Deno.exit(ok ? 0 : 1);
