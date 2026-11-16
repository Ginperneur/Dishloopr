// Checks the claim reminder mails: no em/en dashes in visible copy (compound hyphens are fine), correct escaping,
// unsubscribe link present, the step kinds, the page-view rule (only named from VIEWS_MIN on) and the launch wording.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/outreach_reminders.ts
const repo = Deno.args[0] ?? Deno.cwd();
const { renderReminder, reminderKind, VIEWS_MIN } = await import(`file://${repo}/supabase/functions/_shared/outreach/reminders.ts`);

const base = {
  name: "Trattoria <Da Mario>", city: "Utrecht", dishCount: 0,
  inviteUrl: "https://dishloopr.com/voor-restaurants/trattoria-da-mario?utm_source=outreach",
  unsubscribeUrl: "https://dishloopr.com/voor-restaurants/afmelden?t=abc",
  optoutUrl: "https://dishloopr.com/voor-restaurants/afmelden?slug=x",
  claimUrl: "https://dishloopr.com/claim/trattoria-da-mario",
  menuMinimum: 5, senderName: "Ginuwine Ayanne",
};

let ok = true;
const check = (label: string, pass: boolean) => { ok &&= pass; console.log(pass ? "PASS" : "FAIL", label); };
// Visible text = text part without URLs (URLs may contain hyphens).
const visible = (t: string) => t.replace(/https?:\/\/\S+/g, "");

for (const segment of ["zichtbaar", "onzichtbaar_menu"]) {
  for (const step of [1, 2, 3]) {
    const m = renderReminder(segment, { ...base, step, maxSteps: 3, views: 12, launched: false });
    const tag = `${segment} step ${step}`;
    check(`${tag}: no em/en dashes in subject or text`, !/[–—]/.test(m.subject + visible(m.text)));
    check(`${tag}: no em/en dashes in html`, !/[–—]/.test(visible(m.html)));
    check(`${tag}: html escapes name`, m.html.includes("Trattoria &lt;Da Mario&gt;") && !m.html.includes("<Da Mario>"));
    check(`${tag}: unsubscribe link`, m.html.includes(base.unsubscribeUrl) && m.text.includes(base.unsubscribeUrl));
    check(`${tag}: signature`, m.text.includes("Met vriendelijke groet,\nGinuwine Ayanne\nDishloopr"));
    check(`${tag}: greeting with name`, m.text.startsWith("Hoi Trattoria <Da Mario>,"));
    if (segment === "zichtbaar") {
      check(`${tag}: contains inviteUrl`, m.text.includes(base.inviteUrl) && m.html.includes(base.inviteUrl));
    } else {
      check(`${tag}: contains claimUrl and minimum`, m.html.includes(base.claimUrl) && m.text.includes(base.claimUrl) && m.text.includes("minder dan 5 gerechten"));
    }
  }
}

check("reminderKind(1,3) = eerste", reminderKind(1, 3) === "eerste");
check("reminderKind(2,3) = midden", reminderKind(2, 3) === "midden");
check("reminderKind(3,3) = laatste", reminderKind(3, 3) === "laatste");
check("reminderKind(1,1) = eerste", reminderKind(1, 1) === "eerste");
check("reminderKind(4,3) = laatste", reminderKind(4, 3) === "laatste");

const seen = renderReminder("zichtbaar", { ...base, step: 1, maxSteps: 3, views: 12, launched: false });
check("views 12: text contains '12 keer bekeken'", seen.text.includes("12 keer bekeken"));
const few = renderReminder("zichtbaar", { ...base, step: 1, maxSteps: 3, views: VIEWS_MIN - 1, launched: false });
check("views VIEWS_MIN-1: no 'keer bekeken' and no ' 0 keer'", !few.text.includes("keer bekeken") && !few.text.includes(" 0 keer"));

const last = renderReminder("zichtbaar", { ...base, step: 3, maxSteps: 3, views: 12, launched: false });
check("step 3 subject starts with 'Laatste herinnering'", last.subject.startsWith("Laatste herinnering"));

const notLive = renderReminder("zichtbaar", { ...base, step: 2, maxSteps: 3, views: 12, launched: false });
check("step 2 launched false: 'Op 1 december gaat Dishloopr officieel live'", notLive.text.includes("Op 1 december gaat Dishloopr officieel live"));
const live = renderReminder("zichtbaar", { ...base, step: 2, maxSteps: 3, views: 12, launched: true });
check("step 2 launched true: 'Dishloopr is sinds 1 december live'", live.text.includes("Dishloopr is sinds 1 december live"));

const unclaimed = renderReminder("zichtbaar", { ...base, step: 2, maxSteps: 3, views: 0, launched: false });
check("step 2 zichtbaar views 0: subject is 'Trattoria <Da Mario> op Dishloopr is nog niet geclaimd'", unclaimed.subject === "Trattoria <Da Mario> op Dishloopr is nog niet geclaimd");

Deno.exit(ok ? 0 : 1);
