// Checks launch-date timezone handling in _shared/launch.ts.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/launch.ts
const repo = Deno.args[0] ?? Deno.cwd();
const { launchAt, commitmentEnd } = await import(`file://${repo}/supabase/functions/_shared/launch.ts`);
const fake = (value: string | null) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: value === null ? null : { value } }) }) }) }) }) as any;
const cases: [string | null, string][] = [["2026-12-10", "2026-12-09T23:00:00.000Z"], ["2027-06-10", "2027-06-09T22:00:00.000Z"], [null, "2026-12-09T23:00:00.000Z"], ["10-12-2026", "2026-12-09T23:00:00.000Z"]];
let ok = true;
for (const [v, want] of cases) { const got = new Date((await launchAt(fake(v))).ms).toISOString(); const pass = got === want; ok &&= pass; console.log(pass ? "PASS" : "FAIL", v, got); }
const c = commitmentEnd(Date.parse("2026-12-09T23:00:00Z")); console.log(c === "2027-06-09T23:00:00.000Z" ? "PASS" : "FAIL", "commitment", c);
Deno.exit(ok ? 0 : 1);
