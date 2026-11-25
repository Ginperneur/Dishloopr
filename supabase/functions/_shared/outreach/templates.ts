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
  topDish?: { dish: string; position: number; total: number; placesLeft?: number | null; topplekLeft?: number | null } | null;
  inviteUrl: string;      // personal landing page /voor-restaurants/:slug
  claimUrl: string;       // /claim/:slug, also works for hidden restaurants
  pricingUrl: string;     // /voor-restaurants/pakketten
  unsubscribeUrl: string; // one-click opt-out
  optoutUrl: string;      // change or delete data
  /** Visibility rule: approved dishes (drinks excluded) needed to go live. */
  menuMinimum: number;
  senderName: string;
  /** False when the restaurant has no photo yet: the mail then asks for one. Unknown (undefined) says nothing. */
  hasPhoto?: boolean;
  /** Owner flyer: attached as pdf, offered as a download link, or absent (null). */
  flyer?: { mode: "attachment" | "link"; url: string } | null;
}

export interface RenderedMail { subject: string; html: string; text: string }

export const LAUNCH = "1 december";
/** "je" addresses one owner; "jullie" addresses the restaurant team (mail A). */
export type Voice = "je" | "jullie";
const FLYER = {
  je: {
    attached: "In de bijlage vind je onze flyer met alles op een rij: hoe gasten je vinden, wat claimen je oplevert en alle prijzen.",
    linked: "Alles op een rij, met hoe gasten je vinden, wat claimen je oplevert en alle prijzen, staat in onze flyer.",
  },
  jullie: {
    attached: "In de bijlage vinden jullie onze flyer met alles op een rij: hoe gasten jullie vinden, wat claimen jullie oplevert en alle prijzen.",
    linked: "Alles op een rij, met hoe gasten jullie vinden, wat claimen jullie oplevert en alle prijzen, staat in onze flyer.",
  },
};

function flyerHtml(d: OutreachData, voice: Voice = "je"): string {
  if (!d.flyer) return "";
  if (d.flyer.mode === "attachment") return `<p style="margin:0 0 14px">${FLYER[voice].attached}</p>`;
  return `<p style="margin:0 0 14px">${FLYER[voice].linked} <a href="${escapeHtml(d.flyer.url)}" style="color:#e8562a">Download onze flyer (pdf)</a></p>`;
}
function flyerText(d: OutreachData, voice: Voice = "je"): string[] {
  if (!d.flyer) return [];
  return d.flyer.mode === "attachment" ? [FLYER[voice].attached] : [`${FLYER[voice].linked}\nDownload onze flyer (pdf): ${d.flyer.url}`];
}

// Listings rank restaurants with a photo higher (src/lib/browseOrder.ts); without one the card shows a few dishes.
function photoLine(d: OutreachData): string | null {
  if (d.hasPhoto !== false) return null;
  const where = d.city ? ` als gasten in ${d.city} kijken` : "";
  return `Je pagina heeft nog geen foto. Restaurants met een foto staan hoger in de lijst${where}; zonder foto tonen we alleen een paar gerechten van je kaart. Zet er na het claimen een paar foto's op, bijvoorbeeld je mooiste gerecht, je interieur of je terras. Liever niet zelf doen? Stuur ze als antwoord op deze mail, dan zetten wij ze erop.`;
}

// Mail A (zichtbaar) speaks to the team ("jullie"); copy written by the owner on 21-11-2026.
const COUNT_WORDS = ["nul", "één", "twee", "drie"];
const UITGELICHT = "plekken onder ‘Uitgelicht’";

/** Free paid places on the restaurant's best dish page, or "" when unknown or full. */
function placesSentence(top: number | null | undefined, left: number | null | undefined): string {
  const freeTop = typeof top === "number" && top > 0;
  const n = typeof left === "number" && left > 0 ? Math.min(left, 3) : 0;
  const uitgelicht = n === 3 ? `alle drie de ${UITGELICHT}` : `${COUNT_WORDS[n]} van de drie ${UITGELICHT}`;
  if (freeTop && n) return `Voor die zoekopdracht zijn de Topplek en ${uitgelicht} nog beschikbaar.`;
  if (freeTop) return "Voor die zoekopdracht is de Topplek nog beschikbaar.";
  if (n === 1) return `Voor die zoekopdracht is nog één van de drie ${UITGELICHT} beschikbaar.`;
  if (n) return `Voor die zoekopdracht zijn nog ${uitgelicht} beschikbaar.`;
  return "";
}

function rankingLine(d: OutreachData): string | null {
  if (!d.topDish || !d.city) return null;
  const { dish, position, total } = d.topDish;
  const places = placesSentence(d.topDish.topplekLeft, d.topDish.placesLeft);
  return `Bij de zoekopdracht ‘${dish.toLowerCase()} in ${d.city}’ staan jullie momenteel op plek ${position} van de ${total} restaurants.${places ? ` ${places}` : ""}`;
}

export const teamBullets = [
  "Openingstijden en foto’s bijwerken.",
  "Het menu aanvullen en onder ‘Bekend om’ aangeven voor welk gerecht gasten bij jullie moeten zijn.",
  "Reageren op reviews.",
  "Privéfeedback van gasten lezen die alleen voor jullie zichtbaar is.",
];

function teamPhotoLine(d: OutreachData, dish: string | null): string | null {
  if (d.hasPhoto !== false) return null;
  return `Er staat op dit moment nog geen foto op jullie pagina. Een foto van jullie ${dish ?? "mooiste gerecht"}, het interieur of het terras geeft gasten meteen een beeld van wat ze bij ${d.name} kunnen verwachten. Jullie kunnen de foto’s na het claimen zelf toevoegen of ze als antwoord op deze mail sturen. Dan zetten wij ze erop.`;
}

export const freeBullets = [
  "je openingstijden en foto's zelf bijhouden",
  "je menu aanvullen en je signature dish kiezen onder \"Bekend om\"",
  "zelf reageren op reviews",
  "privéfeedback van gasten lezen, alleen voor jou",
];

// Paid offer in two short paragraphs; the flyer and the packages page carry the full price list.
const PAID: Record<OutreachSegment, { lead: string; places: string; more: string }> = {
  zichtbaar: {
    lead: "Dat kan, maar het hoeft nooit.",
    places: "Bovenaan de gerechtpagina's in jullie stad staan 1 Topplek en 3 plekken Uitgelicht, ook bovenaan bij zoeken en op de kaart. Nemen jullie Uitgelicht uiterlijk 5 januari voor minimaal 6 maanden, dan worden jullie Founding Partner: jullie betalen €59 per maand in plaats van €99 (of €590 per jaar in plaats van €990), excl. btw, tot en met 31 december 2027. De plek staat direct live en de Founding Partner-badge blijft voor altijd op jullie pagina.",
    more: "Verder kunnen jullie met <b>Owner Pro</b> (€29 per maand) zien op welke gerechten gasten jullie vinden en hoeveel er bellen of reserveren, en zetten jullie een special of evenement op Dishloopr voor €5 per maand.",
  },
  onzichtbaar_menu: {
    lead: "Dat kan zodra je zichtbaar bent, en het hoeft nooit.",
    places: "Bovenaan de gerechtpagina's in je stad staan 1 Topplek en 3 plekken Uitgelicht, ook bovenaan bij zoeken en op de kaart. Neem je Uitgelicht uiterlijk 5 januari voor minimaal 6 maanden, dan word je Founding Partner: je betaalt €59 per maand in plaats van €99 (of €590 per jaar in plaats van €990), excl. btw, tot en met 31 december 2027. Je plek staat direct live en de Founding Partner-badge blijft voor altijd op je pagina.",
    more: "Verder kun je met <b>Owner Pro</b> (€29 per maand) zien op welke gerechten gasten jou vinden en hoeveel er bellen of reserveren, en zet je een special of evenement op Dishloopr voor €5 per maand.",
  },
};
const paidHtml = (seg: OutreachSegment) => `<p style="margin:0 0 10px"><b>Meer opvallen?</b> ${PAID[seg].lead} ${PAID[seg].places}</p><p style="margin:0 0 14px">${PAID[seg].more}</p>`;
const paidText = (seg: OutreachSegment) => `Meer opvallen? ${PAID[seg].lead} ${PAID[seg].places}\n\n${strip(PAID[seg].more)}`;

// Plain text part: drop tags, then undo escapeHtml so names read normally.
export const strip = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

const FOOTER = {
  je: { why: "Je krijgt", fix: "Dat regel je hier" },
  jullie: { why: "Jullie krijgen", fix: "Dat regelen jullie hier" },
};

export function shell(bodyHtml: string, d: OutreachData, voice: Voice = "je"): string {
  return `<!doctype html><html lang="nl"><body style="margin:0;padding:0;background:#f6f4f0">
<div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f1f1f">
${bodyHtml}
<p style="margin:28px 0 0">Met vriendelijke groet,<br>${escapeHtml(d.senderName)}<br>Dishloopr</p>
<hr style="border:none;border-top:1px solid #e4e0d8;margin:28px 0 14px">
<p style="font-size:12px;color:#77736b;margin:0">${FOOTER[voice].why} deze mail omdat ${escapeHtml(d.name)} op Dishloopr staat en dit adres openbaar op jullie website of bedrijfsprofiel staat.
Liever geen mail meer? <a href="${escapeHtml(d.unsubscribeUrl)}" style="color:#77736b">Afmelden</a>.
Gegevens laten aanpassen of verwijderen? <a href="${escapeHtml(d.optoutUrl)}" style="color:#77736b">${FOOTER[voice].fix}</a>.</p>
</div></body></html>`;
}

export const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${escapeHtml(href)}" style="background:#e8562a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${label}</a></p>`;

export const ul = (items: string[]) =>
  `<ul style="padding-left:20px;margin:8px 0 16px">${items.map((i) => `<li style="margin:4px 0">${i}</li>`).join("")}</ul>`;

export function textFooter(d: OutreachData, voice: Voice = "je"): string {
  return `\n\nMet vriendelijke groet,\n${d.senderName}\nDishloopr\n\n${FOOTER[voice].why} deze mail omdat ${d.name} op Dishloopr staat en dit adres openbaar op jullie website of bedrijfsprofiel staat.\nAfmelden: ${d.unsubscribeUrl}\nGegevens aanpassen of verwijderen: ${d.optoutUrl}\n`;
}

export function renderVisible(d: OutreachData): RenderedMail {
  const dish = d.topDish && d.city ? d.topDish.dish.toLowerCase() : null;
  const rank = rankingLine(d);
  const subject = `${d.name} staat op Dishloopr`;
  const page = d.dishCount > 0
    ? `Jullie hebben al een eigen restaurantpagina met ${d.dishCount} ${d.dishCount === 1 ? "gerecht" : "gerechten"} van jullie kaart.`
    : "Jullie hebben al een eigen restaurantpagina.";
  const found = dish
    ? `Wie in ${d.city} trek heeft in ${dish}, kan ${d.name} nu vinden op Dishloopr.`
    : d.city ? `Wie in ${d.city} uit eten wil, kan ${d.name} nu vinden op Dishloopr.` : `${d.name} is nu te vinden op Dishloopr.`;
  const example = dish
    ? `Zo kan iemand die zoekt op ‘${dish} in ${d.city}’ bij jullie uitkomen, ook als diegene ${d.name} nog niet kent.`
    : `Zo kan iemand die zoekt op een gerecht van jullie kaart bij jullie uitkomen, ook als diegene ${d.name} nog niet kent.`;
  // Plain text paragraphs; escaped once for the html part.
  const intro = [
    `Hoi team van ${d.name},`,
    `${found} ${page}`,
    `Dishloopr is een zoekmachine voor gerechten. Je vult in waar je trek in hebt en in welke stad je wilt eten. Vervolgens zie je welke restaurants dat gerecht op de kaart hebben. ${example}`,
    "Onze ambitie is dat Dishloopr in heel Nederland de plek wordt waar mensen hun zoektocht naar een restaurant beginnen met één simpele vraag: Waar heb ik trek in? Voor jullie betekent dat dat nieuwe gasten jullie kunnen ontdekken via de gerechten waar jullie goed in zijn.",
    ...(rank ? [rank] : []),
    `Op ${LAUNCH} gaan we officieel live. Claim vóór die tijd jullie pagina, zodat jullie zelf bepalen hoe ${d.name} aan gasten wordt gepresenteerd. Claimen is gratis en blijft gratis.`,
  ];
  const cta = "Claim gratis jullie restaurantpagina";
  const listLead = "Zodra jullie de pagina hebben geclaimd, kunnen jullie:";
  const photo = teamPhotoLine(d, dish);
  const html = shell(
    intro.map((p) => `<p style="margin:0 0 14px">${escapeHtml(p)}</p>`).join("") +
      button(d.inviteUrl, cta) +
      `<p style="margin:0">${listLead}</p>` + ul(teamBullets) +
      (photo ? `<p style="margin:0 0 14px">${escapeHtml(photo)}</p>` : "") +
      paidHtml("zichtbaar") +
      `<p style="margin:0 0 14px"><a href="${escapeHtml(d.pricingUrl)}" style="color:#e8562a">Bekijk alle pakketten en prijzen</a></p>` +
      flyerHtml(d, "jullie") +
      `<p style="margin:0">Vragen? Antwoord gewoon op deze mail, ik lees alles zelf.</p>`,
    d,
    "jullie",
  );
  const text = [
    ...intro,
    `${cta}: ${d.inviteUrl}`,
    `${listLead}\n${teamBullets.map((b) => `• ${b}`).join("\n")}`,
    ...(photo ? [photo] : []),
    paidText("zichtbaar"),
    `Alle pakketten en prijzen: ${d.pricingUrl}`,
    ...flyerText(d, "jullie"),
    `Vragen? Antwoord gewoon op deze mail, ik lees alles zelf.`,
  ].join("\n\n") + textFooter(d, "jullie");
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
  const photo = photoLine(d);
  const optionsText = `1. Claim je pagina en vul je menu zelf aan. Claimen is gratis. In je dashboard upload je je menukaart als pdf of voeg je gerechten toe. Zodra je op ${d.menuMinimum} gerechten staat, ben je automatisch zichtbaar.\n2. Geen tijd? Antwoord op deze mail met je menukaart. Een foto, een pdf of een link naar de kaart op je website is genoeg. Wij zetten je gerechten erin, zonder kosten, en laten je weten zodra je zichtbaar bent.`;
  const html = shell(
    paras.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("") + optionsHtml +
      button(d.claimUrl, "Claim je pagina en vul je menu aan") +
      (photo ? `<p style="margin:0 0 14px">${escapeHtml(photo)}</p>` : "") +
      `<p style="margin:0">Met een geclaimde pagina krijg je, gratis:</p>` + ul(freeBullets) +
      paidHtml("onzichtbaar_menu") +
      `<p style="margin:0 0 14px"><a href="${escapeHtml(d.pricingUrl)}" style="color:#e8562a">Bekijk alle pakketten en prijzen</a></p>` +
      flyerHtml(d) +
      `<p style="margin:0">Vragen? Antwoord gewoon op deze mail, ik lees alles zelf.</p>`,
    d,
  );
  const text = [
    ...paras.map(strip),
    optionsText,
    `Claim je pagina en vul je menu aan: ${d.claimUrl}`,
    ...(photo ? [photo] : []),
    `Met een geclaimde pagina krijg je, gratis:\n${freeBullets.map((b) => `• ${b}`).join("\n")}`,
    paidText("onzichtbaar_menu"),
    `Alle pakketten en prijzen: ${d.pricingUrl}`,
    ...flyerText(d),
    `Vragen? Antwoord gewoon op deze mail, ik lees alles zelf.`,
  ].join("\n\n") + textFooter(d);
  return { subject, html, text };
}

export function renderOutreach(segment: OutreachSegment, d: OutreachData): RenderedMail {
  return segment === "zichtbaar" ? renderVisible(d) : renderHiddenMenu(d);
}
