// Small checks used by admin-automation (pure, testable) and an AI text check.

export const normName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(restaurant|eetcafe|cafe|bistro|brasserie|grill|bar|de|het|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/** A name change that only fixes spelling, case, accents or "Restaurant ..." can go through. */
export function isMinorNameChange(oldName: string, newName: string): boolean {
  const a = normName(oldName), b = normName(newName);
  if (!a || !b) return false;
  if (a === b) return true;
  return levenshtein(a, b) <= Math.max(2, Math.floor(Math.max(a.length, b.length) * 0.2));
}

/** Same as src/lib/dishNames.ts: real dish names, not scraping debris. */
export function isRealDishName(name: string): boolean {
  const n = name.trim();
  return n.length >= 2 && n.length <= 50
    && /^[\p{L}][\p{L}\p{M}\d\s'’&().,/-]*$/u.test(n)
    && !/\p{L}\d|\d\p{L}/u.test(n)
    && !/[.,;:!?-]$/.test(n)
    && !/-\s|\s-/.test(n)
    && n.split(/\s+/).length <= 7
    && (n.match(/\p{L}/gu) ?? []).length >= 2;
}

export type TextVerdict = { ok: boolean; reason: string };

/** AI check of owner text shown to guests (description, newsletter placement). Fails closed. */
export async function checkOwnerText(kind: "beschrijving" | "nieuwsbriefplaatsing", text: string): Promise<TextVerdict> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { ok: false, reason: "AI-controle niet beschikbaar" };
  const system = `Je controleert tekst van restauranteigenaren voor Dishloopr (een site om restaurants te vinden op gerecht).
Soort tekst: ${kind}.
Goedkeuren (ok true) als de tekst gaat over het eigen restaurant, eten, sfeer, een actie of evenement, in normale taal.
Afkeuren (ok false) bij: scheldwoorden of beledigingen, discriminatie, seksuele inhoud, misleidende of onwettige claims,
reclame voor een ander bedrijf, links naar andere sites, telefoonnummers of e-mailadressen in de tekst, onzin of willekeurige tekens,
of tekst die niets met het restaurant te maken heeft.
Geef ALLEEN JSON: {"ok": true|false, "reason": "korte uitleg in het Nederlands"}`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: text.slice(0, 4000) }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, reason: `AI-controle mislukt (${res.status})` };
    const body = await res.json();
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
    return { ok: parsed.ok === true, reason: String(parsed.reason ?? "").slice(0, 300) || (parsed.ok ? "In orde" : "Afgekeurd") };
  } catch (e) {
    return { ok: false, reason: `AI-controle mislukt: ${e instanceof Error ? e.message : String(e)}` };
  }
}
