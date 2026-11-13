// Checks the dish-name filter used when owners search dishes to add.
// Usage from the repo root: deno run supabase/tests/dish-names.ts
import { isRealDishName as r } from "../../src/lib/dishNames.ts";
const good = ["Carbonara", "Pad thai", "Pizza Margherita", "Crème brûlée", "Chef's special", "Fish & chips", "Bò bún", "Ceviche (Peru)", "Rendang", "Spaghetti alla carbonara con guanciale"];
const bad = [";s", "9cqwe+", "c` r. ]l", "cl3  k qn mĝ", "oe _8ki", "_ .b y", "_m0 d8� qi gψkŷ5ɨ", "a", "",
  "- het beoordelen van uw bestelling;", "- jack", "honden zijn in chang thai niet toegestaan.",
  "het is op drukke momenten niet altijd mogelijk de diverse hoofd", "kinderkaart- t/m 12 jaar",
  "in microkredieten aan koffieboeren in afrika. dit geld 33 cl", "het verwerken van de betaling (en eventuele terugbetaling);"];
let ok = true;
for (const g of good) { const p = r(g); ok &&= p; console.log(p ? "PASS" : "FAIL", "echt", JSON.stringify(g)); }
for (const b of bad) { const p = !r(b); ok &&= p; console.log(p ? "PASS" : "FAIL", "rommel", JSON.stringify(b)); }
Deno.exit(ok ? 0 : 1);
