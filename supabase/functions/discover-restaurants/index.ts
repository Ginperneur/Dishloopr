import { googleContentDisabled } from "../_shared/googleDisabled.ts";

// Disabled: this function stored names, addresses, coordinates, ratings, photo references and
// the raw Google response in discovery_results, which the Google Maps Platform EEA terms do not
// allow. It returns once discovery runs on Overture Maps Places (phase 3 in
// docs/google-places-compliance.md).
Deno.serve(googleContentDisabled(
  'discover-restaurants',
  'scannen via Google Places is gestopt vanwege de Google-voorwaarden. Discovery komt terug op Overture Maps.',
));
