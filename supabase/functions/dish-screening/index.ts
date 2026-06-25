import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { screenDish } from "./dish-screening.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(Number(body.batchSize) || 200, 1), 1000);

    // Build trusted vocab
    const vocab = new Set<string>();
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("dishes")
        .select("canonical_slug")
        .not("canonical_slug", "is", null)
        .range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) if (r.canonical_slug) vocab.add(r.canonical_slug);
      if (data.length < 1000) break;
      from += 1000;
    }

    // Fetch links to screen
    const { data: links, error: linksErr } = await supabase
      .from("restaurant_dishes")
      .select("id, dish_id, status, dish:dishes(id, name, slug, canonical_slug, course)")
      .in("status", ["suggested", "needs_review"])
      .limit(batchSize);
    if (linksErr) throw linksErr;

    let approved = 0, rejected = 0, review = 0, skipped = 0;
    const nowIso = new Date().toISOString();

    for (const link of links || []) {
      const dish: any = (link as any).dish;
      if (!dish?.slug || !dish?.name) { skipped++; continue; }

      const result = screenDish(dish.slug, dish.name, vocab);

      if (result.decision === "approve") {
        // Fill dishes.canonical_slug + course where empty
        const patch: Record<string, unknown> = {};
        if (!dish.canonical_slug && result.canonicalSlug) patch.canonical_slug = result.canonicalSlug;
        if (!dish.course && result.course) patch.course = result.course;
        if (Object.keys(patch).length > 0) {
          await supabase.from("dishes").update(patch).eq("id", dish.id);
        }
        await supabase.from("restaurant_dishes").update({
          status: "approved_by_admin",
          approved_at: nowIso,
          screen_score: result.score,
          screen_canonical: result.canonicalSlug,
          screen_course: result.course,
          screen_reason: result.reason,
        }).eq("id", link.id);
        approved++;
      } else if (result.decision === "reject") {
        await supabase.from("restaurant_dishes").update({
          status: "rejected",
          screen_score: result.score,
          screen_reason: result.reason,
        }).eq("id", link.id);
        rejected++;
      } else {
        await supabase.from("restaurant_dishes").update({
          status: "needs_review",
          screen_score: result.score,
          screen_canonical: result.canonicalSlug,
          screen_course: result.course,
          screen_reason: result.reason,
        }).eq("id", link.id);
        review++;
      }
    }

    return new Response(
      JSON.stringify({ processed: links?.length || 0, approved, rejected, review, skipped, vocab_size: vocab.size }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("dish-screening error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});