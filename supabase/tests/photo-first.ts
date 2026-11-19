// Checks that listings put restaurants with a photo first without reordering within either group.
// Usage from the repo root: deno run --config supabase/tests/deno.json supabase/tests/photo-first.ts
import { hasPhoto, photoFirst } from "../../src/lib/photoFirst.ts";

let ok = true;
const check = (label: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  ok &&= pass;
  console.log(pass ? "PASS" : "FAIL", label, pass ? "" : `kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`);
};

const rows = [
  { id: "a", images: null }, { id: "b", images: ["x.jpg"] }, { id: "c", images: [] },
  { id: "d", images: ["y.jpg"] }, { id: "e", images: [""] },
];
check("met foto eerst, volgorde binnen groepen blijft", photoFirst(rows).map((r) => r.id), ["b", "d", "a", "c", "e"]);
check("lege of ontbrekende foto telt niet", rows.map(hasPhoto), [false, true, false, true, false]);
check("originele lijst blijft ongewijzigd", rows.map((r) => r.id), ["a", "b", "c", "d", "e"]);

if (!ok) Deno.exit(1);
