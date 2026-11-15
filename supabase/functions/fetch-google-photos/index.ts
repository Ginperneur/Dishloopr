import { googleContentDisabled } from "../_shared/googleDisabled.ts";

// Disabled: this function downloaded Google Places photos into our own storage bucket,
// which the Google Maps Platform EEA terms do not allow. See docs/google-places-compliance.md.
Deno.serve(googleContentDisabled(
  'fetch-google-photos',
  "Google-foto's mogen volgens de Google-voorwaarden niet worden opgeslagen. Gebruik foto's van de eigenaar.",
));
