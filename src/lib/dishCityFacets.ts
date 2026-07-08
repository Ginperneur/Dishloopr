// Whitelisted, indexable filter facets for /eten/:slug/:facet.
// Every facet slug is globally unique across kinds so a single URL segment
// can be routed deterministically.

export type FacetKind = 'meal' | 'ambience' | 'price';

export interface FacetDef {
  slug: string;
  kind: FacetKind;
  /** Short label for chips / breadcrumbs (NL). */
  label: string;
  /** Adjective/phrase used inside the H1 title. */
  titleModifier: string;
  /** Values as stored in the database (for the matching column). */
  dbValues: string[];
}

// Meal types — restaurants.meal_types (text[])
const MEAL_FACETS: FacetDef[] = [
  { slug: 'lunch',   kind: 'meal', label: 'Lunch',   titleModifier: 'voor de lunch',   dbValues: ['lunch'] },
  { slug: 'diner',   kind: 'meal', label: 'Diner',   titleModifier: 'voor het diner',  dbValues: ['dinner'] },
  { slug: 'ontbijt', kind: 'meal', label: 'Ontbijt', titleModifier: 'voor het ontbijt', dbValues: ['breakfast'] },
  { slug: 'brunch',  kind: 'meal', label: 'Brunch',  titleModifier: 'voor de brunch',  dbValues: ['brunch'] },
];

// Ambience — restaurants.ambience_tags (text[]) — DB values are capitalized NL
const AMBIENCE_FACETS: FacetDef[] = [
  { slug: 'romantisch',      kind: 'ambience', label: 'Romantisch',      titleModifier: 'romantisch',      dbValues: ['Romantisch'] },
  { slug: 'gezellig',        kind: 'ambience', label: 'Gezellig',        titleModifier: 'gezellig',        dbValues: ['Gezellig'] },
  { slug: 'trendy',          kind: 'ambience', label: 'Trendy',          titleModifier: 'trendy',          dbValues: ['Trendy'] },
  { slug: 'modern',          kind: 'ambience', label: 'Modern',          titleModifier: 'modern',          dbValues: ['Modern'] },
  { slug: 'casual',          kind: 'ambience', label: 'Casual',          titleModifier: 'casual',          dbValues: ['Casual'] },
  { slug: 'industrieel',     kind: 'ambience', label: 'Industrieel',     titleModifier: 'industrieel',     dbValues: ['Industrieel'] },
  { slug: 'klassiek',        kind: 'ambience', label: 'Klassiek',        titleModifier: 'klassiek',        dbValues: ['Klassiek'] },
  { slug: 'traditioneel',    kind: 'ambience', label: 'Traditioneel',    titleModifier: 'traditioneel',    dbValues: ['Traditioneel'] },
  { slug: 'levendig',        kind: 'ambience', label: 'Levendig',        titleModifier: 'levendig',        dbValues: ['Levendig'] },
  { slug: 'kindvriendelijk', kind: 'ambience', label: 'Kindvriendelijk', titleModifier: 'kindvriendelijk', dbValues: ['Kindvriendelijk', 'Gezinsvriendelijk'] },
  { slug: 'warm',            kind: 'ambience', label: 'Warm',            titleModifier: 'warm',            dbValues: ['Warm'] },
  { slug: 'fine-dining',     kind: 'ambience', label: 'Fine Dining',     titleModifier: 'fine dining',     dbValues: ['Fine Dining'] },
  { slug: 'intiem',          kind: 'ambience', label: 'Intiem',          titleModifier: 'intiem',          dbValues: ['Intiem'] },
  { slug: 'minimalistisch',  kind: 'ambience', label: 'Minimalistisch',  titleModifier: 'minimalistisch',  dbValues: ['Minimalistisch'] },
  { slug: 'zakelijk',        kind: 'ambience', label: 'Zakelijk',        titleModifier: 'zakelijk',        dbValues: ['Zakelijk'] },
  { slug: 'bruisend',        kind: 'ambience', label: 'Bruisend',        titleModifier: 'bruisend',        dbValues: ['Bruisend'] },
  { slug: 'bohemian',        kind: 'ambience', label: 'Bohemian',        titleModifier: 'bohemian',        dbValues: ['Bohemian'] },
  { slug: 'luxe',            kind: 'ambience', label: 'Luxe',            titleModifier: 'luxe',            dbValues: ['Luxe', 'High-end'] },
];

// Price — restaurants.price_level (int, 1-4). Slugs disjoint from ambience.
const PRICE_FACETS: FacetDef[] = [
  { slug: 'budget',       kind: 'price', label: 'Budget (€)',        titleModifier: 'voor een budget-vriendelijke prijs', dbValues: ['1'] },
  { slug: 'middenklasse', kind: 'price', label: 'Middenklasse (€€)', titleModifier: 'in de middenklasse',                 dbValues: ['2'] },
  { slug: 'luxueus',      kind: 'price', label: 'Luxueus (€€€+)',    titleModifier: 'luxueus',                            dbValues: ['3', '4'] },
];

export const ALL_FACETS: FacetDef[] = [
  ...MEAL_FACETS,
  ...AMBIENCE_FACETS,
  ...PRICE_FACETS,
];

const FACET_BY_SLUG: Record<string, FacetDef> = ALL_FACETS.reduce((acc, f) => {
  acc[f.slug] = f;
  return acc;
}, {} as Record<string, FacetDef>);

export function getFacet(slug: string | undefined | null): FacetDef | null {
  if (!slug) return null;
  return FACET_BY_SLUG[slug.toLowerCase()] || null;
}

interface HasFacetFields {
  meal_types?: string[] | null;
  ambience_tags?: string[] | null;
  price_level?: number | null;
}

/** Returns true when the restaurant satisfies the facet filter. */
export function matchesFacet(r: HasFacetFields, facet: FacetDef): boolean {
  if (facet.kind === 'meal') {
    const arr = r.meal_types || [];
    return facet.dbValues.some(v => arr.includes(v));
  }
  if (facet.kind === 'ambience') {
    const arr = r.ambience_tags || [];
    return facet.dbValues.some(v => arr.includes(v));
  }
  if (facet.kind === 'price') {
    if (r.price_level === null || r.price_level === undefined) return false;
    return facet.dbValues.includes(String(r.price_level));
  }
  return false;
}

export const FACET_GROUPS: { kind: FacetKind; heading: string; facets: FacetDef[] }[] = [
  { kind: 'meal', heading: 'Gelegenheid', facets: MEAL_FACETS },
  { kind: 'ambience', heading: 'Sfeer', facets: AMBIENCE_FACETS },
  { kind: 'price', heading: 'Prijs', facets: PRICE_FACETS },
];

/**
 * Generates a small, deterministic FAQ tailored to a dish×city×facet page.
 * Uses the on-page count to keep answers accurate (never invents numbers).
 */
export function buildFacetFAQ(
  dishName: string,
  cityName: string,
  facet: FacetDef,
  matchCount: number,
): { question: string; answer: string }[] {
  const dish = dishName;
  const city = cityName;
  const mod = facet.titleModifier;
  const countLabel = matchCount === 1 ? '1 restaurant' : `${matchCount} restaurants`;

  const common = [
    {
      question: `Hoeveel restaurants serveren ${dish.toLowerCase()} ${mod} in ${city}?`,
      answer: `Op Dishloopr staan momenteel ${countLabel} in ${city} die ${dish.toLowerCase()} ${mod} aanbieden. De lijst wordt bijgewerkt zodra nieuwe menu's worden goedgekeurd.`,
    },
    {
      question: `Waarop is deze selectie gebaseerd?`,
      answer: `We tonen alleen restaurants in ${city} met een door de admin goedgekeurd gerecht dat overeenkomt met ${dish.toLowerCase()}. Vervolgens filteren we op ${facet.label.toLowerCase()} op basis van de eigenschappen die het restaurant zelf of onze redactie heeft opgegeven.`,
    },
  ];

  if (facet.kind === 'meal') {
    return [
      ...common,
      {
        question: `Kan ik reserveren voor ${dish.toLowerCase()} ${mod} in ${city}?`,
        answer: `Ja. Klik op een restaurant om openingstijden en reserveringsopties te bekijken. Sommige restaurants hebben directe reserveringslinks; anders bel je het restaurant via het opgegeven telefoonnummer.`,
      },
    ];
  }
  if (facet.kind === 'ambience') {
    return [
      ...common,
      {
        question: `Wat betekent "${facet.label.toLowerCase()}" bij deze selectie?`,
        answer: `Restaurants worden als "${facet.label.toLowerCase()}" getagd op basis van openbare beoordelingen, reviews en informatie van het restaurant zelf. Zo herken je snel de sfeer die bij jouw gelegenheid past.`,
      },
    ];
  }
  return [
    ...common,
    {
      question: `Wat betekent de prijscategorie "${facet.label}"?`,
      answer: `Prijscategorieën volgen de standaard € tot €€€€ notatie: € is budget-vriendelijk, €€ is middenklasse en €€€ of hoger is upscale. De categorie is gebaseerd op de gemiddelde hoofdgerechtprijs van het restaurant.`,
    },
  ];
}

