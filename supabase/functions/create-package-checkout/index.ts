import { safeOrigin, serviceClient, getCaller, isAdmin } from "../_shared/auth.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { billingParams } from "../_shared/billing.ts";
import { withVat } from "../_shared/vat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Uitgelicht is charged at checkout, like Menuservice "once": the spot goes live right away,
// so billing starts right away and the minimum term counts from the purchase date.
// A page sells 1 Topplek and 3 Uitgelicht places (Founding Partners keep older extra places).
const FOUNDING_PLACES_PER_PAGE = 3;
// Bundles cost the place plus a fixed surcharge: Groei = Uitgelicht + 20 euro (Pro and one event
// included, 119 euro at the 99 euro list price, 79 euro for Founding Partners), Dominant = Topplek
// + 50 euro (Pro, one event, one newsletter placement a month and Vraag doorsturen included).
const BUNDLE_SURCHARGE_CENTS = { groei: 2000, dominant: 5000 } as const;

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
  package: "founding_partner" | "menu_service" | "topplek" | "groei" | "dominant";
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
  topplek_month: { package: "topplek", plan: "month", cents: 19900, interval: "month", name: "Topplek (per maand)", priceEnv: "" },
  groei_month: { package: "groei", plan: "month", cents: 7900, normalCents: 11900, interval: "month", name: "Groei (per maand)", priceEnv: "" },
  dominant_month: { package: "dominant", plan: "month", cents: 24900, interval: "month", name: "Dominant (per maand)", priceEnv: "" },
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

    // Every package but Menuservice is a paid place on one page.
    const placePackage = option.package !== "menu_service";
    const kind: "uitgelicht" | "topplek" = option.package === "topplek" || option.package === "dominant" ? "topplek" : "uitgelicht";
    const isFoundingDeal = (option.package === "founding_partner" || option.package === "groei") && foundingWindowOpen();
    let pageSlug: string | null = null;
    if (placePackage) {
      if (typeof page_slug !== "string" || !page_slug) return json({ error: "Kies een pagina" }, 400);
      // Only a restaurant that is on the page (the dish on its menu, the cuisine, the label) may buy.
      const { data: onPage } = await admin.rpc("uitgelicht_on_page", { p_restaurant: restaurant.id, p_page_slug: page_slug });
      if (onPage !== true) return json({ error: "Je restaurant staat niet op deze pagina" }, 400);
      // Only on pages Dishloopr chose, with at least 10 restaurants.
      const { data: eligible } = await admin.rpc("uitgelicht_page_eligible", { p_page_slug: page_slug });
      if (eligible !== true) return json({ error: "Op deze pagina zijn geen betaalde plekken te koop" }, 400);
      const { count } = await admin.from("package_orders").select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id).eq("page_slug", page_slug).neq("package", "menu_service")
        .in("status", ["active", "trialing", "past_due"]);
      if (count) return json({ error: "Je hebt al een betaalde plek op deze pagina" }, 409);
      if (isFoundingDeal) {
        const { data: left } = await admin.rpc("founding_places_left", { p_page_slug: page_slug });
        if (typeof left === "number" && left <= 0) {
          return json({ error: `Alle ${FOUNDING_PLACES_PER_PAGE} plekken voor Uitgelicht op deze pagina zijn vergeven` }, 409);
        }
      }
      pageSlug = page_slug;
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    // Outside the Founding Partner deal a place is monthly and priced per page by demand
    // (pp_reserve): a won bid at its clearing price, or a free place at the list price.
    let dynamicCents: number | null = null;
    let bidId: string | null = null;
    if (placePackage && !isFoundingDeal) {
      if (option.plan !== "month") return json({ error: "Betaalde plekken zijn per maand" }, 400);
      const { data: reserved, error: resErr } = await admin.rpc("pp_reserve", { p_kind: kind, p_page_slug: pageSlug, p_restaurant: restaurant.id });
      if (resErr) return json({ error: resErr.message }, 409);
      const placeCents = (reserved as { price_cents: number }).price_cents;
      bidId = (reserved as { bid_id: string | null }).bid_id;
      dynamicCents = placeCents + (option.package === "groei" || option.package === "dominant" ? BUNDLE_SURCHARGE_CENTS[option.package] : 0);
    }
    const effectiveCents = dynamicCents ?? option.cents;

    // The STRIPE_FOUNDING_* price ids hold the €59/€590 promo price, so they may only be used
    // inside the window; after it, a normal-price id (or the inline normal price) applies.
    // A dynamic price is always created inline; Stripe price ids only for the fixed prices.
    const priceId = dynamicCents !== null || !option.priceEnv ? undefined : Deno.env.get(option.priceEnv);
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
      ...(bidId ? { bid_id: bidId } : {}),
      ...(option.package === "founding_partner" || option.package === "groei"
        ? { founding_partner: String(isFoundingDeal), ...(isFoundingDeal ? { discount_until: FOUNDING_DISCOUNT_UNTIL } : {}) }
        : {}),
    };

    const origin = safeOrigin(req);
    const session = await stripe.checkout.sessions.create(await withVat(stripe, {
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
    }));

    return json({ url: session.url });
  } catch (e) {
    console.error("create-package-checkout error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
