import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks the national newsletter: the mail contains the placements (escaped), a sent campaign
// publishes its edition's approved placements, and the personal unsubscribe link works.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/newsletter.ts
import { buildNewsletterHtml, safeImage } from "../../src/lib/newsletterHtml.ts";
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };

const html = buildNewsletterHtml({ title: "Week 47", intro: "Hallo foodies", placements: [
  { title: "2e pizza gratis", description: "Alleen op dinsdag", promo_type: "actie", restaurant_name: "Testkeuken", restaurant_slug: "dishloopr-testkeuken", city_name: "Utrecht" },
  { title: "<script>alert(1)</script>", description: null, promo_type: "event", restaurant_name: "A & B", restaurant_slug: "a-b" },
] });
check("placement title in mail", html.includes("2e pizza gratis"));
check("link to restaurant page", html.includes("https://dishloopr.nl/restaurant/dishloopr-testkeuken?utm_source=nieuwsbrief"));
check("owner text is escaped", !html.includes("<script>") && html.includes("&lt;script&gt;"));
check("ampersand escaped", html.includes("A &amp; B"));
check("unsubscribe placeholder present", html.includes("{{unsubscribe_url}}"));
check("paid placements disclosed", html.includes("hebben voor hun plek betaald"));

const IMG = "https://uktafmxojymsojqewzuy.supabase.co/storage/v1/object/public/restaurant-images/00000000-0000-0000-0000-000000000101/newsletter/1-abc.jpg";
const withPhoto = buildNewsletterHtml({ title: "W", placements: [
  { title: "Met foto", description: null, promo_type: "actie", restaurant_name: "T", restaurant_slug: "t", image_url: IMG },
  { title: "Vreemde foto", description: null, promo_type: "actie", restaurant_name: "T", restaurant_slug: "t", image_url: "https://evil.example/x.jpg" },
] });
check("photo from Dishloopr storage shown", withPhoto.includes(`src="${IMG}"`) && withPhoto.includes('alt="Met foto"'));
check("photo from elsewhere left out", !withPhoto.includes("evil.example"));
check("safeImage refuses javascript and quotes", safeImage('javascript:alert(1)') === null && safeImage(IMG + '" onerror="x') === null);

const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(`CREATE TABLE newsletter_editions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, status text DEFAULT 'draft',
    sent_at timestamptz, recipient_count int DEFAULT 0, updated_at timestamptz DEFAULT now());
  CREATE TABLE newsletter_placements (id serial PRIMARY KEY, edition_id uuid, status text, updated_at timestamptz DEFAULT now());
  -- photo migration runs below
  CREATE TABLE email_campaigns (id serial PRIMARY KEY, status text DEFAULT 'draft', sent_count int DEFAULT 0);
  CREATE TABLE newsletter_subscribers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, is_active boolean DEFAULT true, unsubscribed_at timestamptz);
  CREATE ROLE anon; CREATE ROLE authenticated;`);
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261114120000_newsletter_national.sql`);
await db.exec(sql); await db.exec(sql);
const photoSql = await Deno.readTextFile(`${repo}/supabase/migrations/20261114150000_newsletter_placement_photo.sql`);
await db.exec(photoSql); await db.exec(photoSql);
let refused = false;
try { await db.exec("INSERT INTO newsletter_placements (status, image_url) VALUES ('paid', 'https://evil.example/x.jpg')"); } catch { refused = true; }
check("database refuses a photo from elsewhere", refused);
await db.exec(`INSERT INTO newsletter_placements (status, image_url) VALUES ('rejected', '${IMG}')`);
check("database accepts a Dishloopr storage photo", true);
await db.exec("DELETE FROM newsletter_placements");
const ed = (await db.query<{ id: string }>("INSERT INTO newsletter_editions (title) VALUES ('W47') RETURNING id")).rows[0].id;
await db.exec(`INSERT INTO newsletter_placements (edition_id, status) VALUES ('${ed}', 'approved'), ('${ed}', 'paid'), ('${ed}', 'rejected');
  INSERT INTO email_campaigns (edition_id, status) VALUES ('${ed}', 'draft');`);
await db.exec("UPDATE email_campaigns SET status = 'sending'");
let e = (await db.query<{ status: string }>("SELECT status FROM newsletter_editions")).rows[0];
check("edition untouched while sending", e.status === "draft", e);
await db.exec("UPDATE email_campaigns SET status = 'completed', sent_count = 812");
e = (await db.query<{ status: string; recipient_count: number }>("SELECT status, recipient_count FROM newsletter_editions")).rows[0] as never;
check("edition sent with recipient count", (e as any).status === "sent" && (e as any).recipient_count === 812, e);
const ps = (await db.query<{ status: string }>("SELECT status FROM newsletter_placements ORDER BY id")).rows.map(r => r.status);
check("approved published, unapproved untouched", JSON.stringify(ps) === '["published","paid","rejected"]', ps);
const sub = (await db.query<{ id: string }>("INSERT INTO newsletter_subscribers (email) VALUES ('a@x.nl') RETURNING id")).rows[0].id;
const r = (await db.query<{ u: boolean }>("SELECT unsubscribe_newsletter($1) u", [sub])).rows[0].u;
const s = (await db.query<{ is_active: boolean }>("SELECT is_active FROM newsletter_subscribers")).rows[0];
check("unsubscribe deactivates", r === true && s.is_active === false, { r, s });
const bad = (await db.query<{ u: boolean }>("SELECT unsubscribe_newsletter(gen_random_uuid()) u")).rows[0].u;
check("unknown id reports false", bad === false);
Deno.exit(ok ? 0 : 1);
