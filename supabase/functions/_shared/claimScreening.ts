// AI pre-check of manual claim proof (Route B). The model only reads the documents;
// the decision is made here in code. A claim is approved automatically only for a
// KvK extract where the business name, postcode and house number match the
// restaurant AND the claimant is listed on it (anyone can buy a KvK extract, so a
// matching business alone is not proof of ownership). Everything else goes to the
// admin queue with this summary.

export interface ClaimScreening {
  doc_type: "kvk_extract" | "invoice" | "menu" | "other";
  business_names: string[];
  persons: string[];
  postal_code: string | null;
  house_number: string | null;
  city: string | null;
  kvk_number: string | null;
  confidence: number;
  notes: string;
  checks: { name: boolean; postal_code: boolean; house_number: boolean; claimant_listed: boolean };
  verdict: "auto_approve" | "review";
  reasons: string[];
  screened_at: string;
}

const AUTO_APPROVE_CONFIDENCE = 0.85;
const MAX_FILES = 3;
const MAX_BYTES = 8 * 1024 * 1024;

const NAME_NOISE = new Set(["restaurant", "eetcafe", "cafe", "bistro", "brasserie", "bv", "vof", "holding", "de", "het", "the", "en", "and", "b", "v"]);
const PARTICLES = new Set(["van", "de", "der", "den", "het", "ter", "ten", "te", "la", "le", "du", "da", "di"]);

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const nameTokens = (s: string) => normalize(s).split(" ").filter(t => t.length > 1 && !NAME_NOISE.has(t));

/** Business name on the document matches the restaurant name (all significant words of the shorter one). */
export function namesMatch(restaurant: string, candidates: string[]): boolean {
  const target = nameTokens(restaurant);
  if (!target.length) return false;
  return candidates.some(c => {
    const tokens = nameTokens(c);
    if (!tokens.length) return false;
    const [small, big] = tokens.length <= target.length ? [tokens, target] : [target, tokens];
    return small.every(t => big.includes(t));
  });
}

/** Dutch postcode (1234AB) and house number from a free-text address. */
export function addressParts(address: string | null | undefined) {
  const a = address ?? "";
  const postal = a.match(/\b(\d{4})\s?([a-z]{2})\b/i);
  const house = a.match(/[a-z]\s+(\d+)\s*[a-z]?\b/i);
  return { postal: postal ? `${postal[1]}${postal[2]}`.toUpperCase() : null, house: house ? house[1] : null };
}

/** Claimant's name (without particles) appears among the persons on the document. */
export function claimantListed(fullName: string, persons: string[]): boolean {
  const tokens = normalize(fullName).split(" ").filter(t => t.length > 1 && !PARTICLES.has(t));
  if (tokens.length < 2) return false;
  return persons.some(p => {
    const pt = normalize(p).split(" ");
    return tokens.every(t => pt.includes(t));
  });
}

export function decide(
  read: Omit<ClaimScreening, "checks" | "verdict" | "reasons" | "screened_at">,
  restaurant: { name: string; address: string | null },
  claimantName: string,
): Pick<ClaimScreening, "checks" | "verdict" | "reasons"> {
  const where = addressParts(restaurant.address);
  const checks = {
    name: namesMatch(restaurant.name, read.business_names),
    postal_code: Boolean(where.postal && read.postal_code && read.postal_code.replace(/\s/g, "").toUpperCase() === where.postal),
    house_number: Boolean(where.house && read.house_number && read.house_number.replace(/\D/g, "") === where.house),
    claimant_listed: claimantListed(claimantName, read.persons),
  };
  const reasons: string[] = [];
  if (read.doc_type !== "kvk_extract") reasons.push("Geen KvK-uittreksel");
  if (!checks.name) reasons.push("Bedrijfsnaam komt niet overeen");
  if (!checks.postal_code) reasons.push("Postcode komt niet overeen");
  if (!checks.house_number) reasons.push("Huisnummer komt niet overeen");
  if (!checks.claimant_listed) reasons.push("Aanvrager staat niet als eigenaar of bestuurder op het document");
  if (read.confidence < AUTO_APPROVE_CONFIDENCE) reasons.push("AI is niet zeker genoeg");
  return { checks, verdict: reasons.length ? "review" : "auto_approve", reasons };
}

const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const SYSTEM = `Je controleert bewijsstukken waarmee iemand claimt eigenaar van een restaurant te zijn.
Lees de documenten en antwoord ALLEEN met geldige JSON, zonder markdown:
{"doc_type":"kvk_extract|invoice|menu|other","business_names":["handelsnamen en statutaire naam"],"persons":["volledige namen van eigenaren, vennoten en bestuurders"],"postal_code":"1234AB of null","house_number":"123 of null","city":"plaats of null","kvk_number":"8 cijfers of null","confidence":0.0,"notes":"korte toelichting in het Nederlands"}
Gebruik bij meerdere documenten het sterkste bewijs (KvK-uittreksel boven factuur boven menukaart). confidence is hoe zeker je bent dat het document echt en leesbaar is. Verzin niets: onleesbaar of ontbrekend is null.`;

// Structural type so both the npm and esm.sh Supabase clients fit.
type StorageClient = { storage: { from(bucket: string): { download(path: string): Promise<{ data: Blob | null; error: unknown }> } } };

export async function screenClaimDocuments(
  admin: StorageClient,
  files: string[],
  restaurant: { name: string; address: string | null },
  claimantName: string,
): Promise<ClaimScreening | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key || !files.length) return null;

  const parts: Array<{ type: "image_url"; image_url: { url: string } }> = [];
  for (const path of files.slice(0, MAX_FILES)) {
    const { data, error } = await admin.storage.from("claim-proofs").download(path);
    if (error || !data || data.size > MAX_BYTES) continue;
    const type = data.type || (path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    if (!/^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/.test(type)) continue;
    parts.push({ type: "image_url", image_url: { url: `data:${type};base64,${toBase64(new Uint8Array(await data.arrayBuffer()))}` } });
  }
  if (!parts.length) return null;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: [{ type: "text", text: `Restaurant volgens Dishloopr: ${restaurant.name}, ${restaurant.address ?? "adres onbekend"}. Aanvrager: ${claimantName}.` }, ...parts] },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const content: string = (await res.json())?.choices?.[0]?.message?.content ?? "";
  const raw = JSON.parse(content.replace(/^```(json)?/m, "").replace(/```\s*$/m, "").trim());

  const read = {
    doc_type: ["kvk_extract", "invoice", "menu"].includes(raw.doc_type) ? raw.doc_type : "other",
    business_names: Array.isArray(raw.business_names) ? raw.business_names.map(String).slice(0, 10) : [],
    persons: Array.isArray(raw.persons) ? raw.persons.map(String).slice(0, 20) : [],
    postal_code: raw.postal_code ? String(raw.postal_code) : null,
    house_number: raw.house_number ? String(raw.house_number) : null,
    city: raw.city ? String(raw.city) : null,
    kvk_number: raw.kvk_number ? String(raw.kvk_number) : null,
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
    notes: String(raw.notes ?? "").slice(0, 500),
  } as Omit<ClaimScreening, "checks" | "verdict" | "reasons" | "screened_at">;

  return { ...read, ...decide(read, restaurant, claimantName), screened_at: new Date().toISOString() };
}
