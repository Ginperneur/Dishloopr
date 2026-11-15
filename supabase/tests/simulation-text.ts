// Checks the owner-facing text of simulation results.
// Usage from the repo root: deno run supabase/tests/simulation-text.ts
import { simulationSummary, confidenceLabel } from "../../src/lib/simulation.ts";
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const q = { unlimited: false, free_left: 2, credits: 0, price_cents: 199 };
const a = simulationSummary({ kind: "add_dish", dish: "Ramen", position: 3, total: 4, searches_per_month: 100, extra_visitors_per_month: 10, data_points: 300, quota: q });
check("add_dish headline", a.headline === "Met ramen sta je op plek 3 van 4", a);
check("add_dish lines mention searches and visitors", a.lines[0].includes("100 keer per maand") && a.lines[1].includes("10 extra bezoekers"), a.lines);
const p = simulationSummary({ kind: "change_price", from: 2, to: 3, price_filter_searches_per_month: 30, gain_per_month: 10, lose_per_month: 20, data_points: 90, quota: q }, 2);
check("change_price net loss", p.headline === "Je komt in zo'n 10 minder zoekopdrachten per maand voor", p);
check("change_price detail", p.lines[1].includes("€€ naar €€€") && p.lines[1].includes("wint er 10") && p.lines[1].includes("verliest er 20"), p.lines);
const t = simulationSummary({ kind: "remove_tag", tag: "Romantisch", filter_searches_per_month: 15, data_points: 45, quota: q });
check("remove_tag headline", t.headline.includes("15 zoekopdrachten per maand niet meer"), t);
check("confidence levels", confidenceLabel(400).startsWith("Betrouwbaar") && confidenceLabel(60).startsWith("Redelijk") && confidenceLabel(5).startsWith("Indicatie"));
check("no dashes in owner text", ![a, p, t].some(x => /[–—]/.test(x.headline + x.lines.join(" ") + x.confidence)));
Deno.exit(ok ? 0 : 1);
