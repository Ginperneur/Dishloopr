import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type InvoiceItem = {
  id: string;
  date: number; // unix seconds
  amount: number; // EUR major units
  currency: string;
  status: string;
  description: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  source_type: string;
  restaurant_id: string | null;
};

function classify(meta: Record<string, string> | null | undefined): string {
  const t = meta?.type || "";
  if (t === "newsletter_placement") return "newsletter";
  if (t === "featured_subscription") return "featured";
  if (t === "sponsored_dish") return "sponsored";
  if (t === "micro_payment_verification") return "verification";
  if (t === "extra_tag") return "tag";
  if (meta?.listingType) return "listing";
  return "other";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabaseClient.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Owned restaurants
    const { data: restaurants, error: rErr } = await supabaseAdmin
      .from("restaurants")
      .select("id, name")
      .eq("claimed_by_owner_id", user.id);

    if (rErr) throw rErr;
    const restaurantIds = (restaurants || []).map(r => r.id);
    const restaurantNames: Record<string, string> = {};
    (restaurants || []).forEach(r => { restaurantNames[r.id] = r.name; });

    if (restaurantIds.length === 0) {
      return new Response(JSON.stringify({ invoices: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stripe customer IDs from featured_subscriptions
    const { data: subs } = await supabaseAdmin
      .from("featured_subscriptions")
      .select("stripe_customer_id")
      .in("restaurant_id", restaurantIds)
      .not("stripe_customer_id", "is", null);

    const customerIds = Array.from(new Set((subs || []).map(s => s.stripe_customer_id).filter(Boolean) as string[]));

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const invoices: InvoiceItem[] = [];
    const seen = new Set<string>();

    // 1) Subscription invoices per customer
    for (const customerId of customerIds) {
      try {
        const list = await stripe.invoices.list({ customer: customerId, limit: 100 });
        for (const inv of list.data) {
          const meta = (inv.metadata || {}) as Record<string, string>;
          const restId = meta.restaurantId || meta.restaurant_id || null;
          if (restId && !restaurantIds.includes(restId)) continue;
          if (seen.has(inv.id)) continue;
          seen.add(inv.id);
          invoices.push({
            id: inv.id,
            date: inv.created,
            amount: (inv.amount_paid || inv.amount_due || 0) / 100,
            currency: inv.currency?.toUpperCase() || "EUR",
            status: inv.status || "unknown",
            description: inv.description || inv.lines?.data?.[0]?.description || "Stripe factuur",
            hosted_invoice_url: inv.hosted_invoice_url || null,
            invoice_pdf: inv.invoice_pdf || null,
            source_type: classify(meta),
            restaurant_id: restId,
          });
        }
      } catch (e) {
        console.error("invoices.list error:", e);
      }
    }

    // 2) One-off checkout sessions — search by restaurantId metadata
    for (const restId of restaurantIds) {
      try {
        const found = await stripe.checkout.sessions.search({
          query: `metadata['restaurantId']:'${restId}' AND status:'complete'`,
          limit: 100,
        });
        for (const session of found.data) {
          if (!session.id || seen.has(session.id)) continue;
          // Skip subscription sessions (already covered by invoices)
          if (session.mode === "subscription") continue;
          seen.add(session.id);
          const meta = (session.metadata || {}) as Record<string, string>;
          let pdfUrl: string | null = null;
          let hostedUrl: string | null = null;
          // Try to get receipt URL via PaymentIntent → latest_charge
          try {
            if (session.payment_intent && typeof session.payment_intent === "string") {
              const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
              if (pi.latest_charge && typeof pi.latest_charge === "string") {
                const charge = await stripe.charges.retrieve(pi.latest_charge);
                hostedUrl = charge.receipt_url || null;
              }
            }
          } catch (_) { /* ignore */ }

          invoices.push({
            id: session.id,
            date: session.created,
            amount: (session.amount_total || 0) / 100,
            currency: (session.currency || "eur").toUpperCase(),
            status: session.payment_status || "complete",
            description: meta.type
              ? meta.type.replace(/_/g, " ")
              : "Eenmalige betaling",
            hosted_invoice_url: hostedUrl,
            invoice_pdf: pdfUrl,
            source_type: classify(meta),
            restaurant_id: restId,
          });
        }
      } catch (e) {
        console.error("checkout.sessions.search error:", e);
      }
    }

    invoices.sort((a, b) => b.date - a.date);

    return new Response(
      JSON.stringify({ invoices, restaurants: restaurantNames }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("list-owner-invoices error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});