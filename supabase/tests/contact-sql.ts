import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks the owner contact migration: messages get a status, a sender can't file under someone
// else's id or for a restaurant they don't manage, and the migration can run twice.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/contact-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`CREATE TABLE contact_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, email text,
  subject text, message text, created_at timestamptz DEFAULT now());`);
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261113170000_owner_contact.sql`);
await db.exec(sql); await db.exec(sql); // must be idempotent
const OWNER = "00000000-0000-0000-0000-0000000000a1", OTHER = "00000000-0000-0000-0000-0000000000a3";
const R = "00000000-0000-0000-0000-000000000101", R2 = "00000000-0000-0000-0000-000000000102";
await db.exec(`INSERT INTO auth.users VALUES ('${OWNER}'), ('${OTHER}');
  INSERT INTO restaurants (id, name, slug, claimed_by_owner_id) VALUES ('${R}', 'Mijn', 'mijn', '${OWNER}'), ('${R2}', 'Ander', 'ander', '${OTHER}');
  DELETE FROM test_ctx; INSERT INTO test_ctx VALUES ('${OWNER}', 'authenticated');`);
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
await db.exec(`INSERT INTO contact_messages (name, email, subject, message, category, restaurant_id, user_id, status)
  VALUES ('E', 'e@x.nl', 'Factuur', 'Klopt niet', 'betaling', '${R}', '${OWNER}', 'afgehandeld')`);
const row = (await db.query<{ status: string; restaurant_id: string }>("SELECT status, restaurant_id FROM contact_messages")).rows[0];
check("new message starts as nieuw (owner can't preset status)", row.status === "nieuw", row);
check("own restaurant kept", row.restaurant_id === R, row);
await db.exec(`INSERT INTO contact_messages (name, email, subject, message, restaurant_id, user_id) VALUES ('E','e@x.nl','x','y','${R2}','${OWNER}')`);
const r2 = (await db.query<{ restaurant_id: string | null }>("SELECT restaurant_id FROM contact_messages WHERE subject = 'x'")).rows[0];
check("someone else's restaurant dropped", r2.restaurant_id === null, r2);
let blocked = false;
try { await db.exec(`INSERT INTO contact_messages (name, email, subject, message, user_id) VALUES ('E','e@x.nl','s','m','${OTHER}')`); } catch { blocked = true; }
check("filing under another user's id refused", blocked);
let badCat = false;
try { await db.exec(`INSERT INTO contact_messages (name, email, subject, message, category) VALUES ('E','e@x.nl','s','m','spam')`); } catch { badCat = true; }
check("unknown category refused", badCat);
await db.exec(`DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (NULL, 'anon');`);
await db.exec(`INSERT INTO contact_messages (name, email, subject, message) VALUES ('Gast','g@x.nl','Vraag','Hoi')`);
const anon = (await db.query<{ status: string }>("SELECT status FROM contact_messages WHERE name = 'Gast'")).rows[0];
check("public contact form still works", anon?.status === "nieuw", anon);
Deno.exit(ok ? 0 : 1);
