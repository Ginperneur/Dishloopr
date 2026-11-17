// Claim reminders: short follow-ups to restaurants that got a golf mail but did not claim or reply.
// Step 1 is a light nudge, middle steps lead with the launch, the last step says it is the last one.
// Page views are only named when there are at least VIEWS_MIN of them, so the mail never says "0 keer".
// House rule: no em/en dashes (– —) in the visible copy. Compound hyphens are fine.
import { escapeHtml } from "../auth.ts";
import {
  button, freeBullets, LAUNCH, type OutreachData, type OutreachSegment, type RenderedMail, shell, strip, textFooter, ul,
} from "./templates.ts";

export const VIEWS_MIN = 3;

export interface ReminderData extends Omit<OutreachData, "topDish" | "pricingUrl" | "flyer"> {
  /** 1-based reminder number and the configured maximum. */
  step: number;
  maxSteps: number;
  /** Page views since the first golf mail ("bekeken" metric). */
  views: number;
  /** True once Dishloopr is publicly live. */
  launched: boolean;
}

export type ReminderKind = "eerste" | "midden" | "laatste";

export function reminderKind(step: number, maxSteps: number): ReminderKind {
  if (step >= maxSteps && maxSteps > 1) return "laatste";
  return step <= 1 ? "eerste" : "midden";
}

export const mentionsViews = (views: number) => views >= VIEWS_MIN;

function viewsLine(d: ReminderData, segment: OutreachSegment): string | null {
  if (!mentionsViews(d.views)) return null;
  return segment === "zichtbaar"
    ? `Sinds mijn eerste mail is je pagina op Dishloopr ${d.views} keer bekeken.`
    : `Sinds mijn eerste mail is je pagina ${d.views} keer bekeken, ook al staat hij nog niet in de zoekresultaten.`;
}

function hiddenLine(d: ReminderData): string {
  return `Gasten zien ${escapeHtml(d.name)} nog niet in de zoekresultaten, omdat we minder dan ${d.menuMinimum} gerechten van je kaart kennen. Claim je pagina en vul je menu aan, of antwoord op deze mail met je menukaart. Een foto of pdf is genoeg, dan zetten wij de gerechten erin.`;
}

export function renderReminder(segment: OutreachSegment, d: ReminderData): RenderedMail {
  const name = escapeHtml(d.name);
  const kind = reminderKind(d.step, d.maxSteps);
  const views = viewsLine(d, segment);
  const visible = segment === "zichtbaar";
  const cta = visible
    ? { url: d.inviteUrl, label: "Bekijk en claim je pagina" }
    : { url: d.claimUrl, label: "Claim je pagina en vul je menu aan" };

  let subject: string;
  let paras: string[];
  let bullets: string[] = [];
  let closing: string;

  if (kind === "eerste") {
    subject = visible ? `Herinnering: claim ${d.name} gratis op Dishloopr` : `Herinnering: ${d.name} is nog niet zichtbaar op Dishloopr`;
    paras = [
      `Hoi ${name},`,
      `Een tijdje geleden mailde ik je over de pagina van ${name} op Dishloopr. Ik heb nog niets van je gehoord, dus bij deze een korte herinnering.`,
      ...(views ? [views] : []),
      visible
        ? "Claim je pagina gratis, dan bepaal jij wat gasten zien: je openingstijden, je foto's en je menu. Het kost je een paar minuten."
        : hiddenLine(d),
    ];
    closing = "Vragen? Antwoord gewoon op deze mail, ik lees alles zelf.";
  } else if (kind === "midden") {
    subject = mentionsViews(d.views) ? `${d.name}: gasten bekijken je pagina al op Dishloopr` : `${d.name} op Dishloopr is nog niet geclaimd`;
    paras = [
      `Hoi ${name},`,
      `${d.launched ? `Dishloopr is sinds ${LAUNCH} live.` : `Op ${LAUNCH} gaat Dishloopr officieel live.`} Gasten zoeken bij ons op wat ze willen eten, en ${name} staat ertussen.${views ? ` ${views}` : ""}`,
      visible
        ? "Je pagina is nog niet geclaimd, dus je bepaalt nog niet zelf wat erop staat. Claimen is gratis en blijft gratis. Je krijgt:"
        : hiddenLine(d),
    ];
    if (visible) bullets = freeBullets;
    closing = "Vragen? Antwoord gewoon op deze mail, ik lees alles zelf.";
  } else {
    subject = `Laatste herinnering: ${d.name} op Dishloopr`;
    paras = [
      `Hoi ${name},`,
      `Dit is mijn laatste herinnering over de pagina van ${name} op Dishloopr.${views ? ` ${views}` : ""}`,
      visible
        ? "Wil je hem later toch claimen, dan kan dat altijd gratis via de knop hieronder."
        : `${hiddenLine(d)} Dat kan ook later nog, altijd gratis.`,
    ];
    closing = "Geen interesse? Dan hoef je niets te doen. Wil je liever dat we je pagina aanpassen of verwijderen, antwoord dan op deze mail.";
  }

  const html = shell(
    paras.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("") +
      (bullets.length ? ul(bullets) : "") +
      button(cta.url, cta.label) +
      `<p style="margin:0">${closing}</p>`,
    { ...d, pricingUrl: "" },
  );
  const text = [
    ...paras.map(strip),
    ...(bullets.length ? [bullets.map((b) => `• ${b}`).join("\n")] : []),
    `${cta.label}: ${cta.url}`,
    closing,
  ].join("\n\n") + textFooter({ ...d, pricingUrl: "" });
  return { subject, html, text };
}
