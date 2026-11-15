// Separates real dish names from scraping debris in the dishes table: random characters
// (";s", "9cqwe+", "cl3 k qn") and sentences lifted from restaurant websites
// ("- het beoordelen van uw bestelling;", "honden zijn in chang thai niet toegestaan.").

/** True for names like "Carbonara" or "Pad thai", false for debris and sentences. */
export function isRealDishName(name: string): boolean {
  const n = name.trim();
  return n.length >= 2 && n.length <= 50
    && /^[\p{L}][\p{L}\p{M}\d\s'’&().,/-]*$/u.test(n)
    && !/\p{L}\d|\d\p{L}/u.test(n)
    && !/[.,;:!?-]$/.test(n)
    && !/-\s|\s-/.test(n)
    && n.split(/\s+/).length <= 7
    && (n.match(/\p{L}/gu) ?? []).length >= 2;
}
