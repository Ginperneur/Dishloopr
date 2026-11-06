import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Runs the owner-analytics, packages and launch-date migrations in PGlite (in-process
// Postgres) on top of stubs for the Supabase-managed objects, then checks the functions.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/sql-functions.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
const strip = (sql: string) => sql.replace(/CREATE EXTENSION IF NOT EXISTS pg_(cron|net);/g, "");
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
for (const m of ["20261106160000_package_orders.sql", "20261106170000_owner_pro_analytics.sql", "20261106180000_owner_analytics_live_counters.sql", "20261106190000_launch_date_setting.sql"]) {
  await db.exec(strip(await Deno.readTextFile(`${repo}/supabase/migrations/${m}`)));
  console.log("migrated", m);
}
const OWNER = "00000000-0000-0000-0000-0000000000a1", ADMIN = "00000000-0000-0000-0000-0000000000a2", STRANGER = "00000000-0000-0000-0000-0000000000a3";
const CITY = "00000000-0000-0000-0000-0000000000c1";
const R = (i: number) => `00000000-0000-0000-0000-00000000010${i}`;
const D = { carbonara: "00000000-0000-0000-0000-0000000000d1", ramen: "00000000-0000-0000-0000-0000000000d2", pizza: "00000000-0000-0000-0000-0000000000d3" };
await db.exec(`
  INSERT INTO auth.users VALUES ('${OWNER}'), ('${ADMIN}'), ('${STRANGER}');
  INSERT INTO user_roles VALUES ('${ADMIN}', 'admin');
  INSERT INTO cities VALUES ('${CITY}', 'Utrecht');
  INSERT INTO restaurants (id, name, slug, city_id, claimed_by_owner_id, rating) VALUES
    ('${R(1)}', 'Mijn Trattoria', 'mijn-trattoria', '${CITY}', '${OWNER}', 4.5),
    ('${R(2)}', 'Buur 2', 'buur-2', '${CITY}', NULL, 4.2), ('${R(3)}', 'Buur 3', 'buur-3', '${CITY}', NULL, 4.0),
    ('${R(4)}', 'Buur 4', 'buur-4', '${CITY}', NULL, 3.9), ('${R(5)}', 'Buur 5', 'buur-5', '${CITY}', NULL, 3.8),
    ('${R(6)}', 'Buur 6', 'buur-6', '${CITY}', NULL, 3.7);
  INSERT INTO dishes VALUES ('${D.carbonara}', 'Carbonara', 'carbonara', NULL), ('${D.ramen}', 'Ramen', 'ramen', NULL), ('${D.pizza}', 'Pizza', 'pizza', NULL);
  INSERT INTO restaurant_dishes (restaurant_id, dish_id, price, status) VALUES
    ('${R(1)}', '${D.carbonara}', 17, 'approved_by_admin'),
    ('${R(2)}', '${D.carbonara}', 14, 'approved_by_admin'), ('${R(3)}', '${D.carbonara}', 15, 'approved_by_admin'),
    ('${R(4)}', '${D.carbonara}', 14.5, 'verified_by_owner'), ('${R(5)}', '${D.ramen}', 16, 'approved_by_admin');
  INSERT INTO seo_landing_pages VALUES ('carbonara-utrecht', '${D.carbonara}');
  INSERT INTO restaurant_stats_daily VALUES
    ('${R(1)}', current_date, 'impressie', 'carbonara-utrecht', 100), ('${R(1)}', current_date, 'bekeken', 'carbonara-utrecht', 20),
    ('${R(1)}', current_date, 'reserveren', 'carbonara-utrecht', 3), ('${R(1)}', current_date, 'website', 'zoek', 2),
    ('${R(1)}', current_date - 10, 'impressie', 'carbonara-utrecht', 300), ('${R(1)}', current_date - 10, 'bekeken', 'stad', 5),
    ('${R(1)}', current_date - 365, 'impressie', 'carbonara-utrecht', 40);
  INSERT INTO search_logs (query_norm, city, clicked_restaurant_id, created_at) VALUES
    ('ramen', 'Utrecht', NULL, now()), ('ramen', 'utrecht', NULL, now()), ('ramen', 'Utrecht', NULL, now()),
    ('carbonara', 'Utrecht', '${R(2)}', now()), ('carbonara', 'Utrecht', '${R(2)}', now()), ('carbonara', 'Utrecht', '${R(1)}', now()),
    ('pizza', 'Amsterdam', NULL, now());
  INSERT INTO reviews VALUES ('${R(1)}', 5, 'published', now()), ('${R(1)}', 3, 'published', now() - interval '40 days');
`);
const as = async (uid: string | null, role: string) => db.exec(`UPDATE test_ctx SET uid = ${uid ? `'${uid}'` : "NULL"}, role = '${role}'`);
let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`, ok ? "" : JSON.stringify(detail)); if (!ok) failures++; };
const q = async (sql: string) => (await db.query(sql)).rows as any[];
const denied = async (sql: string) => { try { await db.query(sql); return false; } catch (e) { return String(e).includes("Not authorized"); } };

// Founding Partner places
await as(null, "anon");
check("5 places free on an empty page", (await q(`SELECT founding_places_left('carbonara-utrecht') AS n`))[0].n === 5);
for (let i = 1; i <= 5; i++) await db.exec(`INSERT INTO package_orders (restaurant_id, package, plan, page_slug, status, amount_cents, stripe_session_id) VALUES ('${R(i)}', 'founding_partner', 'month', 'carbonara-utrecht', '${i === 1 ? "trialing" : "active"}', 5900, 'cs_${i}')`);
await db.exec(`INSERT INTO package_orders (restaurant_id, package, plan, page_slug, status, amount_cents, stripe_session_id) VALUES ('${R(6)}', 'founding_partner', 'month', 'carbonara-utrecht', 'cancelled', 5900, 'cs_6')`);
check("0 places left after 5 live orders (cancelled not counted)", (await q(`SELECT founding_places_left('carbonara-utrecht') AS n`))[0].n === 0);
check("founding_partners_for_page lists the 5 live ones", (await q(`SELECT * FROM founding_partners_for_page('carbonara-utrecht')`)).length === 5);
let bad = false; try { await db.query(`INSERT INTO package_orders (restaurant_id, package, plan, status, amount_cents) VALUES ('${R(1)}', 'founding_partner', 'month', 'active', 5900)`); } catch { bad = true; }
check("founding order without page is rejected", bad);

// Founding metrics
const n = await q(`SELECT track_founding_metrics('[{"r":"${R(1)}","p":"carbonara-utrecht","m":"impressie"},{"r":"${R(1)}","p":"carbonara-utrecht","m":"impressie"},{"r":"${R(1)}","p":"carbonara-utrecht","m":"klik"},{"r":"${R(6)}","p":"carbonara-utrecht","m":"klik"},{"r":"x","p":"a","m":"klik"},{"r":"${R(1)}","p":"carbonara-utrecht","m":"evil"}]'::jsonb) AS n`);
check("track_founding_metrics stores only live Founding Partners", n[0].n === 2, n);
await as(STRANGER, "authenticated");
check("stranger cannot read founding stats", await (async () => { try { await db.query(`SELECT * FROM owner_founding_stats('${R(1)}')`); return false; } catch { return true; } })());
await as(OWNER, "authenticated");
const fs = await q(`SELECT metric, totaal FROM owner_founding_stats('${R(1)}') ORDER BY metric`);
check("owner sees 2 impressions and 1 click", fs.length === 2 && Number(fs[0].totaal) === 2 && Number(fs[1].totaal) === 1, fs);

// Analytics access
await as(null, "anon");
check("anon is denied the funnel", await denied(`SELECT * FROM get_owner_funnel('${R(1)}')`));
await as(STRANGER, "authenticated");
check("other user is denied the funnel", await denied(`SELECT * FROM get_owner_funnel('${R(1)}')`));
await as(null, "service_role");
check("service role may read the funnel", (await q(`SELECT * FROM get_owner_funnel('${R(1)}', 30)`)).length === 1);
await as(ADMIN, "authenticated");
check("admin may read the funnel", (await q(`SELECT * FROM get_owner_funnel('${R(1)}', 30)`)).length === 1);
await as(OWNER, "authenticated");
const f = (await q(`SELECT * FROM get_owner_funnel('${R(1)}', 30)`))[0];
check("funnel 30d = 400 in beeld, 25 bekeken, 5 conversies", Number(f.views) === 400 && Number(f.clicks) === 25 && Number(f.conversions) === 5, f);
const heat = await q(`SELECT * FROM get_search_term_heatmap('${R(1)}', 30, 10)`);
check("heatmap shows 'carbonara utrecht' 400", heat.length === 1 && heat[0].search_term === "carbonara utrecht" && Number(heat[0].hits) === 400, heat);
const tf = await q(`SELECT * FROM owner_term_funnel('${R(1)}', 30)`);
check("term funnel: 1 reservation via carbonara", tf.length === 1 && Number(tf[0].reservations) === 3, tf);

// Positions
await as(null, "service_role");
check("snapshot stores positions of claimed restaurants", (await q(`SELECT snapshot_restaurant_positions() AS n`))[0].n === 1);
await as(OWNER, "authenticated");
const ph = await q(`SELECT * FROM owner_position_history('${R(1)}')`);
check("owner sees today's position #2 of 7", ph.length === 1 && ph[0].position === 2 && ph[0].total === 7, ph);

// Demand, prices
const md = await q(`SELECT * FROM owner_missed_demand('${R(1)}')`);
check("missed demand: ramen searched 3x, carbonara (on menu) excluded", md.length === 1 && md[0].query === "ramen" && Number(md[0].searches) === 3, md);
const pb = await q(`SELECT * FROM owner_price_benchmark('${R(1)}')`);
check("price benchmark: carbonara €17 vs avg €14.50 at 3 restaurants", pb.length === 1 && Number(pb[0].my_price) === 17 && Number(pb[0].city_avg) === 14.5 && Number(pb[0].restaurants) === 3, pb);

// Live-counter rewrites
const an = await q(`SELECT * FROM get_owner_funnel_anomalies('${R(1)}') ORDER BY metric`);
const av = an.find(r => r.metric === "views");
check("anomalies: views 100 now vs 300 last week = critical", Number(av.current_value) === 100 && Number(av.previous_value) === 300 && av.severity === "critical", an);
const hb = (await q(`SELECT * FROM get_owner_historical_benchmark('${R(1)}', 30)`))[0];
check("year-over-year: 400 now vs 40 a year ago", Number(hb.current_views) === 400 && Number(hb.previous_views) === 40, hb);
const at = await q(`SELECT * FROM get_owner_attribution('${R(1)}', 30)`);
check("attribution has Zoeken, Stadspagina and Gerechtpagina rows", ["Zoeken", "Stadspagina", "Gerechtpagina of zoekterm"].every(c => at.some(r => r.channel === c)), at);
const sh = await q(`SELECT sum(searches) AS n FROM owner_search_hours('${R(1)}')`);
check("search hours count the 3 carbonara searches in Utrecht", Number(sh[0].n) === 3, sh);
const lc = await q(`SELECT * FROM owner_lost_to_competitor('${R(1)}')`);
check("lost to competitor: Buur 2 got 2 carbonara clicks", lc.length === 1 && lc[0].name === "Buur 2" && Number(lc[0].clicks) === 2, lc);
const sb = (await q(`SELECT * FROM owner_stats_between('${R(1)}', current_date - 1, current_date)`))[0];
check("stats between today only: 100 impressions", Number(sb.impressions) === 100, sb);
check("daily metrics returns rows", (await q(`SELECT * FROM owner_daily_metrics('${R(1)}', 30)`)).length >= 4);
const dd = await q(`SELECT dish_id, sum(views) AS v FROM owner_dish_daily('${R(1)}', 60) GROUP BY 1`);
check("dish daily: carbonara views via its page = 20", dd.length === 1 && Number(dd[0].v) === 20, dd);

const ld = await q(`SELECT public_launch_date() AS d`);
check("public_launch_date() = 2026-12-10", String(ld[0].d).startsWith("2026-12-10") || new Date(ld[0].d).toISOString().startsWith("2026-12-"), ld);
await db.exec(`UPDATE app_settings SET value = 'nonsense' WHERE key = 'launch_date'`);
check("malformed launch date gives NULL", (await q(`SELECT public_launch_date() AS d`))[0].d === null);
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
Deno.exit(failures ? 1 : 0);
