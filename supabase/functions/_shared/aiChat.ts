// Where AI chat-completion calls go. With GEMINI_API_KEY set (a paid-tier key from Google AI
// Studio), calls go straight to Google's OpenAI-compatible Gemini endpoint and are billed by
// Google; otherwise they go through the Lovable AI gateway as before. Both accept the same
// OpenAI chat format (messages, tools, tool_choice), so callers only swap URL, key and model.
//
// Gemini API terms (checked 17-11-2026): in the EEA only paid services may be used; on the paid
// tier Google does not use prompts or responses to improve its products. We send the restaurant's
// own website text, not Google Search or Maps results, and never enable Google grounding here.

export const GEMINI_OPENAI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const LOVABLE_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

export interface AiChatTarget {
  provider: 'google' | 'lovable';
  url: string;
  key: string;
  model: string;
}

// Models Google no longer serves to new API users (checked 17-11-2026): calls with our own key
// use the stable successor Google names in its error. The Lovable gateway keeps the old names.
export const GOOGLE_MODEL_REPLACEMENTS: Record<string, string> = {
  'gemini-2.5-flash': 'gemini-3.8-flash',
};

// `model` uses the gateway naming ("google/gemini-2.5-flash"); Google wants it without the prefix.
export function aiChatTarget(model: string, env: (name: string) => string | undefined = (n) => Deno.env.get(n)): AiChatTarget | null {
  const gemini = env('GEMINI_API_KEY');
  if (gemini) {
    const name = model.replace(/^google\//, '');
    return { provider: 'google', url: GEMINI_OPENAI_URL, key: gemini, model: GOOGLE_MODEL_REPLACEMENTS[name] ?? name };
  }
  const lovable = env('LOVABLE_API_KEY');
  if (lovable) {
    return { provider: 'lovable', url: LOVABLE_GATEWAY_URL, key: lovable, model };
  }
  return null;
}
