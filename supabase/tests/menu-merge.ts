// Checks how owner Menu Items (prices, descriptions) are merged into the public menu.
// Usage from the repo root: deno run supabase/tests/menu-merge.ts
import { mergeMenuRows, courseFromCategory, formatPrice, type MenuRow, type MergeableItem } from "../../src/lib/menuMerge.ts";
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const dish = (id: string, name: string): MergeableItem => ({ id, name, description: null, price: 0, course_type: "hoofdgerecht", is_vegetarian: false, is_vegan: false, is_gluten_free: false });
const row = (id: string, name: string, price: number | null, category = "Hoofdgerechten", extra: Partial<MenuRow> = {}): MenuRow =>
  ({ id, name, description: null, price, category, is_vegetarian: false, is_vegan: false, is_gluten_free: false, ...extra });
const make = (r: MenuRow, course: MergeableItem["course_type"]): MergeableItem => ({ ...dish(`menu-${r.id}`, r.name), price: Number(r.price) || 0, course_type: course });
const out = mergeMenuRows([dish("d1", "Crème brûlée"), dish("d2", "Rendang")],
  [row("m1", "creme brulee", 7.5, "Desserts", { description: "Met vanille", is_vegetarian: true }), row("m2", "Bintang", 4, "Dranken"), row("m3", "Rendang", null)], make);
check("price and description added to the matching dish (accents and case ignored)", out[0].price === 7.5 && out[0].description === "Met vanille" && out[0].is_vegetarian, out[0]);
check("dish keeps its own course when merged", out[0].course_type === "hoofdgerecht");
check("menu item without price leaves the dish without price", out[1].price === 0, out[1]);
check("unmatched menu item shown on its own", out.length === 3 && out[2].name === "Bintang" && out[2].course_type === "drank", out);
check("same row not used twice", mergeMenuRows([dish("a", "Rendang"), dish("b", "rendang")], [row("m", "Rendang", 12)], make).length === 2);
check("categories map to courses", courseFromCategory("Voorgerechten") === "voorgerecht" && courseFromCategory("Desserts") === "nagerecht"
  && courseFromCategory("Wijnen") === "drank" && courseFromCategory("Sides") === "bijgerecht" && courseFromCategory("Pasta") === "hoofdgerecht");
check("price shown in euros", formatPrice(7.5)?.replace(/\s/g, " ") === "€ 7,50", formatPrice(7.5));
check("no price shows nothing", formatPrice(0) === null);
Deno.exit(ok ? 0 : 1);
