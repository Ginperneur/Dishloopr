// Decides whether an owner's new address can be applied without an admin: the address must exist
// in the official Dutch address register (PDOK / BAG), match what the owner typed (street and house
// number, and letter or addition if given), lie in the restaurant's own city (or a place that
// belongs to it), and not move the pin more than a few kilometres. Anything else goes to an admin.

export interface PdokDoc {
  weergavenaam: string; straatnaam?: string; huisnummer?: number; huisletter?: string; huisnummertoevoeging?: string;
  postcode?: string; woonplaatsnaam?: string; gemeentenaam?: string; centroide_ll?: string;
}

export interface AddressDecision {
  auto: boolean;
  reason: string;
  address?: string;
  lat?: number;
  lng?: number;
}

const OFFICIAL: Record<string, string[]> = {
  "den haag": ["'s-gravenhage", "s-gravenhage"],
  "den bosch": ["'s-hertogenbosch", "s-hertogenbosch"],
  "'s-hertogenbosch": ["den bosch"],
};

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
const streetKey = (s: string) => norm(s).replace(/straat$/, "str").replace(/[^a-z0-9]/g, "");

/** "Ginnekenweg 90-B1, 4818 JH Breda" -> street, number, addition. */
export function parseTyped(input: string): { street: string; number: number; addition: string } | null {
  const first = input.split(",")[0].trim();
  const m = first.match(/^(.+?)\s+(\d{1,5})\s*[- ]?\s*([a-zA-Z0-9]{0,4})$/);
  if (!m) return null;
  return { street: m[1], number: Number(m[2]), addition: (m[3] ?? "").toUpperCase() };
}

export function pointOf(doc: PdokDoc): { lat: number; lng: number } | null {
  const m = doc.centroide_ll?.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
  return m ? { lng: Number(m[1]), lat: Number(m[2]) } : null;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (x: number) => (x * Math.PI) / 180;
  const d = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(d));
}

export function decideAddress(input: {
  typed: string;
  doc: PdokDoc | null;
  cityNames: string[];          // the restaurant's city and its aliases
  current?: { lat: number; lng: number } | null;
  maxMoveKm?: number;
}): AddressDecision {
  const { typed, doc, cityNames, current, maxMoveKm = 10 } = input;
  if (!doc) return { auto: false, reason: "Adres niet gevonden in het adresregister" };
  const t = parseTyped(typed);
  if (!t) return { auto: false, reason: "Straat en huisnummer niet herkend" };
  if (!doc.straatnaam || streetKey(doc.straatnaam) !== streetKey(t.street)) return { auto: false, reason: `Straat wijkt af van het register (${doc.weergavenaam})` };
  if (doc.huisnummer !== t.number) return { auto: false, reason: `Huisnummer wijkt af van het register (${doc.weergavenaam})` };
  const regAdd = `${doc.huisletter ?? ""}${doc.huisnummertoevoeging ?? ""}`.toUpperCase();
  if (t.addition && regAdd !== t.addition) return { auto: false, reason: `Toevoeging wijkt af van het register (${doc.weergavenaam})` };
  const names = new Set(cityNames.flatMap(c => [norm(c), ...(OFFICIAL[norm(c)] ?? [])]));
  const place = [doc.woonplaatsnaam, doc.gemeentenaam].filter(Boolean).map(s => norm(s!));
  if (!place.some(p => names.has(p))) return { auto: false, reason: `Ligt in ${doc.woonplaatsnaam ?? doc.gemeentenaam}, niet in de stad van het restaurant` };
  const pt = pointOf(doc);
  if (!pt) return { auto: false, reason: "Geen locatie in het register" };
  if (current && distanceKm(current, pt) > maxMoveKm) {
    return { auto: false, reason: `Nieuw adres ligt ${Math.round(distanceKm(current, pt))} km van het oude` };
  }
  return { auto: true, reason: "Gevonden in het adresregister", address: doc.weergavenaam.replace(/(\d{4})([A-Z]{2})/, "$1 $2"), lat: pt.lat, lng: pt.lng };
}
