import Stripe from "https://esm.sh/stripe@18.5.0";
import { requireAdminOrInternal, serviceClient } from "../_shared/auth.ts";
import { commitmentEnd, launchAt } from "../_shared/launch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Stripe only accepts a trial end that is still in the future.
const MIN_AHEAD_MS = 5 * 60 * 1000;

interface Body {
  /** Report what would change without touching Stripe. */
  dry_run?: boolean;
  /** The launch is off: cancel every Founding Partner that has not paid yet. */
  cancel_unpaid?: boolean;
}

// Keeps Founding Partner trials on the launch date in app_settings, so nobody pays
// before the launch. Runs daily from pg_cron and right after an admin edits the date.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = serviceClient();
    const deny = await requireAdminOrInternal(req, admin, corsHeaders);
    if (deny) return deny;

    const body: Body = await req.json().catch(() => ({}));
    const launch = await launchAt(admin);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const { data: orders, error } = await admin.from("package_orders")
      .select("id, plan, stripe_subscription_id")
      .eq("package", "founding_partner").eq("status", "trialing")
      .not("stripe_subscription_id", "is", null);
    if (error) throw error;

    let moved = 0, unchanged = 0, cancelled = 0, skipped = 0, failed = 0;
    for (const order of orders ?? []) {
      try {
        const sub = await stripe.subscriptions.retrieve(order.stripe_subscription_id!);
        if (sub.status !== "trialing") { skipped++; continue; }

        if (body.cancel_unpaid) {
          if (!body.dry_run) {
            await stripe.subscriptions.cancel(sub.id);
            await admin.from("package_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", order.id);
          }
          cancelled++;
          continue;
        }

        const target = Math.floor(launch.ms / 1000);
        if (sub.trial_end === target) { unchanged++; continue; }
        // Launch already passed (or nearly): the trial ends on its own, nothing to move.
        if (launch.ms - Date.now() < MIN_AHEAD_MS) { skipped++; continue; }

        if (!body.dry_run) {
          await stripe.subscriptions.update(sub.id, { trial_end: target, proration_behavior: "none" });
          await admin.from("package_orders").update({
            commitment_until: order.plan === "month" ? commitmentEnd(launch.ms) : null,
            updated_at: new Date().toISOString(),
          }).eq("id", order.id);
        }
        moved++;
      } catch (e) {
        console.error("sync-launch-date: order failed", order.id, e);
        failed++;
      }
    }

    return json({ launch_date: launch.date, dry_run: !!body.dry_run, trialing: orders?.length ?? 0, moved, unchanged, cancelled, skipped, failed });
  } catch (err) {
    console.error("sync-launch-date error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
