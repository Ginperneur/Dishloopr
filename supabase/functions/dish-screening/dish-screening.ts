// dish-screening.ts — Dishloopr gerecht-screening (port van de getunede no-api pipeline)
// Self-contained, Deno-compatible. Geen externe dependencies.
// Gebruik: screenDish(slug, name, trustedVocab) -> { decision, canonicalSlug, course, score, reason }
// trustedVocab = Set van canonical_slug's uit reeds-goedgekeurde dishes (live uit DB).

export type Decision = "approve" | "reject" | "review";
export interface ScreenResult { decision: Decision; canonicalSlug: string; course: string; score: number; reason: string; }

// ---------- DROP: generieke menu-/rubriekstructuur ----------
const DROP_EXACT = new Set<string>(["all-you-can-eat","allyoucaneat","bijgerecht","bijgerechten","breakfast","brunch","chef-s-menu","chefs-menu","dagmenu","dagspecial","dagspecials","diner","dinermenu","dinner","extra","extras","hoofdgerecht","hoofdgerechten","hoofdgerechten-vis","hoofdgerechten-vlees","kids","kids-menu","kinder-menu","kinderen","kindermenu","kindermenu-s","lunch","lunchgerechten","lunchmenu","menu","onbeperkt","ontbijt","proeverij","set-menu","shared-menu","sharing-menu","side","sides","special","specials","supplement","supplementen","tasting-menu","tussengerecht","tussengerechten","voorgerecht","voorgerechten","weekmenu"]);
const DROP_PATTERNS: RegExp[] = [/^menu(-|$)/, /-menu$/, /^dag(menu|special)/, /^keuze-/, /^selectie-/, /^assortiment/, /^diverse-/, /-gangen(-|$)/];
function isDrop(slug: string): boolean {
  if (DROP_EXACT.has(slug)) return true;
  return DROP_PATTERNS.some((re) => re.test(slug));
}

// ---------- HERO: curated canonieke gerechten ----------
const HERO: [string, string[]][] = [
  ["churros", ["churros"]],
  ["pizza-margherita", ["margherita","margerita"]],
  ["pizza-quattro-formaggi", ["quattro-formaggi","4-formaggi","quattro-stagioni"]],
  ["pizza-diavola", ["diavola"]],
  ["pizza", ["pizza"]],
  ["carbonara", ["carbonara"]],
  ["spaghetti-bolognese", ["bolognese","bolognaise"]],
  ["lasagne", ["lasagne","lasagna"]],
  ["ravioli", ["ravioli"]],
  ["gnocchi", ["gnocchi"]],
  ["risotto", ["risotto"]],
  ["tiramisu", ["tiramisu","tiramisù"]],
  ["burrata", ["burrata"]],
  ["vitello-tonnato", ["vitello-tonnato","vitello"]],
  ["carpaccio", ["carpaccio"]],
  ["bruschetta", ["bruschetta"]],
  ["focaccia", ["focaccia"]],
  ["tonkotsu-ramen", ["tonkotsu"]],
  ["ramen", ["ramen"]],
  ["sushi", ["sushi"]],
  ["sashimi", ["sashimi"]],
  ["nigiri", ["nigiri"]],
  ["maki", ["maki-roll","maki"]],
  ["poke-bowl", ["poke-bowl","pokebowl","poke"]],
  ["gyoza", ["gyoza","gyoza-s"]],
  ["edamame", ["edamame"]],
  ["bao-bun", ["bao-bun","baobun","bao-buns","bao"]],
  ["dumplings", ["dumpling","dumplings","dim-sum","dimsum"]],
  ["pad-thai", ["pad-thai","padthai"]],
  ["tom-yum", ["tom-yum","tom-yam"]],
  ["green-curry", ["groene-curry","green-curry"]],
  ["rendang", ["rendang"]],
  ["nasi-goreng", ["nasi-goreng","nasi"]],
  ["bami-goreng", ["bami-goreng","bami","mie-goreng"]],
  ["satay", ["sate","saté","satay"]],
  ["bibimbap", ["bibimbap"]],
  ["bulgogi", ["bulgogi"]],
  ["peking-eend", ["peking-eend","peking-duck","pekingeend"]],
  ["spring-rolls", ["loempia","loempia-s","spring-roll","spring-rolls","voorjaarsrol"]],
  ["dim-sum", ["dim-sum"]],
  ["hamburger", ["hamburger","cheeseburger","beef-burger","burger"]],
  ["club-sandwich", ["club-sandwich","clubsandwich"]],
  ["hot-dog", ["hot-dog","hotdog"]],
  ["spare-ribs", ["spare-ribs","spareribs","ribs"]],
  ["chicken-wings", ["chicken-wings","kippenvleugels","wings"]],
  ["nachos", ["nachos"]],
  ["quesadilla", ["quesadilla"]],
  ["taco", ["tacos","taco-s","taco"]],
  ["burrito", ["burrito"]],
  ["fajita", ["fajita","fajitas"]],
  ["ceviche", ["ceviche"]],
  ["steak-tartaar", ["steak-tartaar","steak-tartare","filet-americain","biefstuk-tartaar"]],
  ["entrecote", ["entrecote","entrecôte"]],
  ["ossenhaas", ["ossenhaas","ossehaas"]],
  ["biefstuk", ["biefstuk","steak"]],
  ["coq-au-vin", ["coq-au-vin"]],
  ["bouillabaisse", ["bouillabaisse"]],
  ["creme-brulee", ["creme-brulee","crème-brûlée","cremebrulee"]],
  ["escargots", ["escargot","escargots","slakken"]],
  ["foie-gras", ["foie-gras"]],
  ["quiche", ["quiche"]],
  ["oesters", ["oester","oesters","oyster","oysters"]],
  ["mosselen", ["mossel","mosselen","moules"]],
  ["garnalen", ["garnalen","gamba","gamba-s","gambas","scampi","scampi-s"]],
  ["bitterballen", ["bitterbal","bitterballen"]],
  ["kroket", ["kroket","kroketten"]],
  ["kibbeling", ["kibbeling"]],
  ["friet", ["friet","frieten","patat","frites","fries"]],
  ["tosti", ["tosti","tosti-s"]],
  ["uitsmijter", ["uitsmijter"]],
  ["pannenkoek", ["pannenkoek","pannenkoeken","pancake","pancakes"]],
  ["poffertjes", ["poffertjes"]],
  ["wentelteefjes", ["wentelteefjes","french-toast"]],
  ["erwtensoep", ["erwtensoep","snert"]],
  ["tomatensoep", ["tomatensoep"]],
  ["stamppot", ["stamppot","boerenkool","hutspot"]],
  ["falafel", ["falafel"]],
  ["hummus", ["hummus","houmous"]],
  ["shoarma", ["shoarma","shawarma","shawarma"]],
  ["kapsalon", ["kapsalon"]],
  ["kebab", ["kebab"]],
  ["couscous", ["couscous"]],
  ["tajine", ["tajine","tagine"]],
  ["mezze", ["mezze","meze"]],
  ["baklava", ["baklava"]],
  ["butter-chicken", ["butter-chicken"]],
  ["tikka-masala", ["tikka-masala","chicken-tikka","tikka"]],
  ["curry", ["curry","kerrie"]],
  ["naan", ["naan"]],
  ["samosa", ["samosa","samosas"]],
  ["tandoori", ["tandoori"]],
  ["cheesecake", ["cheesecake"]],
  ["brownie", ["brownie","brownies"]],
  ["appeltaart", ["appeltaart","appelgebak","apple-pie"]],
  ["dame-blanche", ["dame-blanche"]],
  ["acai-bowl", ["acai-bowl","acai","açai"]],
  ["avocado-toast", ["avocado-toast","avocadotoast"]],
  ["eggs-benedict", ["eggs-benedict","egg-benedict"]],
  ["croissant", ["croissant"]],
  ["wafel", ["wafel","wafels","waffle","waffles"]]
];
function heroMatch(slug: string): string | null {
  const parts = slug.split("-");
  const head = new Set(parts.slice(0, 2));
  const short = parts.length <= 3;
  for (const [canonical, keys] of HERO) {
    for (const k of keys) {
      if (k.includes("-")) { if (slug.startsWith(k) || (slug.includes(k) && short)) return canonical; }
      else { if (head.has(k) || (parts.includes(k) && short)) return canonical; }
    }
  }
  return null;
}

// ---------- STRIP: rand-woorden weghalen ----------
const STRIP_WORDS = new Set<string>(["ambachtelijke","authentiek","authentieke","bio","biologische","de","een","grote","heerlijke","het","huis-gemaakte","huisgemaakt","huisgemaakte","klassiek","klassieke","kleine","lekkere","luxe","mini","onze","onze-eigen","origineel","originele","signature","speciale","the","traditioneel","traditionele","verrukkelijke","vers","verse","zelfgemaakt","zelfgemaakte"]);
const COOK_PREFIX = new Set<string>(["gebakken","gefrituurd","gefrituurde","gegrild","gegrilde","gekonfijte","gemarineerde","gepaneerde","gepocheerde","gerookt","gerookte","geroosterd","geroosterde","gestoofde","gestoomde"]);
function stripEdges(slug: string): string {
  let toks = slug.split("-");
  while (toks.length && (STRIP_WORDS.has(toks[0]) || COOK_PREFIX.has(toks[0]))) toks = toks.slice(1);
  while (toks.length && STRIP_WORDS.has(toks[toks.length - 1])) toks = toks.slice(0, -1);
  return toks.length ? toks.join("-") : slug;
}
function canonOf(slug: string): string {
  const h = heroMatch(slug);
  if (h) return h;
  const st = stripEdges(slug);
  return st && st !== slug ? st : slug;
}

// ---------- JUNK-filter (scrape-rommel) ----------
const BOILER = /(privacy|cookie|contact|nieuwsbrief|\brechten\b|voorwaarden|betaling|overeenkomst|\bhotel\b|reserver|marketing|persoonsgegeven|gegevens|website|allergie|meld het ons|title|http|www|@|©|®|\{|\}|disclaimer|algemene|aansprakelijk|klacht|openingstijd|volg ons|webshop)/i;
const PRICE = /(€|\beuro\b|\bp\.?p\.?\b|\bpersonen\b|\d+[.,]\d{2}|\bvanaf\b|\bincl\b|\bexcl\b)/i;
const NUMLIST = /\d+\s*\.\s*\D/;
const STRUCT = new Set<string>(["bijgerecht","bijgerechten","breakfast","brunch","contactgegevens","dagmenu","diner","dinner","hoofdgerecht","hoofdgerechten","kindermenu","lunch","menu","ontbijt","sandwiches-bowls-soep","specials","title","title-free","tussengerecht","voorgerecht","voorgerechten"]);
const BAD_END = [".", ";", ":", ",", ")"];
function countNonLatin(s: string): number { let n = 0; for (const ch of s) if (ch.codePointAt(0)! > 0x17f) n++; return n; }

// junk-reden, of null als het door de filter komt
function junkReason(slug: string, name: string): string | null {
  const toks = slug.split("-");
  if (name.length > 38) return "te-lang";
  if (toks.length > 5) return "te-veel-woorden";
  if (BOILER.test(name)) return "website-tekst";
  if (PRICE.test(name)) return "prijs/pp";
  if (NUMLIST.test(name)) return "genummerde-lijst";
  if (countNonLatin(name) >= 2) return "niet-latijns";
  if (STRUCT.has(slug)) return "structuur-header";
  if (isDrop(slug)) return "generiek/menu";
  if (name === name.toUpperCase() && toks.length > 1 && !heroMatch(slug)) return "allcaps-merk/header";
  if (slug.length < 3) return "te-kort";
  const trimmed = name.trim();
  if (BAD_END.some((e) => trimmed.endsWith(e))) return "zin-fragment";
  if (/\d{4}/.test(name)) return "postcode/jaartal";
  return null;
}

// ---------- COURSE-indeling ----------
const COURSE_BY: Record<string, string> = {"churros":"nagerecht", "tiramisu":"nagerecht", "cheesecake":"nagerecht", "brownie":"nagerecht", "appeltaart":"nagerecht", "dame-blanche":"nagerecht", "creme-brulee":"nagerecht", "baklava":"nagerecht", "poffertjes":"nagerecht", "wafel":"nagerecht", "carpaccio":"voorgerecht", "burrata":"voorgerecht", "vitello-tonnato":"voorgerecht", "bruschetta":"voorgerecht", "sashimi":"voorgerecht", "gyoza":"voorgerecht", "bao-bun":"voorgerecht", "dumplings":"voorgerecht", "dim-sum":"voorgerecht", "spring-rolls":"voorgerecht", "ceviche":"voorgerecht", "escargots":"voorgerecht", "foie-gras":"voorgerecht", "oesters":"voorgerecht", "hummus":"voorgerecht", "mezze":"voorgerecht", "samosa":"voorgerecht", "tom-yum":"voorgerecht", "steak-tartaar":"voorgerecht", "wentelteefjes":"voorgerecht", "erwtensoep":"voorgerecht", "tomatensoep":"voorgerecht", "bitterballen":"borrel", "kroket":"borrel", "kibbeling":"borrel", "chicken-wings":"borrel", "nachos":"borrel", "edamame":"borrel", "friet":"bijgerecht", "focaccia":"bijgerecht", "naan":"bijgerecht", "croissant":"bijgerecht"};
const COURSE_KW: [string, string[]][] = [
  ["drank", ["koffie","thee","cappuccino","latte","espresso","cocktail","cocktails","mojito","spritz","aperol","frisdrank","cola","sapje","smoothie","milkshake","wijn","bier","limonade","matcha","prosecco","champagne","sap","rose","flat-white","macchiato","chai-latte"]],
  ["nagerecht", ["dessert","desserts","nagerecht","nagerechten","dolci","toetje","tiramisu","cheesecake","brownie","ijs","sorbet","gebak","taart","mousse","churros","baklava","wafel","cookie","cake","donut","soes","pudding","kinderijsje"]],
  ["borrel", ["bitterbal","borrel","kroket","frikandel","nacho","kaassouffle","hapjes","plankje"]],
  ["voorgerecht", ["voorgerecht","soep","soepen","soup","carpaccio","oester","ceviche","bruschetta","antipasti","burrata","tartaar","amuse","hummus","salade","salades","loempia","gyoza","edamame","uiensoep"]],
  ["bijgerecht", ["friet","patat","frites","fries","stokbrood","naan","rijst","groente","bijgerecht","focaccia","brood","zuurdesembrood","sauzen","saus","mayonaise","pepersaus"]]
];
function courseOf(canon: string): string {
  if (!canon) return "";
  if (COURSE_BY[canon]) return COURSE_BY[canon];
  if (["toetje", "dessert", "gebak", "pudding"].some((h) => canon.includes(h))) return "nagerecht";
  const parts = new Set(canon.split("-"));
  for (const [course, kws] of COURSE_KW) {
    for (const k of kws) { if ((k.includes("-") && canon.includes(k)) || parts.has(k)) return course; }
  }
  return "hoofdgerecht";
}

// ---------- HOOFD-FUNCTIE ----------
// trustedVocab: canonical_slug's van reeds-goedgekeurde dishes (groeit mee).
// Drempels: >=0.9 auto-approve, junk -> auto-reject, daartussen -> review.
export function screenDish(slug: string, name: string, trustedVocab: Set<string>): ScreenResult {
  const reason = junkReason(slug, name);
  if (reason) return { decision: "reject", canonicalSlug: "", course: "", score: 0, reason };
  const canon = canonOf(slug);
  const course = courseOf(canon);
  const isHero = heroMatch(slug) !== null;
  const inVocab = trustedVocab.has(canon);
  if (isHero || inVocab) {
    return { decision: "approve", canonicalSlug: canon, course, score: 0.95,
      reason: isHero ? "hero-gerecht" : "in-gevet-vocabulaire" };
  }
  // schoon ogend, maar onbekend -> handmatige review met voorgestelde canonical/course
  return { decision: "review", canonicalSlug: canon, course, score: 0.6, reason: "onbekend-maar-schoon" };
}
