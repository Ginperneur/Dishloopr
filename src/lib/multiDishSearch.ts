/**
 * Zoeken op meerdere gerechten tegelijk ("biefstuk en garnalen").
 *
 * Restaurants die alle gezochte gerechten hebben komen altijd eerst; daarna
 * volgen restaurants met een deel ervan, gegroepeerd op hoeveel gerechten ze
 * dekken. Pure helpers zodat zoekhook, zoekpagina en tests dezelfde regels
 * gebruiken.
 */

// Woorden/tekens die twee gerechten verbinden: "biefstuk en garnalen",
// "steak and shrimp", "sushi & ramen", "pizza + pasta".
const CONNECTOR_SPLIT = /\s+(?:en|and)\s+|\s*[&+]\s*/i;
const CONNECTOR_TEST = /\s(?:en|and)\s|[&+]/i;

// Gerechtnamen die zelf een verbindingswoord bevatten en nooit gesplitst
// mogen worden. Aanvullend controleert de zoekhook de gerechtentabel.
const COMPOUND_DISHES = [
  'fish and chips',
  'fish & chips',
  'fish n chips',
  'surf and turf',
  'surf & turf',
  'mac and cheese',
  'mac & cheese',
  'zoet en zuur',
  'salt and pepper',
  'salt & pepper',
  'bread and butter',
  'bubble and squeak',
  'pie and mash',
  'pie & mash',
  'bangers and mash',
  'bangers & mash',
];

const normalize = (s: string) =>
  s.toLowerCase().replace(/\s*([&+])\s*/g, ' $1 ').replace(/\s+/g, ' ').trim();

/** Bevat dit deel een verbindingswoord tussen twee gerechten? */
export function hasDishConnector(part: string): boolean {
  return CONNECTOR_TEST.test(normalize(part));
}

/** Is dit (een deel van) een bekende samengestelde gerechtnaam? */
export function isCompoundDishPhrase(part: string): boolean {
  const p = normalize(part);
  return COMPOUND_DISHES.some(d => p.includes(d));
}

/**
 * Splitst een zoekopdracht in losse gerechten: eerst op komma's, daarna op
 * "en" / "and" / "&" / "+". Delen die een bekende gerechtnaam zijn (zoals
 * "fish and chips") blijven heel. `keepWhole` laat de aanroeper extra delen
 * heel houden, bijvoorbeeld na een controle in de gerechtentabel.
 * Resultaat is in kleine letters, zonder lege of dubbele termen.
 */
export function splitDishQuery(
  query: string,
  keepWhole: (part: string) => boolean = () => false,
): string[] {
  const terms: string[] = [];
  for (const rawPart of normalize(query).split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const pieces =
      hasDishConnector(part) && !isCompoundDishPhrase(part) && !keepWhole(part)
        ? part.split(CONNECTOR_SPLIT)
        : [part];
    for (const piece of pieces) {
      const t = piece.trim();
      if (t && !terms.includes(t)) terms.push(t);
    }
  }
  return terms;
}

/** Aantal gezochte gerechten dat een resultaat dekt (minimaal 1 bij een treffer). */
export function coverageOf(r: { matchedTerms?: string[] }): number {
  return r.matchedTerms?.length ?? 0;
}

/**
 * Stabiele sortering: meeste gedekte gerechten eerst, binnen een groep de
 * volgorde van `compare` (of de bestaande volgorde).
 */
export function sortByCoverage<T extends { matchedTerms?: string[] }>(
  items: T[],
  compare: (a: T, b: T) => number = () => 0,
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) =>
      coverageOf(b.item) - coverageOf(a.item) ||
      compare(a.item, b.item) ||
      a.index - b.index,
    )
    .map(x => x.item);
}

export interface CoverageGroup<T> {
  /** Aantal gezochte gerechten dat elk restaurant in deze groep heeft. */
  covered: number;
  items: T[];
}

/**
 * Deelt een (al op dekking gesorteerde) lijst op in opeenvolgende groepen met
 * dezelfde dekking, in de volgorde waarin ze voorkomen.
 */
export function groupByCoverage<T extends { matchedTerms?: string[] }>(items: T[]): CoverageGroup<T>[] {
  const groups: CoverageGroup<T>[] = [];
  for (const item of items) {
    const covered = coverageOf(item);
    const last = groups[groups.length - 1];
    if (last && last.covered === covered) last.items.push(item);
    else groups.push({ covered, items: [item] });
  }
  return groups;
}

/** Eerste letter als hoofdletter, voor gerechtnamen in koppen. */
export function capitalizeTerm(term: string): string {
  return term ? term.charAt(0).toUpperCase() + term.slice(1) : term;
}
