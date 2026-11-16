// An owner changes the restaurant address. We look it up in the official Dutch address register
// (PDOK Locatieserver, BAG). If it exists, matches what was typed, lies in the restaurant's city and
// moves the pin at most 10 km, it is applied at once (address with postcode, and coordinates) and
// logged for admins. Otherwise it goes to Admin as a contact message with the register's suggestion.
import { getCaller } from "../_shared/auth.ts";
import { decideAddress, type PdokDoc } from "../_shared/addressCheck.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function lookup(q: string): Promise<PdokDoc | null> {
  const url = new URL("https://api.pdok.nl/bzk/locatieserver/search/v3_1/free");
  url.searchParams.set("q", q);
  url.searchParams.set("fq", "type:adres");
  url.searchParams.set("rows", "1");
  url.searchParams.set("fl", "weergavenaam,straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam,gemeentenaam,centroide_ll");
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const body = await res.json();
  return (body?.response?.docs?.[0] as PdokDoc | undefined) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getCaller(req);
    if (!user?.email) return json({ error: "Log opnieuw in" }, 401);
    const { restaurant_id, address } = await req.json().catch(() => ({}));
    const typed = typeof address === "string" ? address.trim().slice(0, 200) : "";
    if (typeof restaurant_id !== "string" || !/^[0-9a-f-]{36}$/i.test(restaurant_id)) return json({ error: "Ongeldig restaurant" }, 400);
    if (typed.length < 6) return json({ error: "Vul straat, huisnummer en plaats in" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const [{ data: owns }, { data: isAdmin }] = await Promise.all([
      db.rpc("is_verified_owner", { _user_id: user.id, _restaurant_id: restaurant_id }),
      db.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);
    if (owns !== true && isAdmin !== true) return json({ error: "Alleen de geverifieerde eigenaar kan het adres wijzigen" }, 403);

    const { data: r } = await db.from("restaurants").select("id, name, address, city_id, geo_lat, geo_lng").eq("id", restaurant_id).single();
    if (!r) return json({ error: "Restaurant niet gevonden" }, 404);
    const [{ data: city }, { data: aliases }] = await Promise.all([
      db.from("cities").select("name").eq("id", r.city_id).maybeSingle(),
      db.from("city_aliases").select("alias_name").eq("city_id", r.city_id),
    ]);
    const cityNames = [city?.name, ...(aliases ?? []).map((a: { alias_name: string }) => a.alias_name)].filter(Boolean) as string[];
    const query = /,/.test(typed) || !city?.name ? typed : `${typed}, ${city.name}`;
    const doc = await lookup(query).catch(() => null);
    const current = r.geo_lat != null && r.geo_lng != null ? { lat: Number(r.geo_lat), lng: Number(r.geo_lng) } : null;
    const decision = decideAddress({ typed, doc, cityNames, current });

    if (decision.auto) {
      const { error } = await db.from("restaurants")
        .update({ address: decision.address, geo_lat: decision.lat, geo_lng: decision.lng, updated_at: new Date().toISOString() })
        .eq("id", r.id);
      if (error) throw error;
      await db.from("admin_activity_logs").insert({
        user_id: user.id, action_type: "address_auto_approved", entity_type: "restaurant", entity_id: r.id, entity_name: r.name,
        details: { old: r.address, new: decision.address, typed },
      });
      return json({ applied: true, address: decision.address });
    }

    // An admin looks at it; the register's suggestion goes along.
    await db.from("contact_messages").insert({
      name: ((user.user_metadata?.name as string | undefined) || user.email).slice(0, 100),
      email: user.email,
      subject: `[${r.name}] Adres wijzigen`.slice(0, 200),
      message: [`Huidig adres: ${r.address ?? "onbekend"}`, `Nieuw adres: ${typed}`, `Controle: ${decision.reason}`,
        doc ? `Adresregister vond: ${doc.weergavenaam}` : "Adresregister vond niets"].join("\n").slice(0, 5000),
      category: "gegevens", restaurant_id: r.id, user_id: user.id,
    });
    return json({ applied: false, reason: decision.reason, suggestion: doc?.weergavenaam ?? null });
  } catch (e) {
    console.error("owner-address-change", e);
    return json({ error: e instanceof Error ? e.message : "Onbekende fout" }, 500);
  }
});
