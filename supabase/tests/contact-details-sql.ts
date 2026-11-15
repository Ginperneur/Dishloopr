import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks set_restaurant_contact: the verified owner saves phone and website directly, bad values
// and other users are refused, an empty value clears the field, and the migration can run twice.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/contact-details-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`ALTER TABLE restaurants ADD COLUMN phone text, ADD COLUMN website_url text, ADD COLUMN updated_at timestamptz;`);
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261113190000_owner_contact_details.sql`);
await db.exec(sql); await db.exec(sql);
const OWNER = "00000000-0000-0000-0000-0000000000a1", STRANGER = "00000000-0000-0000-0000-0000000000a3";
const R = "00000000-0000-0000-0000-000000000101";
await db.exec(`INSERT INTO auth.users VALUES ('${OWNER}'), ('${STRANGER}');
  INSERT INTO restaurants (id, name, slug, claimed_by_owner_id) VALUES ('${R}', 'T', 't', '${OWNER}');`);
const as = (uid: string) => db.exec(`DELETE FROM test_ctx; INSERT INTO test_ctx VALUES ('${uid}', 'authenticated');`);
const set = async (p: string | null, w: string | null) => {
  try { await db.query("SELECT set_restaurant_contact($1, $2, $3)", [R, p, w]); return true; } catch { return false; }
};
const row = async () => (await db.query<{ phone: string | null; website_url: string | null }>("SELECT phone, website_url FROM restaurants")).rows[0];
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
await as(OWNER);
check("owner saves phone and website", await set("020 123 45 67", "https://testkeuken.nl/menu"));
let r = await row();
check("values stored", r.phone === "020 123 45 67" && r.website_url === "https://testkeuken.nl/menu", r);
check("+31 format accepted", await set("+31 (0)20-1234567", "testkeuken.nl"));
r = await row();
check("https:// added to a bare domain", r.website_url === "https://testkeuken.nl", r);
check("letters in phone refused", !(await set("bel ons", null)));
check("too short phone refused", !(await set("12", null)));
check("website without domain refused", !(await set(null, "https://localhost")));
check("website with spaces refused", !(await set(null, "https://mijn site.nl")));
check("empty clears both", await set("", "  "));
r = await row();
check("both null", r.phone === null && r.website_url === null, r);
await as(STRANGER);
check("other user refused", !(await set("0201234567", null)));
Deno.exit(ok ? 0 : 1);
