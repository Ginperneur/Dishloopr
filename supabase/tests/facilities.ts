// Checks which facilities are shown on a restaurant page.
// Usage from the repo root: deno run supabase/tests/facilities.ts
import { restaurantFacilities } from "../../src/lib/facilities.ts";
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
check("nothing set: nothing shown", restaurantFacilities({}).length === 0);
check("halal, terrace, takeaway shown in order", restaurantFacilities({ is_fully_halal: true, has_terrace: true, has_takeaway: true }).join() === "halal,terrace,takeaway");
check("vegan replaces vegetarian", restaurantFacilities({ is_fully_vegan: true, is_fully_vegetarian: true }).join() === "vegan");
check("vegetarian alone", restaurantFacilities({ is_fully_vegetarian: true }).join() === "vegetarian");
check("false and null not shown", restaurantFacilities({ has_delivery: false, has_terrace: null }).length === 0);
Deno.exit(ok ? 0 : 1);
