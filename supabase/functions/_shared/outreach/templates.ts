// Owner outreach mails (mail golf). Two segments:
//   zichtbaar         restaurant is live on Dishloopr: claim it for free, plus what paid options do
//   onzichtbaar_menu  restaurant is in Dishloopr but hidden because the menu is below the minimum
// House rule: no em/en dashes (– —) in the visible copy (owner: they read as AI). Compound hyphens are fine.
import { escapeHtml } from "../auth.ts";

export type OutreachSegment = "zichtbaar" | "onzichtbaar_menu";

export interface OutreachData {
  name: string;
  city: string | null;
  dishCount: number;
  /** Best ranking page, if any: "Carbonara", 3, 12 */
  topDish?: { dish: string; position: number; total: number } | null;
  inviteUrl: string;      // personal landing page /voor-restaurants/:slug
  claimUrl: string;       // /claim/:slug, also works for hidden restaurants
  pricingUrl: string;     // /voor-restaurants/pakketten
  unsubscribeUrl: string; // one-click opt-out
  optoutUrl: string;      // change or delete data
  /** Visibility rule: approved dishes (drinks excluded) needed to go live. */
  menuMinimum: number;
  senderName: string;
  /** Owner flyer: attached as pdf, offered as a download link, or absent (null). */
  flyer?: { mode: "attachment" | "link"; url: string } | null;
}

export interface RenderedMail { subject: string; html: string; text: string }

const LAUNCH = "1 december";
const FLYER_ATTACHED = "In de bijlage vind je onze flyer met alles op een rij: hoe gasten je vinden, wat claimen je oplevert en alle prijzen.";
const FLYER_LINKED = "Alles op een rij, met hoe gasten je vinden, wat claimen je oplevert en alle prijzen, staat in onze flyer.";

function flyerHtml(d: OutreachData): string {
  if (!d.flyer) return "";
  if (d.flyer.mode === "attachment") return `<p style="margin:0 0 14px">${FLYER_ATTACHED}</p>`;
  return `<p style="margin:0 0 14px">${FLYER_LINKED} <a href="${escapeHtml(d.flyer.url)}" style="color:#e8562a">Download onze flyer (pdf)</a></p>`;
}
function flyerText(d: OutreachData): string[] {
  if (!d.flyer) return [];
  return d.flyer.mode === "attachment" ? [FLYER_ATTACHED] : [`${FLYER_LINKED}\nDownload onze flyer (pdf): ${d.flyer.url}`];
}

function rankingLine(d: OutreachData): string | null {
  if (!d.topDish || !d.city) return null;
  const { dish, position, total } = d.topDish;
  if (position <= 5) {
    return `Zoekt iemand op ${dish.toLowerCase()} in ${d.city}, dan sta je nu op plek ${position} van ${total}. Een mooie plek om vast te houden.`;
  }
  return `Zoekt iemand op ${dish.toLowerCase()} in ${d.city}, dan sta je nu op plek ${position} van ${total}. De meeste gasten kijken niet verder dan de eerste vijf.`;
}

const freeBullets = [
  "je profiel, openingstijden en foto's in eigen beheer",
  "je signature dish onder \"Bekend om\"",
  "je menu bevestigen en aanvullen",
  "zelf reageren op reviews",
  "privéfeedback van gasten, alleen voor jou",
];

const paidBullets = [
  "<b>Uitgelicht</b>: een vaste plek bovenaan bij jouw gerecht in jouw stad, met maximaal 5 restaurants per gerecht per stad. Stap je nu of uiterlijk 5 januari in, dan word je Founding Partner: je betaalt €59 per maand in plaats van €99 (of €590 per jaar in plaats van €990), tot en met 31 december 2027. Je plek staat direct live en je Founding Partner badge blijft voor altijd op je pagina staan.",
  "<b>Owner Pro</b> (€29 per maand): zie welke zoektermen gasten naar jou brengen, hoeveel mensen bellen, reserveren of je website bezoeken, en hoe je het doet ten opzichte van de buurt. Met een wekelijkse tip op basis van wat er in jouw stad gezocht wordt.",
  "<b>Specials en evenementen</b> (€5 per maand per evenement): zet je ladies night, pubquiz of wijnproeverij op Dishloopr en op je eigen pagina.",
];

// Plain text part: drop tags, then undo escapeHtml so names read normally.
const strip = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

function shell(bodyHtml: string, d: OutreachData): string {
  return `<!doctype html><html lang="nl"><body style="margin:0;padding:0;background:#f6f4f0">
<div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f1f1f">
${bodyHtml}
<p style="margin:28px 0 0">Met vriendelijke groet,<br>${escapeHtml(d.senderName)}<br>Dishloopr</p>
<hr style="border:none;border-top:1px solid #e4e0d8;margin:28px 0 14px">
<p style="font-size:12px;color:#77736b;margin:0">Je krijgt deze mail omdat ${escapeHtml(d.name)} op Dishloopr staat en dit adres openbaar op jullie website of bedrijfsprofiel staat.
Liever geen mail meer? <a href="${escapeHtml(d.unsubscribeUrl)}" style="color:#77736b">Afmelden</a>.
Gegevens laten aanpassen of verwijderen? <a href="${escapeHtml(d.optoutUrl)}" style="color:#77736b">Dat regel je hier</a>.</p>
</div></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${escapeHtml(href)}" style="background:#e8562a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${label}</a></p>`;

const ul = (items: string[]) =>
  `<ul style="padding-left:20px;margin:8px 0 16px">${items.map((i) => `<li style="margin:4px 0">${i}</li>`).join("")}</ul>`;

function textFooter(d: OutreachData): string {
  return `\n\nMet vriendelijke groet,\n${d.senderName}\nDishloopr\n\nJe krijgt deze mail omdat ${d.name} op Dishloopr staat en dit adres openbaar op jullie website of bedrijfsprofiel staat.\nAfmelden: ${d.unsubscribeUrl}\nGegevens aanpassen of verwijderen: ${d.optoutUrl}\n`;
}

export function renderVisible(d: OutreachData): RenderedMail {
  const name = escapeHtml(d.name);
  const rank = rankingLine(d);
  const dishes = d.dishCount > 0 ? ` en ${d.dishCount} gerechten van je kaart` : "";
  const subject = `${d.name} staat op Dishloopr`;
  const intro = [
    `Hoi ${name},`,
    `${name} staat op Dishloopr, met een eigen pagina${dishes}. Op Dishloopr zoeken gasten niet op naam, maar op wat ze willen eten, zoals "beste ramen Amsterdam" of "carbonara Utrecht". Jouw restaurant komt daar al in voor.`,
    ...(rank ? [escapeHtml(rank)] : []),
    `Op ${LAUNCH} gaan we officieel live. Dit is het moment om je pagina te claimen, zodat jij bepaalt wat gasten zien.`,
  ];
  const html = shell(
    intro.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("") +
      `<p style="margin:0"><b>Claimen is gratis en blijft gratis.</b> Je krijgt:</p>` + ul(freeBullets) +
      button(d.inviteUrl, "Bekijk en claim je pagina") +
      `<p style="margin:0">Wil je meer opvallen? Dat kan, maar het hoeft nooit:</p>` + ul(paidBullets) +
      `<p style="margin:0 0 14px"><a href="${escapeHtml(d.pricingUrl)}" style="color:#e8562a">Bekijk alle pakketten en prijzen</a></p>` +
      flyerHtml(d) +
      `<p style="margin:0">Vragen? Antwoord gewoon op deze mail, ik lees alles zelf.</p>`,
    d,
  );
  const text = [
    ...intro.map(strip),
    `Claimen is gratis en blijft gratis. Je krijgt:\n${freeBullets.map((b) => `• ${b}`).join("\n")}`,
    `Bekijk en claim je pagina: ${d.inviteUrl}`,
    `Wil je meer opvallen? Dat kan, maar het hoeft nooit:\n${paidBullets.map((b) => `• ${strip(b)}`).join("\n")}`,
    `Alle pakketten en prijzen: ${d.pricingUrl}`,
    ...flyerText(d),
    `Vragen? Antwoord gewoon op deze mail, ik lees alles zelf.`,
  ].join("\n\n") + textFooter(d);
  return { subject, html, text };
}

export function renderHiddenMenu(d: OutreachData): RenderedMail {
  const name = escapeHtml(d.name);
  const have = d.dishCount === 0
    ? "Van jouw kaart kennen we er nog geen."
    : `Van jouw kaart kennen we er nu ${d.dishCount}.`;
  const subject = `${d.name} staat op Dishloopr, maar gasten zien je nog niet`;
  const paras = [
    `Hoi ${name},`,
    `${name} staat op Dishloopr.`,
    `Alleen zien gasten je nog niet. Op Dishloopr zoeken gasten op gerecht, zoals "beste ramen Amsterdam" of "carbonara Utrecht". Daarom tonen we een restaurant pas als we minimaal ${d.menuMinimum} gerechten van de kaart kennen, drankjes niet meegeteld. ${have} Je menu voldoet daarmee nog niet aan de minimale vereisten.`,
    `Zonde, want op ${LAUNCH} gaan we officieel live${d.city ? ` en zoeken gasten in ${escapeHtml(d.city)} dan op wat ze willen eten` : ""}. Je kunt dit op twee manieren oplossen:`,
  ];
  const optionsHtml = `<ol style="padding-left:20px;margin:8px 0 16px">
<li style="margin:6px 0"><b>Claim je pagina en vul je menu zelf aan.</b> Claimen is gratis. In je dashboard upload je je menukaart als pdf of voeg je gerechten toe. Zodra je op ${d.menuMinimum} gerechten staat, ben je automatisch zichtbaar.</li>
<li style="margin:6px 0"><b>Geen tijd? Antwoord op deze mail met je menukaart.</b> Een foto, een pdf of een link naar de kaart op je website is genoeg. Wij zetten je gerechten erin, zonder kosten, en laten je weten zodra je zichtbaar bent.</li>
</ol>`;
  const optionsText = `1. Claim je pagina en vul je menu zelf aan. Claimen is gratis. In je dashboard upload je je menukaart als pdf of voeg je gerechten toe. Zodra je op ${d.menuMinimum} gerechten staat, ben je automatisch zichtbaar.\n2. Geen tijd? Antwoord op deze mail met je menukaart. Een foto, een pdf of een link naar de kaart op je website is genoeg. Wij zetten je gerechten erin, zonder kosten, en laten je weten zodra je zichtbaar bent.`;
  const html = shell(
    paras.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("") + optionsHtml +
      button(d.claimUrl, "Claim je pagina en vul je menu aan") +
      `<p style="margin:0">Met een geclaimde pagina krijg je, gratis:</p>` + ul(freeBullets) +
      `<p style="margin:0">En wil je meer opvallen, dan kan dat ook:</p>` + ul(paidBullets) +
      `<p style="margin:0 0 14px"><a href="${escapeHtml(d.pricingUrl)}" style="color:#e8562a">Bekijk alle pakketten en prijzen</a></p>` +
      flyerHtml(d) +
      `<p style="margin:0">Vragen? Antwoord gewoon op deze mail, ik lees alles zelf.</p>`,
    d,
  );
  const text = [
    ...paras.map(strip),
    optionsText,
    `Claim je pagina en vul je menu aan: ${d.claimUrl}`,
    `Met een geclaimde pagina krijg je, gratis:\n${freeBullets.map((b) => `• ${b}`).join("\n")}`,
    `En wil je meer opvallen, dan kan dat ook:\n${paidBullets.map((b) => `• ${strip(b)}`).join("\n")}`,
    `Alle pakketten en prijzen: ${d.pricingUrl}`,
    ...flyerText(d),
    `Vragen? Antwoord gewoon op deze mail, ik lees alles zelf.`,
  ].join("\n\n") + textFooter(d);
  return { subject, html, text };
}

export function renderOutreach(segment: OutreachSegment, d: OutreachData): RenderedMail {
  return segment === "zichtbaar" ? renderVisible(d) : renderHiddenMenu(d);
}
