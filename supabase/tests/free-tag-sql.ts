import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks set_free_restaurant_tag: owners set or change their free tag, paid extras stay,
// strangers and unknown tags are refused.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/free-tag-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`ALTER TABLE restaurants ADD COLUMN cuisines text[], ADD COLUMN ambience_tags text[],
  ADD COLUMN concepts text[], ADD COLUMN experiences text[], ADD COLUMN updated_at timestamptz;`);
await db.exec(await Deno.readTextFile(`${repo}/supabase/migrations/20261113120000_owner_free_tag.sql`));

const OWNER = "00000000-0000-0000-0000-0000000000a1", STRANGER = "00000000-0000-0000-0000-0000000000a3";
const R = "00000000-0000-0000-0000-000000000101";
await db.exec(`
  INSERT INTO auth.users VALUES ('${OWNER}'), ('${STRANGER}');
  INSERT INTO restaurants (id, name, slug, claimed_by_owner_id, cuisines, ambience_tags) VALUES
    ('${R}', 'Testkeuken', 'testkeuken', '${OWNER}', '{}', ARRAY['Gezellig','Romantisch','Modern']);
`);
const as = (uid: string) => db.exec(`DELETE FROM test_ctx; INSERT INTO test_ctx VALUES ('${uid}', 'authenticated');`);
const call = async (cat: string, val: string) =>
  (await db.query<{ t: string[] }>("SELECT set_free_restaurant_tag($1, $2, $3) AS t", [R, cat, val])).rows[0].t;
const fails = async (cat: string, val: string) => { try { await call(cat, val); return false; } catch { return true; } };

let ok = true;
const check = (label: string, pass: boolean, got?: unknown) => { ok &&= pass; console.log(pass ? "PASS" : "FAIL", label, pass ? "" : JSON.stringify(got)); };

await as(OWNER);
let t = await call("cuisine", "Italiaans");
check("owner sets the free tag in an empty category", JSON.stringify(t) === '["Italiaans"]', t);
t = await call("cuisine", "Japans");
check("owner changes the free tag", JSON.stringify(t) === '["Japans"]', t);
t = await call("ambience", "Klassiek");
check("paid extras stay when the free tag changes", JSON.stringify(t) === '["Klassiek","Romantisch","Modern"]', t);
t = await call("ambience", "Modern");
check("no duplicates when the free tag was an extra", JSON.stringify(t) === '["Modern","Romantisch"]', t);
t = await call("concept", "Chef's table");
check("tags with an apostrophe work", JSON.stringify(t) === `["Chef's table"]`, t);
check("unknown tag refused", await fails("cuisine", "Alles"));
check("unknown category refused", await fails("prijs", "Italiaans"));
const row = (await db.query<{ cuisines: string[]; concepts: string[] }>(`SELECT cuisines, concepts FROM restaurants WHERE id = '${R}'`)).rows[0];
check("stored on the restaurant", row.cuisines[0] === "Japans" && row.concepts[0] === "Chef's table", row);

await as(STRANGER);
check("someone else cannot set tags", await fails("cuisine", "Thais"));
Deno.exit(ok ? 0 : 1);
