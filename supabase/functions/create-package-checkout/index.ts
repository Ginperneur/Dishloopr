import { safeOrigin, serviceClient, getCaller, isAdmin } from "../_shared/auth.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { billingParams } from "../_shared/billing.ts";
import { withVat } from "../_shared/vat.ts";
import { getOrCreateCustomer } from "../_shared/stripeCustomer.ts";
import { FOUNDING_MIN_MONTHS, TERM_MONTHS } from "../_shared/launch.ts";

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
  package: "founding_partner" | "menu_service" | "topplek" | "groei" | "dominant" | "collectieplek";
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
  // A place in a collection (one city or the whole country); prices per page in pp_list_price / collection_founding_price.
  collectie_month: { package: "collectieplek", plan: "month", cents: 4900, interval: "month", name: "Collectieplek (per maand)", priceEnv: "" },
  menu_once: { package: "menu_service", plan: "once", cents: 7900, name: "Menuservice (eenmalig)", priceEnv: "STRIPE_MENU_ONCE_PRICE_ID" },
  menu_month: { package: "menu_service", plan: "month", cents: 1900, interval: "month", name: "Menuservice (per maand)", priceEnv: "STRIPE_MENU_MONTH_PRICE_ID" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const user = await getCaller(req);
    if (!user?.email) return json({ error: "Log eerst in" }, 401);

    const { option: optionKey, restaurant_id, page_slug, months: monthsIn } = await req.json().catch(() => ({}));
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
    const kind: "uitgelicht" | "topplek" | "collectie" = option.package === "topplek" || option.package === "dominant" ? "topplek"
      : option.package === "collectieplek" ? "collectie" : "uitgelicht";
    // The owner picks a term before paying. The Founding Partner price and status need at least
    // 6 months (a year plan is 12); a shorter term pays the normal price of the page and is no
    // Founding Partner. Older clients send no term and were always on the 6-month deal.
    const foundingPackage = option.package === "founding_partner" || option.package === "groei" || option.package === "collectieplek";
    const months = option.plan === "year" ? 12 : monthsIn === undefined || monthsIn === null ? (foundingPackage ? FOUNDING_MIN_MONTHS : 1) : Number(monthsIn);
    if (!(TERM_MONTHS as readonly number[]).includes(months)) return json({ error: "Kies een looptijd van 1, 3, 6 of 12 maanden" }, 400);
    const isFoundingDeal = foundingPackage && foundingWindowOpen() && months >= FOUNDING_MIN_MONTHS;
    let pageSlug: string | null = null;
    if (placePackage) {
      if (typeof page_slug !== "string" || !page_slug) return json({ error: "Kies een pagina" }, 400);
      // Only a restaurant that is on the page (the dish on its menu, the cuisine, the label; for a
      // collection: it matches the collection and has a photo) may buy.
      const { data: onPage } = await admin.rpc("pp_on_page", { p_kind: kind, p_restaurant: restaurant.id, p_page_slug: page_slug });
      if (onPage !== true) return json({ error: "Je restaurant staat niet op deze pagina" }, 400);
      // Only on pages Dishloopr chose, with at least 10 restaurants.
      const { data: eligible } = await admin.rpc("pp_page_eligible", { p_kind: kind, p_page_slug: page_slug });
      if (eligible !== true) return json({ error: "Op deze pagina zijn geen betaalde plekken te koop" }, 400);
      const { count } = await admin.from("package_orders").select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id).eq("page_slug", page_slug).neq("package", "menu_service")
        .in("status", ["active", "trialing", "past_due"]);
      if (count) return json({ error: "Je hebt al een betaalde plek op deze pagina" }, 409);
      pageSlug = page_slug;
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customerId = await getOrCreateCustomer(stripe, admin, user);

    // The place is held while the owner pays (pp_hold, under a lock per page), so two owners can
    // never both pay for the last place. Outside the Founding Partner deal a place is monthly and
    // priced per page by demand: a won bid at its clearing price, or a free place at the list price.
    let dynamicCents: number | null = null;
    let bidId: string | null = null;
    let holdId: string | null = null;
    let replacedSessions: string[] = [];
    if (placePackage) {
      if (!isFoundingDeal && option.plan !== "month") return json({ error: "Betaalde plekken zijn per maand" }, 400);
      // Outside the Founding Partner deal a term only exists for the two packages that offer it.
      if (!foundingPackage && months !== 1) return json({ error: "Dit pakket is per maand opzegbaar" }, 400);
      const { data: held, error: holdErr } = await admin.rpc("pp_hold", {
        p_kind: kind, p_page_slug: pageSlug, p_restaurant: restaurant.id, p_user: user.id, p_founding: isFoundingDeal,
      });
      if (holdErr) {
        // P0001 carries a message meant for the owner (place taken, bid first, already yours).
        const forOwner = (holdErr as { code?: string }).code === "P0001";
        if (!forOwner) console.error("pp_hold", holdErr);
        return json({ error: forOwner ? holdErr.message : "Deze plek kon niet worden vastgehouden. Probeer het opnieuw." }, 409);
      }
      const h = held as { price_cents: number | null; bid_id: string | null; hold_id: string; replaced_sessions: string[] };
      holdId = h.hold_id;
      bidId = h.bid_id;
      replacedSessions = h.replaced_sessions ?? [];
      if (!isFoundingDeal && typeof h.price_cents === "number") {
        dynamicCents = h.price_cents + (option.package === "groei" || option.package === "dominant" ? BUNDLE_SURCHARGE_CENTS[option.package] : 0);
      }
    }
    // A Founding Partner collection place costs 29 euro in a city and 89 euro nationally.
    let foundingCents: number | null = null;
    if (option.package === "collectieplek" && isFoundingDeal) {
      const { data: fp } = await admin.rpc("collection_founding_price", { p_page_slug: pageSlug });
      foundingCents = typeof fp === "number" ? fp : null;
    }
    const effectiveCents = dynamicCents ?? foundingCents ?? option.cents;
    // The owner sees on the Stripe page and the invoice which page the place is on.
    // The term is part of the name, so it shows on the Stripe page and the invoice.
    let productName = option.interval === "month" && placePackage && months > 1
      ? option.name.replace("(per maand)", `(per maand, minimaal ${months} maanden)`) : option.name;
    if (pageSlug) {
      let pageName: string | undefined;
      if (kind === "collectie") {
        const { data: cp } = await admin.rpc("collection_page", { p_page_slug: pageSlug });
        const c = (cp as { title: string; city_name: string | null; is_national: boolean }[] | null)?.[0];
        pageName = c ? `${c.title} ${c.is_national ? "in heel Nederland" : `in ${c.city_name}`}` : undefined;
      } else {
        const { data: page } = await admin.from("seo_landing_pages").select("h1_title").eq("slug", pageSlug).maybeSingle();
        pageName = page?.h1_title as string | undefined;
      }
      productName = `${productName}: ${pageName ?? pageSlug}`.slice(0, 250);
    }

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
            product_data: { name: productName },
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
      ...(holdId ? { hold_id: holdId } : {}),
      ...(option.interval === "month" && placePackage ? { commitment_months: String(months) } : {}),
      ...(foundingPackage
        ? { founding_partner: String(isFoundingDeal), ...(isFoundingDeal ? { discount_until: FOUNDING_DISCOUNT_UNTIL } : {}) }
        : {}),
    };

    const origin = safeOrigin(req);
    const session = await stripe.checkout.sessions.create(await withVat(stripe, {
      customer: customerId,
      line_items: [lineItem],
      mode: option.interval ? "subscription" : "payment",
      // Ends before the hold (35 minutes), so a payment can never land on a released place.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      ...billingParams({
        mode: option.interval ? "subscription" : "payment",
        customerId,
        description: `${productName}: ${restaurant.name}`,
      }),
      metadata,
      ...(option.interval
        ? { subscription_data: { metadata, description: `${productName}: ${restaurant.name}`.slice(0, 500) } }
        : { payment_intent_data: { metadata, description: `${option.name}: ${restaurant.name}`.slice(0, 500) } }),
      success_url: `${origin}/owner-dashboard?package_checkout=success`,
      cancel_url: `${origin}/voor-restaurants/pakketten?slug=${encodeURIComponent(restaurant.slug)}`,
    }));

    if (holdId) {
      await admin.from("package_checkout_holds").update({ stripe_session_id: session.id }).eq("id", holdId);
    }
    // An earlier, unpaid checkout of the same restaurant for this page can no longer be paid.
    for (const old of replacedSessions) {
      await stripe.checkout.sessions.expire(old).catch(() => {});
    }

    return json({ url: session.url });
  } catch (e) {
    console.error("create-package-checkout error:", e);
    return json({ error: "Afrekenen lukte niet. Probeer het later opnieuw." }, 500);
  }
});
