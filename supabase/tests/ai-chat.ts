// Checks where AI chat calls go: Google's Gemini endpoint when GEMINI_API_KEY is set, the Lovable
// gateway otherwise, nothing without a key.
// Usage from the repo root: deno run --config supabase/tests/deno.json supabase/tests/ai-chat.ts
import { aiChatTarget, GEMINI_OPENAI_URL, LOVABLE_GATEWAY_URL } from "../functions/_shared/aiChat.ts";

let ok = true;
const check = (label: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  ok &&= pass;
  console.log(pass ? "PASS" : "FAIL", label, pass ? "" : `kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`);
};
const env = (vars: Record<string, string>) => (n: string) => vars[n];

check("Gemini-sleutel gaat naar Google zonder model-prefix",
  aiChatTarget("google/gemini-2.5-flash", env({ GEMINI_API_KEY: "g", LOVABLE_API_KEY: "l" })),
  { provider: "google", url: GEMINI_OPENAI_URL, key: "g", model: "gemini-2.5-flash" });
check("alleen Lovable-sleutel gaat via de gateway met prefix",
  aiChatTarget("google/gemini-3-flash-preview", env({ LOVABLE_API_KEY: "l" })),
  { provider: "lovable", url: LOVABLE_GATEWAY_URL, key: "l", model: "google/gemini-3-flash-preview" });
check("lege Gemini-sleutel telt niet", aiChatTarget("google/gemini-2.5-flash", env({ GEMINI_API_KEY: "", LOVABLE_API_KEY: "l" }))?.provider, "lovable");
check("zonder sleutels geen doel", aiChatTarget("google/gemini-2.5-flash", env({})), null);

if (!ok) Deno.exit(1);
