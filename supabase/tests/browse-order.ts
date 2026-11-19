// Checks the order of restaurants when browsing a city: city first, then nearby places by distance,
// quality score within a group, and at most 3 of one cuisine in the top 12.
// Usage from the repo root: deno run supabase/tests/browse-order.ts
import { browseScore, diversifyTop, inCity, orderForBrowse, dailyJitter, type ListingSignals } from "../../src/lib/browseOrder.ts";

let ok = true;
const check = (label: string, pass: boolean, got?: unknown) => { ok &&= pass; console.log(pass ? "PASS" : "FAIL", label, pass ? "" : JSON.stringify(got)); };
const base = { images: null, cuisine_primary: null, geo_lat: 51.56, geo_lng: 5.09, claimed_by_owner_id: null, bayesianRating: 3.5, hasHours: false };
const R = (id: string, extra: Record<string, unknown> = {}) => ({ id, address: `Straat 1, 5038CS Tilburg`, ...base, ...extra });
const sig = (food: number, priced = food, owner = 0): ListingSignals => ({ foodDishes: food, pricedDishes: priced, ownerDishes: owner });

check("adres met stadsnaam is in de stad", inCity("Heuvel 12, 5038 CS Tilburg", "Tilburg"));
check("adres met ander dorp is erbuiten", !inCity("Hild 1, 5066CL Moergestel", "Tilburg"));
check("adres zonder plaatsnaam telt als stad", inCity("Reguliersdwarsstraat 45", "Amsterdam"));
check("accenten en 's- doen niet mee", inCity("Markt 1, 5211JV 's-Hertogenbosch", "'s-Hertogenbosch") && inCity("MARIËNBURGSTRAAT 2, 6811CS Arnhem", "Arnhem"));

const full = browseScore({ ...R("a"), images: ["x.jpg"], bayesianRating: 5, hasHours: true, claimed_by_owner_id: "o" }, sig(30));
check("volledig restaurant scoort 1", Math.abs(full - 1) < 1e-9, full);
check("lege kaart en geen foto scoort laag", browseScore(R("b"), undefined) < 0.2, browseScore(R("b"), undefined));
check("volle kaart weegt zwaarder dan halve", browseScore(R("c"), sig(30)) > browseScore(R("c"), sig(10)));
check("foto telt even zwaar als een volle kaart", Math.abs(browseScore({ ...R("d"), images: ["x"] }, undefined) - browseScore(R("d"), sig(30))) < 1e-9);

const rows = [
  R("dorp-ver", { address: "Kerkstraat 1, 5100AA Dongen", geo_lat: 51.63, geo_lng: 4.94 }),
  R("dorp-dicht", { address: "Hild 1, 5066CL Moergestel", geo_lat: 51.55, geo_lng: 5.18, images: ["x"] }),
  R("stad-mager"),
  R("stad-goed", { images: ["x"], hasHours: true }),
];
const order = orderForBrowse(rows, new Map([["stad-goed", sig(30)], ["stad-mager", sig(5)]]), { cityName: "Tilburg", day: "2026-11-19" }).map(r => r.id);
check("stad eerst, beste bovenaan, dan dorpen op afstand", order.join() === "stad-goed,stad-mager,dorp-dicht,dorp-ver", order);

const sushi = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, cuisine_primary: "Sushi" }));
const other = Array.from({ length: 10 }, (_, i) => ({ id: `o${i}`, cuisine_primary: `K${i}` }));
const div = diversifyTop([...sushi, ...other]).slice(0, 12);
check("maximaal 3 sushi in de top 12", div.filter(r => r.cuisine_primary === "Sushi").length === 3, div.map(r => r.id));

check("dagelijkse schuif is stabiel per dag", dailyJitter("x", "2026-11-19") === dailyJitter("x", "2026-11-19"));
check("dagelijkse schuif verschilt per dag", dailyJitter("x", "2026-11-19") !== dailyJitter("x", "2026-11-20"));

if (!ok) Deno.exit(1);
