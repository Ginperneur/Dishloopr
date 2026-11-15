// Checks city ordering (7 largest first, then A-Z) and typing to filter.
// Usage from the repo root: deno run supabase/tests/city-order.ts
import { sortCities, filterCities } from "../../src/lib/cityOrder.ts";
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const c = (name: string, slug: string) => ({ name, slug });
const list = [c("Breda", "breda"), c("Tilburg", "tilburg"), c("Almere", "almere"), c("Den Haag", "den-haag"), c("Amsterdam", "amsterdam"),
  c("Groningen", "groningen"), c("Utrecht", "utrecht"), c("Eindhoven", "eindhoven"), c("Rotterdam", "rotterdam"), c("Zwolle", "zwolle"),
  c("'s-Hertogenbosch", "den-bosch"), c("Ede", "ede"), c("Amstelveen", "amstelveen")];
const sorted = sortCities(list).map(x => x.name);
check("7 largest first, by size", sorted.slice(0, 7).join() === "Amsterdam,Rotterdam,Den Haag,Utrecht,Eindhoven,Groningen,Tilburg", sorted);
check("then alphabetical", sorted.slice(7).join() === "'s-Hertogenbosch,Almere,Amstelveen,Breda,Ede,Zwolle", sorted.slice(7));
const s = sortCities(list);
check("typing 'am': starts-with first (big city first), then names that contain it", filterCities(s, "am").map(x => x.name).join() === "Amsterdam,Amstelveen,Rotterdam", filterCities(s, "am").map(x => x.name));
check("typing 'haag' finds Den Haag", filterCities(s, "haag")[0]?.name === "Den Haag");
check("typing 'hertogenbosch' finds 's-Hertogenbosch", filterCities(s, "hertogenbosch")[0]?.name === "'s-Hertogenbosch");
check("typing 'ede' puts Ede before cities that only contain it", filterCities(s, "ede")[0]?.name === "Ede", filterCities(s, "ede").map(x => x.name));
check("accents and case ignored", filterCities([c("Den Haag", "den-haag")], "DÉN").length === 1);
check("empty query keeps full order", filterCities(s, "  ").length === list.length);
Deno.exit(ok ? 0 : 1);
