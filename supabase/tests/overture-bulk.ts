// Checks the pure helpers of the Overture bulk route (supabase/functions/overture-bulk).
// Usage from the repo root: deno run --config supabase/tests/deno.json supabase/tests/overture-bulk.ts
import {
  BULK_HIDDEN_REASON, bulkErrorMessage, pendingOvertureBatch, postgresSafeJson, chunks, cleanDishRows, courseType, linkRecord, newDishRecord, parsePrice,
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

const operations: unknown[] = [];
const query = {
  select(columns: string) { operations.push(['select', columns]); return this; },
  eq(column: string, value: string) { operations.push(['eq', column, value]); return this; },
  order(column: string) {
    if (!['discovered_at', 'id'].includes(column)) throw new Error(`Unknown discovery column: ${column}`);
    operations.push(['order', column]); return this;
  },
  limit(value: number) { operations.push(['limit', value]); return { data: [{ id: 'candidate-1' }], error: null }; },
};
const batch = await pendingOvertureBatch({ from(table: string) { operations.push(['from', table]); return query; } }, 'verified', 1);
check('pending batch reads discovery table', operations[0], ['from', 'discovery_results']);
check('pending batch orders by existing discovery timestamp and id', operations.filter((op) => Array.isArray(op) && op[0] === 'order'), [['order', 'discovered_at'], ['order', 'id']]);
check('pending batch retains Overture, pending and triage filters', operations.filter((op) => Array.isArray(op) && op[0] === 'eq'), [['eq', 'source', 'overture'], ['eq', 'status', 'pending'], ['eq', 'triage', 'verified']]);
check('pending batch returns candidates', batch.data, [{ id: 'candidate-1' }]);
check('database error exposes its message rather than object Object', bulkErrorMessage({ code: '42703', message: 'column discovery_results.created_at does not exist' }), 'column discovery_results.created_at does not exist');
check('standard error keeps its message', bulkErrorMessage(new Error('Request failed')), 'Request failed');
check('string error stays readable', bulkErrorMessage('Request failed'), 'Request failed');

check('PostgreSQL-safe JSON strips nested NUL characters without losing valid Unicode',
  postgresSafeJson({ name: 'Café\u0000 🍣', nested: [{ description: 'a\u0000b', price: 12.5, missing: null }], enabled: true }),
  { name: 'Café 🍣', nested: [{ description: 'ab', price: 12.5, missing: null }], enabled: true });
check('printable Unicode escape stays literal', postgresSafeJson('literal \\u0000'), 'literal \\u0000');
const nulRows = cleanDishRows([
  { overture_id: 'o\u00001', dish_slug: 'pi\u0000zza', dish_name: 'Pi\u0000zza', description: 'Fresh\u0000 basil', menu_section: 'Main\u0000 menu', tier: 'can\u0000onical', canonical_slug: 'pi\u0000zza' },
  { overture_id: 'o1', dish_slug: 'pizza', dish_name: 'Duplicate' },
  { overture_id: 'o1', dish_slug: '\u0000', dish_name: 'Invalid' },
]);
check('NUL stripping precedes validation and deduplication', nulRows.length, 1);
check('dish database record contains no NUL', newDishRecord(nulRows[0]),
  { slug: 'pizza', name: 'Pizza', canonical_slug: 'pizza', course: null, is_active: true });
const nulLink = linkRecord(nulRows[0], 'r1', 'd1', 'now');
check('link database text is cleaned too', [nulLink.description, nulLink.menu_section, nulLink.tier], ['Fresh basil', 'Main menu', 'canonical']);

if (!ok) Deno.exit(1);
