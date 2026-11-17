import { googleContentDisabled } from "../_shared/googleDisabled.ts";

// Disabled: this function copied ratings, opening hours, price level and websites from
// Google Place Details into restaurants, which the Google Maps Platform EEA terms do not
// allow. See docs/google-places-compliance.md.
Deno.serve(googleContentDisabled(
  'enrich-restaurants',
  'gegevens uit Google Places mogen volgens de Google-voorwaarden niet worden opgeslagen.',
));
