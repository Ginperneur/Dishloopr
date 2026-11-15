import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks the junk-dish cleanup: the strict rule that picked the IDs in 20261114090000_hide_junk_dishes
// keeps real dishes (also long descriptions), and the migration only hides dishes no restaurant approved.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/dish-junk.ts

/** The rule used to select the IDs on 2026-11-13: only text that can never be a dish name. */
export function isCertainJunk(raw: string): string | null {
  const n = raw.trim();
  const words = n.split(/\s+/).length;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return "stuurteken";
  if ((n.match(/\p{L}/gu) ?? []).length < 2) return "geen letters";
  if (!/\p{L}{2}/u.test(n)) return "losse tekens";
  if (/\b0\d{1,3}[\s-]?\d{3}/.test(n) && /\d{6,}|\d{3}\s?\d{3}/.test(n)) return "telefoonnummer";
  if (/(https?:|www\.|@[a-z]|\.(nl|com|eu|be|de)\b)/i.test(n)) return "link of mail";
  if (/\b(artikel \d|privacy|cookiebeleid|algemene voorwaarden|niet toegestaan|allergenen ?informatie|openingstijden|ervaring op onze website|klant reviews)\b/i.test(n) && words > 3) return "websitetekst";
  if (/^[•*]/.test(n) && words > 5) return "opsomming van de website";
  return null;
}

let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const keep = ["Rendang", "Calamaris Gefrituurde inktvis met teriyaki saus, rode peper, bosui en sesamzaad.",
  "Tomato soup with riso pasta, carrot and leek", "Roma 32cm", "TOURNEDOS/ PEPERSAUS/ AARDAPPEL KERRIE MOUSSELINE /",
  "(6 stuks sieuw mai; Kantonese gefrituurde vleespasteitjes met zoete chilisaus)", "Passievruchten- bavarois",
  "APPLE PIE APPLE COMPÔTE | COOKIE CRUMBLE | HONEY / CINNAMON BUTTER", "Crème brûlée", "Bò bún", "L24姜蔥牛肉餃 Ngau Yuk Kou"];
const drop = ["Bataviastraat 1 3531XA Utrecht 0302933485 783 klant reviews", "Restaurant: 040-3021320", "S22",
  "Artikel 5 Algemene rechten en verplichtingen van het horecabedrijf", "04bet.com $10260 USD", "msy 0r\u0007",
  "• Het personaliseren van uw ervaring op onze website.", "D I N E R K A A R T", "Openingstijden: 10:30 - 17:00"];
for (const n of keep) check(`kept: ${n}`, isCertainJunk(n) === null, isCertainJunk(n));
for (const n of drop) check(`hidden: ${JSON.stringify(n)}`, isCertainJunk(n) !== null);

// Migration: runs twice, hides an unlinked junk dish, keeps an approved one, rejects open suggestions.
const repo = Deno.args[0] ?? ".";
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261114090000_hide_junk_dishes.sql`);
const ids = [...sql.matchAll(/\('([0-9a-f-]{36})'\)/g)].map(m => m[1]);
check("migration lists the selected IDs", ids.length > 600, ids.length);
const db = new PGlite();
await db.exec(`CREATE TYPE dish_status AS ENUM ('suggested', 'approved_by_admin', 'verified_by_owner', 'rejected');
  CREATE TABLE dishes (id uuid PRIMARY KEY, name text, is_active boolean NOT NULL DEFAULT true);
  CREATE TABLE restaurant_dishes (id serial PRIMARY KEY, dish_id uuid, status dish_status, rejected_reason text);
  INSERT INTO dishes (id, name) VALUES ('${ids[0]}', 'junk a'), ('${ids[1]}', 'junk b'), ('00000000-0000-0000-0000-00000000beef', 'Rendang');
  INSERT INTO restaurant_dishes (dish_id, status) VALUES ('${ids[0]}', 'suggested'), ('${ids[1]}', 'verified_by_owner');`);
await db.exec(sql); await db.exec(sql);
const d = (await db.query<{ name: string; is_active: boolean }>("SELECT name, is_active FROM dishes ORDER BY name")).rows;
check("unlinked junk hidden", d.find(x => x.name === "junk a")?.is_active === false, d);
check("junk approved by a restaurant stays", d.find(x => x.name === "junk b")?.is_active === true, d);
check("other dishes untouched", d.find(x => x.name === "Rendang")?.is_active === true, d);
const rd = (await db.query<{ status: string }>("SELECT status FROM restaurant_dishes ORDER BY id")).rows;
check("open suggestion rejected, approved link kept", rd[0].status === "rejected" && rd[1].status === "verified_by_owner", rd);
Deno.exit(ok ? 0 : 1);
