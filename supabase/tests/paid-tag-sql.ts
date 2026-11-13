import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks sync_paid_restaurant_tag: a paid extra tag appears on the restaurant, disappears when the
// subscription ends, and the owner's free (first) tag is never removed.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/paid-tag-sql.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`ALTER TABLE restaurants ADD COLUMN cuisines text[], ADD COLUMN ambience_tags text[],
    ADD COLUMN concepts text[], ADD COLUMN experiences text[], ADD COLUMN updated_at timestamptz;
  CREATE TABLE restaurant_tag_subscriptions (id serial PRIMARY KEY, restaurant_id uuid, user_id uuid,
    tag_category text, tag_value text, stripe_subscription_id text, is_active boolean NOT NULL DEFAULT true);`);
const R = "00000000-0000-0000-0000-000000000101";
await db.exec(`INSERT INTO restaurants (id, name, slug, ambience_tags) VALUES ('${R}', 'T', 't', ARRAY['Gezellig']);`);
await db.exec(`INSERT INTO restaurant_tag_subscriptions (restaurant_id, tag_category, tag_value, stripe_subscription_id, is_active)
  VALUES ('${R}', 'ambience', 'Romantisch', 'sub_old', true);`); // paid before the trigger existed
await db.exec(await Deno.readTextFile(`${repo}/supabase/migrations/20261113140000_paid_tag_sync.sql`));
const tags = async () => (await db.query<{ a: string[] }>(`SELECT ambience_tags a FROM restaurants WHERE id = '${R}'`)).rows[0].a;
let ok = true;
const check = (label: string, pass: boolean, got?: unknown) => { ok &&= pass; console.log(pass ? "PASS" : "FAIL", label, pass ? "" : JSON.stringify(got)); };

let t = await tags(); check("backfill adds an earlier paid tag", JSON.stringify(t) === '["Gezellig","Romantisch"]', t);
await db.exec(`INSERT INTO restaurant_tag_subscriptions (restaurant_id, tag_category, tag_value, stripe_subscription_id) VALUES ('${R}', 'ambience', 'Intiem', 'sub_1')`);
t = await tags(); check("new paid tag appended after the free one", JSON.stringify(t) === '["Gezellig","Romantisch","Intiem"]', t);
await db.exec(`UPDATE restaurant_tag_subscriptions SET is_active = false WHERE stripe_subscription_id = 'sub_1'`);
t = await tags(); check("cancelled tag removed", JSON.stringify(t) === '["Gezellig","Romantisch"]', t);
await db.exec(`INSERT INTO restaurant_tag_subscriptions (restaurant_id, tag_category, tag_value, stripe_subscription_id, is_active) VALUES ('${R}', 'ambience', 'Gezellig', 'sub_free', true)`);
await db.exec(`UPDATE restaurant_tag_subscriptions SET is_active = false WHERE stripe_subscription_id = 'sub_free'`);
t = await tags(); check("free tag never removed", (t ?? [])[0] === 'Gezellig', t);
await db.exec(`DELETE FROM restaurant_tag_subscriptions WHERE stripe_subscription_id = 'sub_old'`);
t = await tags(); check("deleted subscription removes its tag", JSON.stringify(t) === '["Gezellig"]', t);
await db.exec(`INSERT INTO restaurant_tag_subscriptions (restaurant_id, tag_category, tag_value, stripe_subscription_id) VALUES ('${R}', 'cuisine', 'Thais', 'sub_c')`);
const c = (await db.query<{ c: string[] }>(`SELECT cuisines c FROM restaurants WHERE id = '${R}'`)).rows[0].c;
check("works on an empty category", JSON.stringify(c) === '["Thais"]', c);
Deno.exit(ok ? 0 : 1);
