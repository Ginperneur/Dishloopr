// Checks the outreach mail templates: no em/en dashes in visible copy (compound hyphens are fine), correct prices and dates,
// escaping, unsubscribe link present, and that every segment renders.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/outreach.ts
const repo = Deno.args[0] ?? Deno.cwd();
const { renderOutreach } = await import(`file://${repo}/supabase/functions/_shared/outreach/templates.ts`);

const base = {
  name: "Trattoria <Da Mario>", city: "Utrecht", dishCount: 24,
  topDish: { dish: "Carbonara", position: 7, total: 14 },
  inviteUrl: "https://dishloopr.com/voor-restaurants/trattoria-da-mario?utm_source=outreach",
  pricingUrl: "https://dishloopr.com/voor-restaurants/pakketten",
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
  const m = renderOutreach(segment, base);
  check(`${segment}: no em/en dashes in subject or text`, !/[–—]/.test(m.subject + visible(m.text)));
  check(`${segment}: html escapes name`, m.html.includes("Trattoria &lt;Da Mario&gt;") && !m.html.includes("<Da Mario>"));
  check(`${segment}: unsubscribe link`, m.html.includes(base.unsubscribeUrl) && m.text.includes(base.unsubscribeUrl));
  check(`${segment}: Founding Partner terms`, ["€59", "€99", "€590", "€990", "5 januari", "minimaal 6 maanden", "31 december 2027"].every((s) => m.text.includes(s)));
  check(`${segment}: no stale launch date`, !/10 december/.test(m.text));
  check(`${segment}: Uitgelicht is the package name`, m.text.includes("Uitgelicht"));
}
const v = renderOutreach("zichtbaar", base);
check("zichtbaar: ranking line", v.text.includes("Bij de zoekopdracht ‘carbonara in Utrecht’ staan jullie momenteel op plek 7 van de 14 restaurants."));
check("zichtbaar: owner intro", v.text.includes("Wie in Utrecht trek heeft in carbonara, kan Trattoria <Da Mario> nu vinden op Dishloopr.") && v.text.includes("Dishloopr is een zoekmachine voor gerechten.") && v.text.includes("Claim gratis jullie restaurantpagina"));
check("zichtbaar: claim button", v.html.includes(base.inviteUrl));
const h = renderOutreach("onzichtbaar_menu", { ...base, dishCount: 2 });
check("onzichtbaar: states the rule", h.text.includes("minimaal 5 gerechten") && h.text.includes("Van jouw kaart kennen we er nu 2.") && h.text.includes("minimale vereisten"));
check("onzichtbaar: opens with name", h.text.startsWith("Hoi Trattoria <Da Mario>,\n\nTrattoria <Da Mario> staat op Dishloopr.\n"));
check("onzichtbaar: claim option with link", h.html.includes(base.claimUrl) && /Claim je pagina en vul je menu zelf aan/.test(h.text));
check("onzichtbaar: reply option", /Antwoord op deze mail met je menukaart/.test(h.text));
check("onzichtbaar: zero dishes wording", renderOutreach("onzichtbaar_menu", { ...base, dishCount: 0 }).text.includes("Van jouw kaart kennen we er nog geen."));
check("zichtbaar: greeting with name", v.text.startsWith("Hoi team van Trattoria <Da Mario>,"));
for (const seg of ["zichtbaar", "onzichtbaar_menu"]) {
  const url = "https://x.supabase.co/storage/v1/object/public/marketing/outreach/dishloopr-flyer.pdf";
  const withFlyer = renderOutreach(seg, { ...base, flyer: { mode: "attachment", url } });
  const flyerLine = seg === "zichtbaar" ? "In de bijlage vinden jullie onze flyer" : "In de bijlage vind je onze flyer";
  check(`${seg}: mentions attached flyer`, withFlyer.text.includes(flyerLine) && withFlyer.html.includes(flyerLine) && !/[–—]/.test(visible(withFlyer.text)));
  const linked = renderOutreach(seg, { ...base, flyer: { mode: "link", url } });
  check(`${seg}: link mode offers download`, linked.html.includes(`href="${url}"`) && linked.text.includes(`Download onze flyer (pdf): ${url}`) && !linked.text.includes("bijlage"));
  check(`${seg}: no flyer line without attachment`, !renderOutreach(seg, base).text.includes("bijlage"));
}
for (const m of [v, h]) check("signature", m.text.includes("Met vriendelijke groet,\nGinuwine Ayanne\nDishloopr") && m.html.includes("Met vriendelijke groet,<br>Ginuwine Ayanne<br>Dishloopr"));
const scarce = renderOutreach("zichtbaar", { ...base, topDish: { dish: "Carbonara", position: 7, total: 14, placesLeft: 2 } });
check("places left mentioned", scarce.text.includes("Voor die zoekopdracht zijn nog twee van de drie plekken onder ‘Uitgelicht’ beschikbaar."));
const both = renderOutreach("zichtbaar", { ...base, topDish: { dish: "Carbonara", position: 7, total: 14, placesLeft: 1, topplekLeft: 1 } });
check("topplek and uitgelicht free", both.text.includes("Voor die zoekopdracht zijn de Topplek en één van de drie plekken onder ‘Uitgelicht’ nog beschikbaar."));
const topOnly = renderOutreach("zichtbaar", { ...base, topDish: { dish: "Carbonara", position: 7, total: 14, placesLeft: 0, topplekLeft: 1 } });
check("only topplek free", topOnly.text.includes("Voor die zoekopdracht is de Topplek nog beschikbaar."));
for (const seg of ["zichtbaar", "onzichtbaar_menu"]) check(`${seg}: names Topplek and 3 Uitgelicht`, renderOutreach(seg, base).text.includes("1 Topplek en 3 plekken Uitgelicht") && !renderOutreach(seg, base).text.includes("5 restaurants per"));
const full = renderOutreach("zichtbaar", { ...base, topDish: { dish: "Carbonara", position: 7, total: 14, placesLeft: 0 } });
check("no places line when full", !full.text.includes("Voor die zoekopdracht"));
const noRank = renderOutreach("zichtbaar", { ...base, topDish: null, dishCount: 0 });
check("zichtbaar: renders without ranking or dishes", !noRank.text.includes("staan jullie momenteel op plek") && noRank.text.includes("een gerecht van jullie kaart") && !noRank.text.includes(" 0 gerechten"));
const PHOTO_ASK: Record<string, string> = { zichtbaar: "Er staat op dit moment nog geen foto op jullie pagina.", onzichtbaar_menu: "Je pagina heeft nog geen foto" };
for (const seg of ["zichtbaar", "onzichtbaar_menu"]) {
  const noPhoto = renderOutreach(seg, { ...base, hasPhoto: false });
  check(`${seg}: asks for photos without a photo`, noPhoto.text.includes(PHOTO_ASK[seg]) && noPhoto.html.includes(PHOTO_ASK[seg]));
  check(`${seg}: photo ask is specific`, seg === "zichtbaar" ? noPhoto.text.includes("Een foto van jullie carbonara") : noPhoto.text.includes("als gasten in Utrecht kijken"));
  check(`${seg}: photo ask has no em/en dashes`, !/[–—]/.test(visible(noPhoto.text)));
  check(`${seg}: no photo ask with a photo`, !renderOutreach(seg, { ...base, hasPhoto: true }).text.includes("nog geen foto"));
  check(`${seg}: no photo ask when unknown`, !renderOutreach(seg, base).text.includes("nog geen foto"));
}
// Mail A addresses the team throughout; mail B keeps je.
const team = renderOutreach("zichtbaar", { ...base, hasPhoto: false, flyer: { mode: "link", url: "https://x/f.pdf" } });
check("zichtbaar: no je-vorm left", !/\b(je|jij|jou|jouw|kun|neem|word)\b/i.test(visible(team.text).replace(/Je vult in waar je trek in hebt en in welke stad je wilt eten\. Vervolgens zie je/, "")));
check("zichtbaar: jullie footer", team.text.includes("Jullie krijgen deze mail") && team.html.includes("Dat regelen jullie hier"));
check("onzichtbaar: keeps je footer", renderOutreach("onzichtbaar_menu", base).text.includes("Je krijgt deze mail"));
Deno.exit(ok ? 0 : 1);
