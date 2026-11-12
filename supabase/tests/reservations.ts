import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Runs the reservation-integrations migration in PGlite on top of the shared stubs and
// checks authorization, validation, the zenchef_id sync, funnel counters and statistics.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/reservations.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`
  ALTER TABLE public.restaurants ADD COLUMN zenchef_id text;
  -- Same definition as 20261106170000_owner_pro_analytics.sql.
  CREATE FUNCTION public.owner_analytics_allowed(p_restaurant_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT coalesce(auth.role(), '') = 'service_role'
        OR (auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)));
  $$;
`);
const OWNER = "00000000-0000-0000-0000-0000000000a1", ADMIN = "00000000-0000-0000-0000-0000000000a2", STRANGER = "00000000-0000-0000-0000-0000000000a3", OWNER2 = "00000000-0000-0000-0000-0000000000a4";
const R1 = "00000000-0000-0000-0000-000000000101", R2 = "00000000-0000-0000-0000-000000000102", LEGACY = "00000000-0000-0000-0000-000000000103", OLDURL = "00000000-0000-0000-0000-000000000104";
await db.exec(`
  INSERT INTO auth.users VALUES ('${OWNER}'), ('${ADMIN}'), ('${STRANGER}'), ('${OWNER2}');
  INSERT INTO user_roles VALUES ('${ADMIN}', 'admin');
  INSERT INTO restaurants (id, name, slug, claimed_by_owner_id, zenchef_id) VALUES
    ('${R1}', 'Trattoria', 'trattoria', '${OWNER}', NULL),
    ('${R2}', 'Buur', 'buur', '${OWNER2}', NULL),
    ('${LEGACY}', 'Legacy', 'legacy', NULL, ' 378183 '),
    ('${OLDURL}', 'Oud', 'oud', NULL, 'https://widget.zenchef.com/x');
`);
await db.exec(await Deno.readTextFile(`${repo}/supabase/migrations/20261111120000_reservation_integrations.sql`));
console.log("migrated 20261111120000_reservation_integrations.sql");

const as = async (uid: string | null, role = uid ? "authenticated" : "anon") => db.exec(`UPDATE test_ctx SET uid = ${uid ? `'${uid}'` : "NULL"}, role = '${role}'`);
let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`, ok ? "" : JSON.stringify(detail)); if (!ok) failures++; };
const q = async (sql: string) => (await db.query(sql)).rows as any[];
const err = async (sql: string) => { try { await db.query(sql); return ""; } catch (e) { return String(e); } };
const zid = async (id: string) => (await q(`SELECT zenchef_id FROM restaurants WHERE id = '${id}'`))[0].zenchef_id;
const save = (r: string, ext: string, cfg = "{}", method = "widget") => `SELECT * FROM save_reservation_integration('${r}', 'zenchef', '${ext}', '${method}', '${cfg}'::jsonb)`;

// Backfill of existing numeric zenchef_id values
const legacy = await q(`SELECT * FROM restaurant_integrations WHERE restaurant_id = '${LEGACY}'`);
check("legacy numeric zenchef_id becomes a live widget integration", legacy.length === 1 && legacy[0].status === "connected" && legacy[0].enabled && legacy[0].external_restaurant_id === "378183", legacy);
check("legacy zenchef_id is normalised by the sync trigger", (await zid(LEGACY)) === "378183");
check("non-numeric legacy zenchef_id is left alone", (await q(`SELECT 1 FROM restaurant_integrations WHERE restaurant_id = '${OLDURL}'`)).length === 0);

// Authorization
await as(null);
check("anonymous visitor cannot connect", (await err(save(R1, "1001"))).includes("Not authorized"));
await as(STRANGER);
check("other user cannot connect someone else's restaurant", (await err(save(R1, "1001"))).includes("Not authorized"));
check("other user cannot disconnect", (await err(`SELECT disconnect_reservation_integration('${LEGACY}', 'zenchef')`)).includes("Not authorized"));
check("other user cannot read reservation stats", (await err(`SELECT * FROM reservation_stats_summary('${R1}')`)).includes("Not authorized"));

// Validation
await as(OWNER);
check("invalid Zenchef ID is rejected", (await err(save(R1, "abc"))).includes("Ongeldig Zenchef-restaurant-ID"));
check("script injection as ID is rejected", (await err(save(R1, "1<script>"))).includes("Ongeldig"));
check("unknown config key is rejected", (await err(save(R1, "1001", '{"script":"x"}'))).includes("Onbekende instelling"));
check("invalid language is rejected", (await err(save(R1, "1001", '{"lang":"xx"}'))).includes("Ongeldige taal"));
check("unknown provider is rejected", (await err(`SELECT * FROM save_reservation_integration('${R1}', 'thefork', '1', 'widget', '{}'::jsonb)`)).includes("Onbekend reserveringssysteem"));
check("a Zenchef venue linked to another restaurant cannot be claimed", (await err(save(R1, "378183"))).includes("al aan een ander restaurant"));

// Connect flow: save -> testing (hidden) -> confirm -> live
const saved = (await q(save(R1, "1001", '{"lang":"nl"}')))[0];
check("save puts the integration in testing, disabled", saved.status === "testing" && saved.enabled === false, saved);
check("nothing is public while testing", (await q(`SELECT * FROM public_reservation_options('${R1}')`)).length === 0 && (await zid(R1)) === null);
const confirmed = (await q(`SELECT * FROM confirm_reservation_integration('${R1}', 'zenchef')`))[0];
check("confirm makes it connected and enabled", confirmed.status === "connected" && confirmed.enabled && confirmed.verified_by === OWNER, confirmed);
check("restaurants.zenchef_id is synced on confirm", (await zid(R1)) === "1001");
await as(null);
const opt = await q(`SELECT * FROM public_reservation_options('${R1}')`);
check("public options expose only provider, method, id, lang, timezone", opt.length === 1 && opt[0].lang === "nl" && opt[0].timezone === "Europe/Amsterdam" && Object.keys(opt[0]).length === 5, opt);

// Uniqueness across restaurants
await as(OWNER2);
check("second owner cannot link the same Zenchef ID", (await err(save(R2, "1001"))).includes("al aan een ander restaurant"));

// Enable / disable
await as(OWNER);
await q(`SELECT * FROM set_reservation_integration_enabled('${R1}', 'zenchef', false)`);
check("disabling hides the widget publicly", (await zid(R1)) === null && (await q(`SELECT * FROM public_reservation_options('${R1}')`)).length === 0);
await q(`SELECT * FROM set_reservation_integration_enabled('${R1}', 'zenchef', true)`);
check("re-enabling restores it", (await zid(R1)) === "1001");

// Changing the ID resets verification; changing only config keeps it
await q(save(R1, "1001", '{"lang":"en"}'));
check("config-only change keeps the live status", (await zid(R1)) === "1001");
const changed = (await q(save(R1, "1002")))[0];
check("changing the ID resets to testing and hides the widget", changed.status === "testing" && !changed.enabled && (await zid(R1)) === null, changed);
check("enabling an unconfirmed integration is refused", (await err(`SELECT * FROM set_reservation_integration_enabled('${R1}', 'zenchef', true)`)).includes("nog niet bevestigd"));
const api = (await q(save(R1, "1002", "{}", "api")))[0];
check("API method stays 'configuratie vereist' without API access", api.status === "config_required" && !api.enabled, api);
check("API method cannot be confirmed as a widget", (await err(`SELECT * FROM confirm_reservation_integration('${R1}', 'zenchef')`)).includes("geen widgetkoppeling"));

// Admin may manage any restaurant
await as(ADMIN);
check("admin can manage integrations", (await q(save(R2, "2002"))).length === 1);

// Funnel counters
await as(null);
const items = JSON.stringify([
  { r: R1, s: "flow_started", c: "truffelpasta" }, { r: R1, s: "widget_opened", c: "Truffel Pasta!" },
  { r: R1, s: "evil", c: "x" }, { r: "00000000-0000-0000-0000-000000000999", s: "flow_started", c: "x" }, { r: "nope", s: "flow_started" },
]);
check("funnel counts only valid stages for existing restaurants", (await q(`SELECT track_reservation_funnel('${items}'::jsonb) AS n`))[0].n === 2);
const many = JSON.stringify(Array.from({ length: 30 }, () => ({ r: R1, s: "widget_booking_reported", c: "zoek" })));
check("funnel caps a call at 20 items", (await q(`SELECT track_reservation_funnel('${many}'::jsonb) AS n`))[0].n === 20);
check("unsafe context falls back to 'zoek'", (await q(`SELECT 1 FROM reservation_funnel_daily WHERE stage = 'widget_opened' AND context = 'zoek'`)).length === 1);

// Statistics: confirmed only with provider evidence
await db.exec(`
  INSERT INTO restaurant_stats_daily VALUES ('${R1}', current_date, 'reserveren', 'truffelpasta', 12);
  INSERT INTO reservations (restaurant_id, provider, external_reservation_id, status, starts_at, party_size, evidence, dish_context, idempotency_key) VALUES
    ('${R1}', 'zenchef', 'zc-1', 'confirmed', now() + interval '2 days', 2, 'provider_confirmed', 'truffelpasta', 'k-aaaaaaaaaaaaaaa1'),
    ('${R1}', 'zenchef', 'zc-2', 'cancelled', now() + interval '2 days', 2, 'provider_confirmed', 'truffelpasta', 'k-aaaaaaaaaaaaaaa2'),
    ('${R1}', 'zenchef', NULL, 'pending', now() + interval '2 days', 2, NULL, 'truffelpasta', 'k-aaaaaaaaaaaaaaa3'),
    ('${R1}', 'zenchef', NULL, 'failed', now() + interval '2 days', 2, NULL, NULL, 'k-aaaaaaaaaaaaaaa4');
`);
await as(OWNER);
const stats = await q(`SELECT metric, context, n::int AS n FROM reservation_stats_summary('${R1}', 30) ORDER BY metric, context`);
const get = (m: string) => stats.filter((s) => s.metric === m).reduce((n, s) => n + s.n, 0);
check("clicks come from the existing counter", get("clicks") === 12, stats);
check("started flows and widget reports are separate metrics", get("flow_started") === 1 && get("widget_opened") === 1 && get("widget_booking_reported") === 20, stats);
check("confirmed counts only provider-evidenced bookings", get("confirmed") === 1 && get("cancelled") === 1, stats);
check("confirmed bookings keep their dish attribution", stats.some((s) => s.metric === "confirmed" && s.context === "truffelpasta"));

// Disconnect removes integration data but keeps evidence-only reservation rows
await db.exec(`INSERT INTO integration_events (provider, event_id, restaurant_id, event_type) VALUES ('zenchef', 'ev-1', '${R1}', 'reservation.updated')`);
await q(`SELECT disconnect_reservation_integration('${R1}', 'zenchef')`);
check("disconnect deletes the integration and its events", (await q(`SELECT 1 FROM restaurant_integrations WHERE restaurant_id = '${R1}'`)).length === 0 && (await q(`SELECT 1 FROM integration_events WHERE restaurant_id = '${R1}'`)).length === 0);
check("disconnect clears zenchef_id and guest manage tokens", (await zid(R1)) === null && (await q(`SELECT 1 FROM reservations WHERE restaurant_id = '${R1}' AND manage_token_hash IS NOT NULL`)).length === 0);
check("reservation history (no guest data) remains", (await q(`SELECT 1 FROM reservations WHERE restaurant_id = '${R1}'`)).length === 4);

// Event dedupe at the database level
let dup = false; try { await db.query(`INSERT INTO integration_events (provider, event_id, event_type) VALUES ('zenchef', 'ev-x', 'a'), ('zenchef', 'ev-x', 'a')`); } catch { dup = true; }
check("the same provider event id cannot be stored twice", dup);
let dupKey = false; try { await db.query(`INSERT INTO reservations (restaurant_id, provider, starts_at, party_size, idempotency_key) VALUES ('${R2}', 'zenchef', now(), 2, 'k-aaaaaaaaaaaaaaa1')`); } catch { dupKey = true; }
check("the same idempotency key cannot create a second reservation", dupKey);

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
if (failures) Deno.exit(1);
