// Billing details shared by every Stripe Checkout session: restaurants are businesses, so
// they need a billing address and can add a VAT number, and one-time payments need an
// invoice (subscriptions get one from Stripe by themselves).
//
// STRIPE_AUTOMATIC_TAX=true switches on Stripe Tax. Leave it off until the VAT registration
// is set up in the Stripe Dashboard (Settings, Tax), because Checkout refuses to start
// when Stripe Tax is requested without it.
export function billingParams(opts: {
  mode: "subscription" | "payment";
  customerId?: string;
  description?: string;
}) {
  const { mode, customerId, description } = opts;
  const automaticTax = Deno.env.get("STRIPE_AUTOMATIC_TAX") === "true";

  return {
    billing_address_collection: "required" as const,
    tax_id_collection: { enabled: true },
    // An existing customer must allow Checkout to save the name and address it collects.
    ...(customerId ? { customer_update: { name: "auto" as const, address: "auto" as const } } : {}),
    // One-time payments only create a customer, and so an invoice, when asked to.
    ...(mode === "payment" && !customerId ? { customer_creation: "always" as const } : {}),
    ...(mode === "payment"
      ? { invoice_creation: { enabled: true, invoice_data: { description: description?.slice(0, 500) } } }
      : {}),
    ...(automaticTax ? { automatic_tax: { enabled: true } } : {}),
  };
}
