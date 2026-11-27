// Checks the admin alert for claims that wait for a decision.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/claim_alert.ts
const repo = Deno.args[0] ?? Deno.cwd();
const { claimAlertMail } = await import(`file://${repo}/supabase/functions/verify-claim/adminNotify.ts`);

let ok = true;
const check = (label: string, pass: boolean) => { ok &&= pass; console.log(pass ? "PASS" : "FAIL", label); };

const m = claimAlertMail({ restaurantName: "Trattoria <Da Mario>", restaurantSlug: "trattoria-da-mario", method: "manual_proof",
  ownerName: "Mario Rossi", jobTitle: "Eigenaar", ai: { verdict: "waarschijnlijk", reasons: ["naam komt overeen"] } });
check("subject names the restaurant", m.subject === "Nieuwe claim wacht op je: Trattoria <Da Mario>");
check("links to the admin claims queue", m.html.includes("/admin?section=claims") && m.text.includes("/admin?section=claims"));
check("html escapes the name", m.html.includes("Trattoria &lt;Da Mario&gt;") && !m.html.includes("<Da Mario>"));
check("mentions owner and AI advice", m.text.includes("Mario Rossi (Eigenaar)") && m.text.includes("AI-check: waarschijnlijk, naam komt overeen"));
check("no em/en dashes", !/[–—]/.test(m.subject + m.text));
const g = claimAlertMail({ restaurantName: "Rodeo", restaurantSlug: null, method: "google_business" });
check("google claim wording", g.text.startsWith("Een eigenaar heeft Rodeo geclaimd via het Google Bedrijfsprofiel."));
check("no page link without slug", !g.text.includes("/restaurant/"));
if (!ok) Deno.exit(1);
