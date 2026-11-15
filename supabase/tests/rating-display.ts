// Checks that only Dishloopr's own review score is shown, never a Google rating
// (docs/google-places-compliance.md), and only from OWN_REVIEW_THRESHOLD reviews on.
// Usage from the repo root: deno run --config supabase/tests/deno.json supabase/tests/rating-display.ts
import { getRatingDisplay, OWN_REVIEW_THRESHOLD } from "../../src/lib/ratingDisplay.ts";

let ok = true;
const check = (label: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  ok &&= pass;
  console.log(pass ? "PASS" : "FAIL", label, pass ? "" : `kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`);
};

check("geen reviews", getRatingDisplay({}), { mode: "none" });
check("te weinig eigen reviews", getRatingDisplay({ ownReviewCount: OWN_REVIEW_THRESHOLD - 1, ownAverage: 4.5 }), { mode: "none" });
check("genoeg eigen reviews", getRatingDisplay({ ownReviewCount: OWN_REVIEW_THRESHOLD, ownAverage: 4.5 }), { mode: "own", own: 4.5, count: OWN_REVIEW_THRESHOLD });
check("gemiddelde 0 telt niet", getRatingDisplay({ ownReviewCount: 20, ownAverage: 0 }), { mode: "none" });
// A caller that still passes Google fields must not get a score from them.
check("Google-velden worden genegeerd", getRatingDisplay({ googleRating: 4.8, googleReviewsCount: 900 } as never), { mode: "none" });

Deno.exit(ok ? 0 : 1);
