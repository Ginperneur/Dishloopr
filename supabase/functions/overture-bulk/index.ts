// Bulk route for Overture candidates (docs/overture-uitrol.md):
//   create         pending Overture rows of one triage → restaurants, hidden until 5 dishes
//   import_dishes  screened Python scrape rows (keyed by overture_id) → approved dishes
//   scrape_queue   hidden bulk restaurants still under 5 dishes and never scraped → for the
//                  admin card, which runs scrape-menu + dish-screening on each
//   tick           one unattended step, run every minute by pg_cron while overture_pipeline.enabled:
//                  first the remaining "zeker goed" rows (create), then (only with its own switch
//                  include_sterk) 10 "sterk" rows per tick, plus the website route (scrape-menu + dish-screening) for a few hidden restaurants
// Restaurants go live by themselves: the restaurant_dishes trigger unhides a restaurant hidden
// for its menu once menu_dish_count() reaches visibility_menu_minimum().
import { requireAdminOrInternal, serviceClient, getCaller } from "../_shared/auth.ts";
import { geocodeWithPdok } from "../_shared/pdokGeocode.ts";
import { restaurantFromOverture } from "../_shared/overtureRestaurant.ts";
import {
  BULK_HIDDEN_REASON, TRIAGES, bulkErrorMessage, pendingOvertureBatch, chunks, cleanDishRows, linkRecord, newDishRecord, type DishImportRow,
} from "../_shared/overtureBulk.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = serviceClient();
  const deny = await requireAdminOrInternal(req, admin, corsHeaders);
  if (deny) return deny;

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "create") return json(await createBatch(admin, body, (await getCaller(req))?.id ?? null));
    if (body.action === "import_dishes") return json(await importDishes(admin, body));
    if (body.action === "scrape_queue") return json(await scrapeQueue(admin, body));
    if (body.action === "tick") return json(await tick(admin));
    return json({ error: "Onbekende actie (create, import_dishes, scrape_queue, tick)" }, 400);
  } catch (e) {
    console.error("overture-bulk", e);
    return json({ error: bulkErrorMessage(e) }, 500);
  }
});

// deno-lint-ignore no-explicit-any
type Db = any;

async function createBatch(admin: Db, body: { triage?: string; limit?: number }, reviewerId: string | null) {
  const triage = TRIAGES.find((value) => value === body.triage) ?? "verified";
  const limit = Math.min(Math.max(Number(body.limit) || 15, 1), 40);
  const { data: rows, error } = await pendingOvertureBatch(admin, triage, limit);
  if (error) throw error;

  const cityNames = new Map<string, string | null>();
  let created = 0, duplicates = 0;
  const failed: { name: string; error: string }[] = [];
  const now = new Date().toISOString();

  for (const dr of rows ?? []) {
    try {
      const { data: existing } = await admin.from("restaurants").select("id").eq("overture_id", dr.external_id).maybeSingle();
      if (existing) {
        await admin.from("discovery_results").update({
          status: "duplicate", matched_restaurant_id: existing.id, reviewed_at: now, reviewed_by: reviewerId,
        }).eq("id", dr.id);
        duplicates++;
        continue;
      }
      if (!cityNames.has(dr.city_id)) {
        const { data: city } = await admin.from("cities").select("name").eq("id", dr.city_id).maybeSingle();
        cityNames.set(dr.city_id, city?.name ?? null);
      }
      const cityName = cityNames.get(dr.city_id) ?? null;
      const geo = await geocodeWithPdok({ address: dr.address, postalCode: dr.postcode, city: cityName })
        .catch((e: unknown) => ({ ok: false as const, reason: `pdok_error: ${bulkErrorMessage(e)}` }));
      const { data: ins, error: insErr } = await admin.from("restaurants")
        .insert(restaurantFromOverture(dr, cityName, geo)).select("id").single();
      if (insErr) throw new Error(insErr.message);
      const { error: hideErr } = await admin.from("restaurants_verborgen")
        .upsert({ id: ins.id, reden: BULK_HIDDEN_REASON, was_active: false }, { onConflict: "id" });
      if (hideErr) throw new Error(`verbergen: ${hideErr.message}`);
      await admin.from("discovery_results").update({
        status: "approved", matched_restaurant_id: ins.id, reviewed_at: now, reviewed_by: reviewerId,
      }).eq("id", dr.id);
      created++;
    } catch (e) {
      // A bad row must not come back in every batch: it moves to "twijfel" (triage review), where
      // it stays pending in the Review Queue for a human, with the error as its reason.
      const msg = bulkErrorMessage(e);
      failed.push({ name: dr.name, error: msg });
      await admin.from("discovery_results")
        .update({ triage: "review", triage_reason: `Bulk aanmaken mislukt: ${msg}`.slice(0, 300) })
        .eq("id", dr.id);
    }
  }

  const { count: remaining } = await admin.from("discovery_results")
    .select("id", { count: "exact", head: true })
    .eq("source", "overture").eq("status", "pending").eq("triage", triage);
  return { triage, created, duplicates, failed, remaining: remaining ?? 0 };
}

async function importDishes(admin: Db, body: { rows?: DishImportRow[] }) {
  const rows = cleanDishRows(Array.isArray(body.rows) ? body.rows.slice(0, 1000) : []);
  if (!rows.length) return { restaurants: 0, missing_restaurants: 0, dishes_created: 0, links_added: 0, links_existing: 0 };

  // overture_id → restaurant
  const restaurantByOverture = new Map<string, string>();
  for (const ids of chunks([...new Set(rows.map((r) => r.overture_id))], 200)) {
    const { data, error } = await admin.from("restaurants").select("id, overture_id").in("overture_id", ids);
    if (error) throw error;
    for (const r of data ?? []) restaurantByOverture.set(r.overture_id, r.id);
  }
  const usable = rows.filter((r) => restaurantByOverture.has(r.overture_id));
  const missing = new Set(rows.filter((r) => !restaurantByOverture.has(r.overture_id)).map((r) => r.overture_id)).size;

  // dish slug → id, creating the missing dishes (never touching existing ones)
  const dishBySlug = new Map<string, string>();
  const slugs = [...new Set(usable.map((r) => r.dish_slug))];
  const loadDishes = async (list: string[]) => {
    for (const part of chunks(list, 200)) {
      const { data, error } = await admin.from("dishes").select("id, slug").in("slug", part);
      if (error) throw error;
      for (const d of data ?? []) dishBySlug.set(d.slug, d.id);
    }
  };
  await loadDishes(slugs);
  const firstBySlug = new Map<string, DishImportRow>();
  for (const r of usable) if (!dishBySlug.has(r.dish_slug) && !firstBySlug.has(r.dish_slug)) firstBySlug.set(r.dish_slug, r);
  let dishesCreated = 0;
  for (const part of chunks([...firstBySlug.values()].map(newDishRecord), 200)) {
    const { data, error } = await admin.from("dishes").upsert(part, { onConflict: "slug", ignoreDuplicates: true }).select("id, slug");
    if (error) throw error;
    dishesCreated += data?.length ?? 0;
    for (const d of data ?? []) dishBySlug.set(d.slug, d.id);
  }
  await loadDishes(slugs.filter((s) => !dishBySlug.has(s)));

  // links that do not exist yet; an existing link keeps its own status and owner edits
  const restaurantIds = [...new Set(usable.map((r) => restaurantByOverture.get(r.overture_id)!))];
  const existing = new Set<string>();
  for (const ids of chunks(restaurantIds, 100)) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("restaurant_dishes").select("restaurant_id, dish_id")
        .in("restaurant_id", ids).range(from, from + 999);
      if (error) throw error;
      for (const l of data ?? []) existing.add(`${l.restaurant_id}|${l.dish_id}`);
      if (!data || data.length < 1000) break;
    }
  }
  const now = new Date().toISOString();
  const links = [];
  let linksExisting = 0;
  for (const r of usable) {
    const rid = restaurantByOverture.get(r.overture_id)!;
    const did = dishBySlug.get(r.dish_slug);
    if (!did) continue;
    const key = `${rid}|${did}`;
    if (existing.has(key)) { linksExisting++; continue; }
    existing.add(key);
    links.push(linkRecord(r, rid, did, now));
  }
  for (const part of chunks(links, 300)) {
    const { error } = await admin.from("restaurant_dishes").insert(part);
    if (error) throw error;
  }
  return {
    restaurants: restaurantIds.length, missing_restaurants: missing, dishes_created: dishesCreated,
    links_added: links.length, links_existing: linksExisting,
  };
}

async function scrapeQueue(admin: Db, body: { limit?: number; exclude?: string[] }) {
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 100);
  // Restaurants the card already tried this run (a scrape that failed before logging a run).
  const exclude = new Set(Array.isArray(body.exclude) ? body.exclude.slice(0, 20000) : []);
  const queue: { id: string; name: string; website_url: string }[] = [];
  let hiddenTotal = 0;
  for (let from = 0; queue.length < limit; from += 500) {
    const { data: hidden, error } = await admin.from("restaurants_verborgen").select("id")
      .eq("reden", BULK_HIDDEN_REASON).order("id").range(from, from + 499);
    if (error) throw error;
    if (!hidden?.length) break;
    hiddenTotal += hidden.length;
    const ids = hidden.map((h: { id: string }) => h.id);
    const { data: scraped } = await admin.from("menu_scrape_runs").select("restaurant_id").in("restaurant_id", ids);
    const done = new Set((scraped ?? []).map((s: { restaurant_id: string }) => s.restaurant_id));
    const todo = ids.filter((id: string) => !done.has(id) && !exclude.has(id));
    if (todo.length) {
      const { data: rests } = await admin.from("restaurants").select("id, name, website_url")
        .in("id", todo).not("website_url", "is", null);
      for (const r of rests ?? []) if (queue.length < limit) queue.push(r);
    }
    if (hidden.length < 500) break;
  }
  return { queue, hidden_seen: hiddenTotal };
}

// One unattended step. pg_cron calls this every minute (x-cron-secret); it does nothing while the
// switch in overture_pipeline is off, so the admin decides when Gemini and Firecrawl may be spent.
async function tick(admin: Db) {
  const { data: cfg } = await admin.from("overture_pipeline").select("enabled, per_tick, include_sterk").eq("id", 1).maybeSingle();
  if (!cfg?.enabled) return { skipped: "uit" };
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  let result: Record<string, unknown>;

  const created = await createBatch(admin, { triage: "verified", limit: 25 }, null);
  if (created.created + created.duplicates + created.failed.length > 0) {
    result = { stap: "aanmaken", ...created };
  } else {
    // 1. Website route first, in one parallel round, so a slow step can never cut scans off.
    //    overture_scrape_queue() skips claimed restaurants and gives back abandoned claims (15 min).
    const perTick = Math.min(Math.max(Number(cfg.per_tick) || 6, 1), 12);
    const { data: queue, error: qErr } = await admin.rpc("overture_scrape_queue", { p_limit: perTick });
    if (qErr) throw new Error(`wachtrij: ${bulkErrorMessage(qErr)}`);
    const due = (queue ?? []) as { id: string; name: string; website_url: string }[];
    if (due.length) {
      const { error: claimErr } = await admin.from("menu_scrape_runs").insert(due.map((r) => ({
        restaurant_id: r.id, status: "bulk_started", source: "overture_bulk", scraped_url: r.website_url,
      })));
      if (claimErr) throw new Error(`claim: ${bulkErrorMessage(claimErr)}`);
    }
    const base = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const call = (fn: string, body: unknown) => fetch(`${base}/functions/v1/${fn}`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json().catch(() => ({}))).catch((e) => ({ error: bulkErrorMessage(e) }));
    const scans = await Promise.all(due.map((r) => call("scrape-menu", { restaurantId: r.id, websiteUrl: r.website_url })));
    const found = scans.reduce((n: number, x: { results?: { added?: number; existing?: number } }) =>
      n + (x?.results?.added ?? 0) + (x?.results?.existing ?? 0), 0);
    const scanErrors = scans.filter((x: { error?: string }) => x?.error).map((x: { error?: string }) => x.error).slice(0, 3);
    if (due.length) await call("dish-screening", { restaurantIds: due.map((r) => r.id), batchSize: 600 });

    // 2. Sterk (own switch) only with time to spare: PDOK geocoding can be slow.
    let sterk = { created: 0, remaining: null as number | null, failed: 0 };
    if (cfg.include_sterk && elapsed() < 60_000) {
      const s = await createBatch(admin, { triage: "approve", limit: 5 }, null);
      sterk = { created: s.created, remaining: s.remaining, failed: s.failed.length };
    }
    result = {
      stap: due.length ? "websiteroute" : (sterk.created ? "sterk aanmaken" : "klaar"),
      gescand: due.length, gerechten: found, ...(scanErrors.length ? { scanfouten: scanErrors } : {}),
      sterk_aangemaakt: sterk.created, sterk_te_gaan: sterk.remaining,
    };
  }

  result.seconden = Math.round(elapsed() / 1000);
  await admin.from("overture_pipeline")
    .update({ last_tick_at: new Date().toISOString(), last_result: result }).eq("id", 1);
  return result;
}
