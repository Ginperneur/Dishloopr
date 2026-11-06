import { getCaller, isAdmin, isInternalCaller, isSafePublicUrl, serviceClient } from "../_shared/auth.ts";
import { sendMenuReadyMail, toBase64 } from "./helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_BYTES = 15 * 1024 * 1024;
const LANGS = ["en", "de", "fr"] as const;

export interface MenuItem {
  category: string;
  name: string;
  description: string | null;
  price: number | null;
  translations: Record<(typeof LANGS)[number], { category: string; name: string; description: string | null }>;
}

const SYSTEM = `Je zet de menukaart van een Nederlands restaurant om naar gestructureerde data en vertaalt die.
Antwoord ALLEEN met geldige JSON, zonder markdown:
{"items":[{"category":"Voorgerechten","name":"...","description":"... of null","price":12.5,"translations":{"en":{"category":"...","name":"...","description":"..."},"de":{...},"fr":{...}}}]}
Regels:
- Neem ALLE gerechten en dranken op die op de kaart staan, in de volgorde van de kaart, met hun categorie.
- price is een getal in euro (12,50 wordt 12.5); null als er geen prijs staat. Verzin geen prijzen of gerechten.
- Laat namen die eigennamen of vaktermen zijn (bijv. "Carbonara", "Bitterballen") onvertaald, maar vertaal de beschrijving.
- Vertaal category, name en description naar Engels (en), Duits (de) en Frans (fr).`;

type Source = { kind: "file"; dataUrl: string } | { kind: "text"; text: string };

async function loadSource(url: string): Promise<Source> {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "DishlooprMenuService/1.0" } });
  if (!res.ok) throw new Error(`Kon ${url} niet ophalen (${res.status})`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type === "application/pdf" || /^image\/(png|jpe?g|webp|gif)$/.test(type)) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error("Het bestand is groter dan 15 MB");
    return { kind: "file", dataUrl: `data:${type};base64,${toBase64(bytes)}` };
  }
  // Web page: Firecrawl renders JavaScript menus; plain fetch is the fallback.
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (firecrawlKey) {
    const fc = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 3000 }),
    });
    if (fc.ok) {
      const body = await fc.json();
      const markdown: string = body.data?.markdown ?? body.markdown ?? "";
      if (markdown.length > 200) return { kind: "text", text: markdown.slice(0, 60000) };
    }
  }
  const html = await res.text();
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 200) throw new Error("Op deze pagina staat geen leesbare menukaart");
  return { kind: "text", text: text.slice(0, 60000) };
}

async function extractMenu(source: Source, restaurantName: string): Promise<MenuItem[]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("AI is niet geconfigureerd");
  const intro = `Menukaart van ${restaurantName}.`;
  const content = source.kind === "file"
    ? [{ type: "text", text: intro }, { type: "image_url", image_url: { url: source.dataUrl } }]
    : `${intro}\n\n${source.text}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: SYSTEM }, { role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`AI gaf een fout (${res.status})`);
  const text: string = (await res.json())?.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(text.replace(/^```(json)?/m, "").replace(/```\s*$/m, "").trim());
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : null);
  const items: MenuItem[] = (Array.isArray(parsed?.items) ? parsed.items : []).flatMap((i: any) => {
    const name = str(i?.name);
    if (!name) return [];
    const category = str(i?.category) ?? "Menu";
    const price = Number(i?.price);
    const translations = Object.fromEntries(LANGS.map(l => [l, {
      category: str(i?.translations?.[l]?.category) ?? category,
      name: str(i?.translations?.[l]?.name) ?? name,
      description: str(i?.translations?.[l]?.description) ?? str(i?.description),
    }])) as MenuItem["translations"];
    return [{ category, name, description: str(i?.description), price: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : null, translations }];
  });
  if (items.length < 3) throw new Error("Te weinig gerechten gevonden op deze menukaart");
  return items.slice(0, 400);
}

// Imports and translates a restaurant's menu for Menuservice. Called by
// stripe-webhook after payment (service key), by an admin, or by the owner to
// retry with another link. The owner publishes the result from the dashboard.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = serviceClient();
  let restaurantId = "";
  try {
    const body = await req.json().catch(() => ({}));
    restaurantId = typeof body.restaurant_id === "string" ? body.restaurant_id : "";
    if (!restaurantId) return json({ error: "Ontbrekend restaurant" }, 400);

    if (!(await isInternalCaller(req, admin))) {
      const user = await getCaller(req);
      if (!user) return json({ error: "Log eerst in" }, 401);
      const { data: verified } = await admin.rpc("is_verified_owner", { _user_id: user.id, _restaurant_id: restaurantId });
      if (verified !== true && !(await isAdmin(admin, user.id))) return json({ error: "Geen toegang" }, 403);
      const { count } = await admin.from("package_orders").select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId).eq("package", "menu_service");
      if (!count) return json({ error: "Menuservice is nog niet afgenomen" }, 402);
    }

    const [{ data: restaurant }, { data: existing }] = await Promise.all([
      admin.from("restaurants").select("id, name, slug, website_url, claimed_by_owner_id").eq("id", restaurantId).maybeSingle(),
      admin.from("restaurant_menus").select("source_url").eq("restaurant_id", restaurantId).maybeSingle(),
    ]);
    if (!restaurant) return json({ error: "Restaurant niet gevonden" }, 404);

    const requested = typeof body.source_url === "string" ? body.source_url.trim() : "";
    if (requested && !isSafePublicUrl(requested)) return json({ error: "Ongeldige link" }, 400);
    const sourceUrl = requested || existing?.source_url || restaurant.website_url || "";
    const now = () => new Date().toISOString();

    if (!sourceUrl) {
      await admin.from("restaurant_menus").upsert({ restaurant_id: restaurantId, status: "failed", error: "Geen website of link naar de menukaart bekend. Plak een link naar je menu (webpagina, PDF of foto).", updated_at: now() });
      return json({ status: "failed", error: "no_source" });
    }

    await admin.from("restaurant_menus").upsert({ restaurant_id: restaurantId, status: "processing", source_url: sourceUrl, error: null, updated_at: now() });
    await admin.from("package_orders").update({ fulfillment_status: "in_progress", updated_at: now() })
      .eq("restaurant_id", restaurantId).eq("package", "menu_service").eq("fulfillment_status", "todo");

    const items = await extractMenu(await loadSource(sourceUrl), restaurant.name);
    await admin.from("restaurant_menus").upsert({
      restaurant_id: restaurantId, status: "awaiting_owner", source_url: sourceUrl, items, error: null, generated_at: now(), updated_at: now(),
    });
    await sendMenuReadyMail(admin, restaurant, items.length).catch(e => console.error("run-menu-service: mail failed", e));
    return json({ status: "awaiting_owner", items: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    console.error("run-menu-service error:", restaurantId, err);
    if (restaurantId) {
      await admin.from("restaurant_menus").upsert({ restaurant_id: restaurantId, status: "failed", error: message, updated_at: new Date().toISOString() });
      // Back on the admin's list: the automatic import did not work.
      await admin.from("package_orders").update({ fulfillment_status: "todo" })
        .eq("restaurant_id", restaurantId).eq("package", "menu_service").eq("fulfillment_status", "in_progress");
    }
    return json({ status: "failed", error: message }, 200);
  }
});
