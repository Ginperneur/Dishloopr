import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks set_restaurant_opening_hours: valid hours are saved directly by the owner, anything
// outside the required format and anyone but the owner is refused.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/opening-hours-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`ALTER TABLE restaurants ADD COLUMN opening_hours jsonb, ADD COLUMN updated_at timestamptz;`);
await db.exec(await Deno.readTextFile(`${repo}/supabase/migrations/20261113150000_owner_opening_hours.sql`));
const OWNER = "00000000-0000-0000-0000-0000000000a1", STRANGER = "00000000-0000-0000-0000-0000000000a3";
const R = "00000000-0000-0000-0000-000000000101";
await db.exec(`INSERT INTO auth.users VALUES ('${OWNER}'), ('${STRANGER}');
  INSERT INTO restaurants (id, name, slug, claimed_by_owner_id) VALUES ('${R}', 'T', 't', '${OWNER}');`);
const as = (uid: string) => db.exec(`DELETE FROM test_ctx; INSERT INTO test_ctx VALUES ('${uid}', 'authenticated');`);
const week = (over: Record<string, string> = {}) => JSON.stringify({ mon: "12:00 - 22:00", tue: "gesloten", wed: "12:00 - 14:30, 17:00 - 22:00",
  thu: "18:00 - 02:00", fri: "17:00 - 24:00", sat: "09:00 - 17:00", sun: "gesloten", ...over });
const set = async (h: string) => { try { await db.query("SELECT set_restaurant_opening_hours($1, $2::jsonb)", [R, h]); return true; } catch { return false; } };
let ok = true;
const check = (label: string, pass: boolean, got?: unknown) => { ok &&= pass; console.log(pass ? "PASS" : "FAIL", label, pass ? "" : JSON.stringify(got)); };

await as(OWNER);
check("owner saves a valid week directly", await set(week()));
const saved = (await db.query<{ h: Record<string, string> }>(`SELECT opening_hours h FROM restaurants WHERE id = '${R}'`)).rows[0].h;
check("stored as given", saved.wed === "12:00 - 14:30, 17:00 - 22:00" && saved.tue === "gesloten", saved);
check("'dicht' refused", !(await set(week({ fri: "dicht" }))));
check("free text refused", !(await set(week({ mon: "ma-vr 12-22" }))));
check("unformatted time refused", !(await set(week({ mon: "9-17" }))));
check("impossible time refused", !(await set(week({ mon: "25:00 - 26:00" }))));
check("missing day refused", !(await set(JSON.stringify({ mon: "gesloten" }))));
check("four blocks refused", !(await set(week({ mon: "08:00 - 09:00, 10:00 - 11:00, 12:00 - 13:00, 14:00 - 15:00" }))));
await as(STRANGER);
check("someone else refused", !(await set(week())));
Deno.exit(ok ? 0 : 1);
