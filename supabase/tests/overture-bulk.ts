// Checks the pure helpers of the Overture bulk route (supabase/functions/overture-bulk).
// Usage from the repo root: deno run --config supabase/tests/deno.json supabase/tests/overture-bulk.ts
import {
  BULK_HIDDEN_REASON, chunks, cleanDishRows, courseType, linkRecord, newDishRecord, parsePrice,
} from "../functions/_shared/overtureBulk.ts";

let ok = true;
const check = (label: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  ok &&= pass;
  console.log(pass ? "PASS" : "FAIL", label, pass ? "" : `kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`);
};

// hidden_for_menu() matches reden ~* '(menu|gerecht|kaart|dish)'; without a match the trigger never unhides.
check("verbergreden valt onder hidden_for_menu", /(menu|gerecht|kaart|dish)/i.test(BULK_HIDDEN_REASON), true);

check("prijs met komma", parsePrice("12,50"), 12.5);
check("prijs met euroteken", parsePrice("€ 9.5"), 9.5);
check("prijsrange telt niet", parsePrice("10-12"), null);
check("lege prijs", parsePrice(""), null);
check("absurde prijs", parsePrice("12500"), null);

const rows = cleanDishRows([
  { overture_id: "o1", dish_slug: "pizza-margherita", dish_name: "Pizza Margherita", tier: "canonical", canonical_slug: "pizza-margherita", course: "hoofdgerecht", price: "12,50" },
  { overture_id: "o1", dish_slug: "pizza-margherita", dish_name: "Pizza Margherita (2)" },
  { overture_id: "o1", dish_slug: "", dish_name: "Leeg" },
  { overture_id: "", dish_slug: "x", dish_name: "Zonder restaurant" },
  { overture_id: "o2", dish_slug: "huiswijn", dish_name: "Huiswijn", tier: "menu_only", canonical_slug: "wijn", course: "drank" },
]);
check("dubbel en leeg eruit, eerste wint", rows.map((r) => `${r.overture_id}:${r.dish_name}`), ["o1:Pizza Margherita", "o2:Huiswijn"]);

check("canoniek gerecht houdt canonical_slug", newDishRecord(rows[0]).canonical_slug, "pizza-margherita");
check("menu_only krijgt geen canonical_slug", newDishRecord(rows[1]).canonical_slug, null);

const link = linkRecord(rows[0], "r1", "d1", "2026-11-17T00:00:00Z");
check("koppeling meteen goedgekeurd met prijs", [link.status, link.price, link.tier], ["approved_by_admin", 12.5, "canonical"]);
check("drank telt niet mee voor de 5", linkRecord(rows[1], "r2", "d2", "x").course_type, "drank");
check("nagerecht wordt dessert", courseType("nagerecht"), "dessert");
check("onbekende gang wordt hoofdgerecht", courseType("borrel"), "hoofdgerecht");

check("chunks", chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);

if (!ok) Deno.exit(1);
