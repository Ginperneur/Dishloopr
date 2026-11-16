import { vatCents, inclVatCents, vatBreakdown } from "../../src/lib/vat.ts";
import { withVat } from "../functions/_shared/vat.ts";
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/vat.ts
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const table: [number, number, number][] = [[5900, 1239, 7139], [9900, 2079, 11979], [59000, 12390, 71390], [99000, 20790, 119790], [2900, 609, 3509],
  [29000, 6090, 35090], [7900, 1659, 9559], [1900, 399, 2299], [1500, 315, 1815], [2000, 420, 2420], [500, 105, 605], [199, 42, 241], [597, 125, 722]];
for (const [ex, vat, inc] of table) check(`${ex} -> btw ${vat}, totaal ${inc}`, vatCents(ex) === vat && inclVatCents(ex) === inc, [vatCents(ex), inclVatCents(ex)]);
check("breakdown text", vatBreakdown(5900).replace(/ /g, " ") === "€ 59 + € 12,39 btw = € 71,39" || vatBreakdown(5900).includes("71,39"), vatBreakdown(5900));

let created = 0;
const fake = { taxRates: { list: async () => ({ data: [] }), create: async () => { created++; return { id: "txr_test" }; } } };
const a = await withVat(fake, { mode: "payment", line_items: [{ quantity: 1, price_data: { unit_amount: 500 } }, { price: "price_x", quantity: 2 }] });
check("every line item gets the 21% rate", a.line_items!.every(li => JSON.stringify(li.tax_rates) === '["txr_test"]'), a);
await withVat(fake, { line_items: [{ quantity: 1 }] });
check("rate created once and reused", created === 1, created);
const b = await withVat(fake, { automatic_tax: { enabled: true }, line_items: [{ quantity: 1 }] });
check("Stripe Tax on: nothing added", !("tax_rates" in b.line_items![0]), b);
Deno.exit(ok ? 0 : 1);
