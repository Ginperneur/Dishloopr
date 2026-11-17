// Hourly: handles what is safe without an admin, leaves the rest (with a note) for the daily mail.
//  1. Owner changes to name/description: a minor name fix and a description that passes the AI text
//     check are applied; anything else stays pending with the reason.
//  2. Paid newsletter placements: title and description pass the AI check -> approved.
//  3. Restaurant suggestions from guests that already exist in that city -> rejected as duplicate.
//  4. Dish suggestions for unclaimed restaurants with confidence >= 0.9 and a real dish name -> approved.
// Every automatic decision is logged in admin_activity_logs (action_type auto_*).
import { isInternalCaller, getCaller, isAdmin } from "../_shared/auth.ts";
import { checkOwnerText, isMinorNameChange, isRealDishName, normName } from "../_shared/textCheck.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

async function log(db: SupabaseClient, action: string, type: string, id: string, name: string | null, details: unknown) {
  await db.from("admin_activity_logs").insert({ user_id: SYSTEM_USER, action_type: action, entity_type: type, entity_id: id, entity_name: name, details });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "") as unknown as SupabaseClient;
  try {
    if (!(await isInternalCaller(req, db))) {
      const user = await getCaller(req);
      if (!user || !(await isAdmin(db, user.id))) return json({ error: "Forbidden" }, 403);
    }
    const summary = { edits_applied: 0, edits_left: 0, placements_approved: 0, placements_left: 0, suggestions_duplicate: 0, dishes_approved: 0 };

    // 1. Owner name/description changes
    const { data: edits } = await db.from("restaurant_pending_edits")
      .select("id, restaurant_id, proposed_changes, restaurants(name)").eq("status", "pending").is("checked_at", null).limit(50);
    for (const e of (edits ?? []) as unknown as { id: string; restaurant_id: string; proposed_changes: Record<string, string>; restaurants: { name: string } | null }[]) {
      const reasons: string[] = [];
      const ch = e.proposed_changes ?? {};
      if (ch.name && !isMinorNameChange(e.restaurants?.name ?? "", ch.name)) reasons.push(`Nieuwe naam wijkt sterk af: "${ch.name}"`);
      if (ch.description_nl) {
        const v = await checkOwnerText("beschrijving", ch.description_nl);
        if (!v.ok) reasons.push(`Beschrijving: ${v.reason}`);
      }
      if (reasons.length === 0) {
        const { error } = await db.rpc("apply_pending_edit", { p_id: e.id, p_decision: "auto_applied", p_note: "Automatisch gecontroleerd en doorgevoerd" });
        if (!error) { summary.edits_applied++; await log(db, "auto_edit_applied", "restaurant", e.restaurant_id, e.restaurants?.name ?? null, ch); continue; }
        reasons.push(`Doorvoeren mislukt: ${error.message}`);
      }
      await db.from("restaurant_pending_edits").update({ checked_at: new Date().toISOString(), review_notes: reasons.join(" | ").slice(0, 1000) }).eq("id", e.id);
      summary.edits_left++;
    }

    // 2. Paid newsletter placements
    const { data: placements } = await db.from("newsletter_placements")
      .select("id, restaurant_id, title, description").eq("status", "paid").is("checked_at", null).limit(50);
    for (const p of (placements ?? []) as { id: string; restaurant_id: string; title: string; description: string | null }[]) {
      const v = await checkOwnerText("nieuwsbriefplaatsing", [p.title, p.description].filter(Boolean).join("\n\n"));
      if (v.ok) {
        await db.from("newsletter_placements").update({ status: "approved", checked_at: new Date().toISOString(), admin_notes: "Automatisch goedgekeurd" }).eq("id", p.id);
        await log(db, "auto_placement_approved", "newsletter_placement", p.id, p.title, { restaurant_id: p.restaurant_id });
        summary.placements_approved++;
      } else {
        await db.from("newsletter_placements").update({ checked_at: new Date().toISOString(), admin_notes: `AI: ${v.reason}` }).eq("id", p.id);
        summary.placements_left++;
      }
    }

    // 3. Duplicate restaurant suggestions
    const { data: sugg } = await db.from("restaurant_suggestions").select("id, name, city").eq("status", "pending").limit(100);
    for (const s of (sugg ?? []) as { id: string; name: string; city: string | null }[]) {
      if (!s.city) continue;
      const { data: city } = await db.from("cities").select("id").ilike("name", s.city.trim()).maybeSingle();
      if (!city) continue;
      const { data: same } = await db.from("restaurants").select("id, slug, name").eq("city_id", city.id).ilike("name", `%${s.name.trim().slice(0, 60)}%`).limit(10);
      const hit = (same ?? []).find((r: { name: string }) => normName(r.name) === normName(s.name));
      if (hit) {
        await db.from("restaurant_suggestions").update({ status: "rejected", admin_notes: `Bestaat al: /restaurant/${hit.slug}`, reviewed_at: new Date().toISOString() }).eq("id", s.id);
        await log(db, "auto_suggestion_duplicate", "restaurant_suggestion", s.id, s.name, { existing: hit.slug });
        summary.suggestions_duplicate++;
      }
    }

    // 4. High-confidence dish suggestions for unclaimed restaurants
    const { data: dishes } = await db.from("restaurant_dishes")
      .select("id, confidence_score, dish:dishes!inner(name, is_active), restaurant:restaurants!inner(claimed_by_owner_id)")
      .eq("status", "suggested").gte("confidence_score", 0.9).is("restaurant.claimed_by_owner_id", null).eq("dish.is_active", true).limit(500);
    const ok = ((dishes ?? []) as unknown as { id: string; dish: { name: string } }[]).filter(d => isRealDishName(d.dish.name)).map(d => d.id);
    if (ok.length) {
      const { error } = await db.from("restaurant_dishes").update({ status: "approved_by_admin" }).in("id", ok);
      if (!error) { summary.dishes_approved = ok.length; await log(db, "auto_dishes_approved", "restaurant_dishes", ok[0], null, { count: ok.length }); }
    }

    return json(summary);
  } catch (e) {
    console.error("admin-automation", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
