// Checks the owner opening-hours input rules (only a time range or "gesloten").
// Usage from the repo root: deno run supabase/tests/opening-hours-input.ts

import { checkHoursInput as c } from "../../src/lib/openingHoursInput.ts";
const good: [string, string][] = [
  ["11:00-22:00", "11:00 - 22:00"], ["11:00 - 22:00", "11:00 - 22:00"], ["9-17", "09:00 - 17:00"],
  ["11.00 – 22.30", "11:00 - 22:30"], ["12 tot 22", "12:00 - 22:00"], ["Gesloten", "gesloten"],
  ["  gesloten ", "gesloten"], ["closed", "gesloten"], ["18:00-02:00", "18:00 - 02:00"], ["17:00-24:00", "17:00 - 24:00"],
  ["12:00-14:30, 17:00-22:00", "12:00 - 14:30, 17:00 - 22:00"], ["12-14 en 17-22", "12:00 - 14:00, 17:00 - 22:00"],
];
const bad = ["dicht", "open", "", "12:00", "25:00-26:00", "12:61-22:00", "12:00-12:00", "ma-vr 12-22",
  "17:00-22:00, 12:00-14:00", "12-15, 14-22", "a-b", "24:30-02:00", "1-2,3-4,5-6,7-8"];
let ok = true;
for (const [i, want] of good) { const r = c(i); const p = r.ok && r.value === want; ok &&= p; console.log(p ? "PASS" : "FAIL", JSON.stringify(i), r.ok ? r.value : r.error); }
for (const i of bad) { const r = c(i); const p = !r.ok; ok &&= p; console.log(p ? "PASS" : "FAIL", "weigert", JSON.stringify(i), r.ok ? r.value : ""); }
Deno.exit(ok ? 0 : 1);
