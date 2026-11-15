// Checks the PDOK geocoding helper that replaced the Google Geocoding API: query building,
// WKT parsing, and that a best guess in another postcode or city is rejected.
// Usage from the repo root: deno run --config supabase/tests/deno.json supabase/tests/pdok-geocode.ts
import { buildPdokQuery, geocodeWithPdok, houseNumber, parsePoint, pickPdokResult } from "../functions/_shared/pdokGeocode.ts";

const dam = { weergavenaam: "Dam 1, 1012JS Amsterdam", centroide_ll: "POINT(4.8937175 52.37329259)", postcode: "1012JS", woonplaatsnaam: "Amsterdam", gemeentenaam: "Amsterdam", huisnummer: 1 };
let ok = true;
const check = (label: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  ok &&= pass;
  console.log(pass ? "PASS" : "FAIL", label, pass ? "" : `kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`);
};

check("query zonder land, postcode genormaliseerd", buildPdokQuery({ address: "Dam 1, Nederland", postalCode: "1012 js", city: "Amsterdam" }), "Dam 1 1012JS Amsterdam");
check("lege query zonder adres", buildPdokQuery({ address: null }), "");
check("WKT is lng lat", parsePoint("POINT(4.8937175 52.37329259)"), { lat: 52.37329259, lng: 4.8937175 });
check("ongeldige WKT", parsePoint("garbage"), null);
check("zelfde postcode wordt geaccepteerd", pickPdokResult([dam], { address: "Dam 1", postalCode: "1012 JS", city: "Amsterdam" }),
  { ok: true, lat: 52.37329259, lng: 4.8937175, label: "Dam 1, 1012JS Amsterdam" });
check("andere postcode wordt geweigerd", pickPdokResult([dam], { address: "Dam 1", postalCode: "3011AA" }), { ok: false, reason: "postcode_mismatch" });
check("andere plaats wordt geweigerd", pickPdokResult([dam], { address: "Dam 1", city: "Utrecht" }), { ok: false, reason: "city_mismatch" });
check("ander huisnummer wordt geweigerd", pickPdokResult([dam], { address: "Dam 12", city: "Amsterdam" }), { ok: false, reason: "house_number_mismatch" });
check("gemeentenaam telt als plaats", pickPdokResult([{ ...dam, woonplaatsnaam: "Duivendrecht" }], { address: "Dam 1", city: "Amsterdam" }).ok, true);
check("huisnummer met toevoeging", [houseNumber("Oudegracht 40C"), houseNumber("Dam 1-3, Amsterdam"), houseNumber("Kerkstraat 12 bis"), houseNumber("Plein")], [40, 1, null, null]);
check("geen resultaat", pickPdokResult([], { address: "Dam 1" }), { ok: false, reason: "not_found" });

let called = "";
const fakeFetch = ((url: string) => {
  called = url;
  return Promise.resolve(new Response(JSON.stringify({ response: { docs: [dam] } })));
}) as unknown as typeof fetch;
const result = await geocodeWithPdok({ address: "Dam 1", city: "Amsterdam" }, fakeFetch);
check("geocode via fetch", result.ok, true);
check("zoekt alleen adressen in de plaats", new URL(called).searchParams.getAll("fq"), ["type:adres", 'woonplaatsnaam:"Amsterdam" OR gemeentenaam:"Amsterdam"']);
check("zoekterm", new URL(called).searchParams.get("q"), "Dam 1 Amsterdam");

Deno.exit(ok ? 0 : 1);
