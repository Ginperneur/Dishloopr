// Sfeerbeeld: the stand-in for a restaurant without its own photo.
//
// Abstract, out-of-focus light in the colours of the cuisine, never a recognisable interior or dish,
// and always labelled "Sfeerbeeld", so guests are not misled. It is drawn from the restaurant id,
// so a restaurant keeps the same image and neighbouring cards never look alike. A sfeerbeeld is
// not a photo: browseOrder still gives the photo score only to real images.

export type MoodTheme =
  | 'italiaans' | 'vis' | 'aziatisch' | 'kruiden' | 'zuiden' | 'grill' | 'eetcafe' | 'groen' | 'neutraal';

interface ThemeColours {
  /** Background gradient stops: dark, mid, dark. */
  base: [string, string, string];
  /** Colours of the blurred lights. */
  lights: string[];
}

export const MOOD_THEMES: Record<MoodTheme, ThemeColours> = {
  italiaans: { base: ['#3b1709', '#7a3414', '#2a1006'], lights: ['#ffb347', '#ff8a3d', '#ffd27a', '#ff6b3d'] },
  vis:       { base: ['#0b2730', '#18505c', '#08212a'], lights: ['#7fe0e8', '#c9f4f2', '#4fb6c9', '#ffe7b0'] },
  aziatisch: { base: ['#2a0b10', '#6b1520', '#1c070b'], lights: ['#ff5a5f', '#ffb36b', '#ff8f6b', '#ffd9a0'] },
  kruiden:   { base: ['#2a1606', '#6e3d0c', '#1d0f04'], lights: ['#ffc04d', '#ff9a2e', '#ffe08a', '#e8742a'] },
  zuiden:    { base: ['#2c0f1c', '#6d2440', '#1e0a13'], lights: ['#ff8fa3', '#ffc36b', '#ff6f61', '#ffe2a8'] },
  grill:     { base: ['#1d1010', '#4a1d12', '#140a08'], lights: ['#ff7a2f', '#ffb02e', '#ff4f2e', '#ffd36b'] },
  eetcafe:   { base: ['#2b1d10', '#5e4022', '#1f150b'], lights: ['#ffcf7a', '#f6a84b', '#fff0c2', '#e98a3a'] },
  groen:     { base: ['#0f2416', '#2b5132', '#0a1a0f'], lights: ['#c8f08f', '#ffe9a8', '#8fd694', '#f6c46b'] },
  neutraal:  { base: ['#241a14', '#4f3a2c', '#1a120d'], lights: ['#ffe2b0', '#f7c27a', '#fff5dc', '#d99c5a'] },
};

// Many restaurants have no cuisine yet. These palettes say nothing about the kitchen; they only keep
// a list of such restaurants from looking like one repeated image. Picked per restaurant from the seed.
const NEUTRAL_VARIANTS: ThemeColours[] = [
  MOOD_THEMES.neutraal,
  { base: ['#14201f', '#2f4744', '#0e1716'], lights: ['#ffe6b8', '#f2b872', '#d8f0e6', '#c98d55'] },
  { base: ['#22141f', '#4a2b40', '#170d15'], lights: ['#ffd9b0', '#f5a97a', '#ffeedd', '#d98a8a'] },
];

// Cuisine values as stored in the database (src/lib/i18n/taxonomy.ts), lower-cased.
const CUISINE_THEME: Record<string, MoodTheme> = {
  italiaans: 'italiaans', pizza: 'italiaans', mediterraans: 'italiaans',
  'vis & zeevruchten': 'vis',
  chinees: 'aziatisch', aziatisch: 'aziatisch', japans: 'aziatisch', sushi: 'aziatisch', ramen: 'aziatisch',
  thais: 'aziatisch', vietnamees: 'aziatisch', koreaans: 'aziatisch', 'dim sum': 'aziatisch', kantonees: 'aziatisch',
  indonesisch: 'aziatisch', surinaams: 'kruiden',
  indiaas: 'kruiden', 'midden-oosters': 'kruiden', libanees: 'kruiden', marokkaans: 'kruiden',
  afghaans: 'kruiden', ethiopisch: 'kruiden', turks: 'kruiden',
  spaans: 'zuiden', tapas: 'zuiden', mexicaans: 'zuiden', peruaans: 'zuiden', caribisch: 'zuiden',
  grieks: 'zuiden', braziliaans: 'zuiden',
  steakhouse: 'grill', burger: 'grill', bbq: 'grill', amerikaans: 'grill', argentijns: 'grill',
  nederlands: 'eetcafe', bistro: 'eetcafe', brasserie: 'eetcafe', gastropub: 'eetcafe', frans: 'eetcafe',
  veganistisch: 'groen', vegetarisch: 'groen',
};

/** Theme from the primary cuisine, else the first known one in the list; unknown falls back to neutraal. */
export function moodTheme(cuisinePrimary?: string | null, cuisines?: string[] | null): MoodTheme {
  for (const c of [cuisinePrimary, ...(cuisines ?? [])]) {
    const theme = c ? CUISINE_THEME[c.trim().toLowerCase()] : undefined;
    if (theme) return theme;
  }
  return 'neutraal';
}

/** 32-bit FNV-1a, the same hash family as browseOrder's daily jitter. */
function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Small deterministic generator (mulberry32). */
function generator(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LIGHTS = 14;

/**
 * CSS background for a sfeerbeeld: soft radial lights over the theme gradient.
 * Pure CSS gradients (no blur filter), so dozens of cards stay cheap to paint.
 */
export function moodBackground(seed: string, theme: MoodTheme): string {
  const seedHash = hash(seed);
  const { base, lights } = theme === 'neutraal' ? NEUTRAL_VARIANTS[seedHash % NEUTRAL_VARIANTS.length] : MOOD_THEMES[theme];
  const next = generator(seedHash);
  const layers: string[] = [];
  for (let i = 0; i < LIGHTS; i++) {
    const x = Math.round(next() * 100);
    const y = Math.round(next() * 90);
    const size = Math.round(8 + next() * 16);           // % of the box
    const colour = lights[Math.floor(next() * lights.length)];
    const alpha = Math.round((0.35 + next() * 0.5) * 255).toString(16).padStart(2, '0');
    layers.push(`radial-gradient(circle at ${x}% ${y}%, ${colour}${alpha} 0%, ${colour}00 ${size}%)`);
  }
  layers.push(`linear-gradient(160deg, ${base[0]}, ${base[1]} 60%, ${base[2]})`);
  return layers.join(', ');
}
