import { safeOrigin, serviceClient, getCaller, isAdmin } from "../_shared/auth.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { billingParams } from "../_shared/billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Uitgelicht is charged at checkout, like Menuservice "once": the spot goes live right away,
// so billing starts right away and the minimum term counts from the purchase date.
const FOUNDING_PLACES_PER_PAGE = 5;

// Founding Partner promo: anyone who buys Uitgelicht from now (sales open before
// the 1 dec 2026 soft launch) through this date keeps the discounted price AND the Founding
// Partner badge (forever, even if they later stop paying). After this date,
// Uitgelicht is still for sale, just at the normal price and without the
// Founding Partner status. The discounted price itself is only guaranteed
// through 31 dec 2027 (communicated on the packages page); moving existing
// Founding Partners to the normal price on 1 jan 2028 is a separate, not yet
// built step (needs a Stripe subscription schedule or a one-off job); the
// `discount_until` metadata below exists so that job has something to key off.
const FOUNDING_WINDOW_END = "2027-01-05"; // laatste dag van de actie (Amsterdam-tijd)
const FOUNDING_DISCOUNT_UNTIL = "2027-12-31"; // laatste dag van de voordeelprijs voor wie 'm al heeft

function foundingWindowOpen(): boolean {
  const probe = new Date(`${FOUNDING_WINDOW_END}T12:00:00Z`);
  const offsetHours = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hour12: false }).format(probe)) - 12;
  const endMs = Date.parse(`${FOUNDING_WINDOW_END}T23:59:59Z`) - offsetHours * 3600_000;
  return Date.now() <= endMs;
}

type Option = {
  package: "founding_partner" | "menu_service";
  plan: "month" | "year" | "once";
  cents: number;
  normalCents?: number; // prijs buiten het Founding Partner-venster (alleen voor het Uitgelicht-pakket)
  normalPriceEnv?: string; // optionele vaste Stripe-prijs voor die normale prijs
  interval?: "month" | "year";
  name: string;
  priceEnv: string;
};

// A STRIPE_*_PRICE_ID secret wins when set; otherwise the price is created inline,
// so checkout works with only STRIPE_SECRET_KEY configured.
const OPTIONS: Record<string, Option> = {
  founding_month: { package: "founding_partner", plan: "month", cents: 5900, normalCents: 9900, interval: "month", name: "Uitgelicht (per maand)", priceEnv: "STRIPE_FOUNDING_MONTH_PRICE_ID", normalPriceEnv: "STRIPE_UITGELICHT_MONTH_PRICE_ID" },
  founding_year: { package: "founding_partner", plan: "year", cents: 59000, normalCents: 99000, interval: "year", name: "Uitgelicht (per jaar)", priceEnv: "STRIPE_FOUNDING_YEAR_PRICE_ID", normalPriceEnv: "STRIPE_UITGELICHT_YEAR_PRICE_ID" },
  menu_once: { package: "menu_service", plan: "once", cents: 7900, name: "Menuservice (eenmalig)", priceEnv: "STRIPE_MENU_ONCE_PRICE_ID" },
  menu_month: { package: "menu_service", plan: "month", cents: 1900, interval: "month", name: "Menuservice (per maand)", priceEnv: "STRIPE_MENU_MONTH_PRICE_ID" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const user = await getCaller(req);
    if (!user?.email) return json({ error: "Log eerst in" }, 401);

    const { option: optionKey, restaurant_id, page_slug } = await req.json().catch(() => ({}));
    const option = OPTIONS[optionKey as string];
    if (!option) return json({ error: "Onbekend pakket" }, 400);
    if (typeof restaurant_id !== "string") return json({ error: "Ontbrekend restaurant" }, 400);

    const admin = serviceClient();
    const { data: restaurant } = await admin
      .from("restaurants").select("id, name, slug").eq("id", restaurant_id).eq("is_active", true).maybeSingle();
    if (!restaurant) return json({ error: "Restaurant niet gevonden" }, 404);

    const { data: verified } = await admin.rpc("is_verified_owner", { _user_id: user.id, _restaurant_id: restaurant.id });
    if (verified !== true && !(await isAdmin(admin, user.id))) {
      return json({ error: "Claim eerst je restaurant. Na goedkeuring kun je dit pakket afnemen." }, 403);
    }

    let pageSlug: string | null = null;
    if (option.package === "founding_partner") {
      if (typeof page_slug !== "string" || !page_slug) return json({ error: "Kies een gerechtpagina" }, 400);
      const { data: pages } = await admin.rpc("restaurant_positions", { p_slug: restaurant.slug });
      if (!(pages ?? []).some((p: { page_slug: string }) => p.page_slug === page_slug)) {
        return json({ error: "Je restaurant staat niet op deze gerechtpagina" }, 400);
      }
      const { data: left } = await admin.rpc("founding_places_left", { p_page_slug: page_slug });
      if (typeof left === "number" && left <= 0) {
        return json({ error: `Alle ${FOUNDING_PLACES_PER_PAGE} plekken voor Uitgelicht op deze pagina zijn vergeven` }, 409);
      }
      const { count } = await admin.from("package_orders").select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id).eq("package", "founding_partner").eq("page_slug", page_slug)
        .in("status", ["active", "trialing", "past_due"]);
      if (count) return json({ error: "Je staat al Uitgelicht op deze pagina" }, 409);
      pageSlug = page_slug;
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    // Founding Partner-korting geldt alleen voor het Uitgelicht-pakket, en alleen
    // tijdens het actievenster; Menuservice heeft geen normalCents en gebruikt
    // dus altijd option.cents.
    const isFoundingDeal = option.package === "founding_partner" && foundingWindowOpen();
    const effectiveCents = option.package === "founding_partner" && !isFoundingDeal && option.normalCents
      ? option.normalCents
      : option.cents;

    // The STRIPE_FOUNDING_* price ids hold the €59/€590 promo price, so they may only be used
    // inside the window; after it, a normal-price id (or the inline normal price) applies.
    const usesNormalPrice = option.package === "founding_partner" && !isFoundingDeal;
    const priceId = usesNormalPrice
      ? (option.normalPriceEnv ? Deno.env.get(option.normalPriceEnv) : undefined)
      : Deno.env.get(option.priceEnv);
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: effectiveCents,
            tax_behavior: "exclusive" as const,
            product_data: { name: option.name },
            ...(option.interval ? { recurring: { interval: option.interval } } : {}),
          },
        };

    const metadata: Record<string, string> = {
      type: option.package,
      plan: option.plan,
      restaurant_id: restaurant.id,
      user_id: user.id,
      amount_cents: String(effectiveCents),
      ...(pageSlug ? { page_slug: pageSlug } : {}),
      ...(option.package === "founding_partner"
        ? { founding_partner: String(isFoundingDeal), ...(isFoundingDeal ? { discount_until: FOUNDING_DISCOUNT_UNTIL } : {}) }
        : {}),
    };

    const origin = safeOrigin(req);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [lineItem],
      mode: option.interval ? "subscription" : "payment",
      ...billingParams({
        mode: option.interval ? "subscription" : "payment",
        customerId,
        description: `${option.name}: ${restaurant.name}`,
      }),
      metadata,
      ...(option.interval
        ? { subscription_data: { metadata, description: `${option.name}: ${restaurant.name}`.slice(0, 500) } }
        : { payment_intent_data: { metadata, description: `${option.name}: ${restaurant.name}`.slice(0, 500) } }),
      success_url: `${origin}/owner-dashboard?package_checkout=success`,
      cancel_url: `${origin}/voor-restaurants/pakketten?slug=${encodeURIComponent(restaurant.slug)}`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error("create-package-checkout error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
