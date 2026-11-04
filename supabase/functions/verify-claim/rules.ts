// Pure claim-verification rules (no Deno/runtime APIs) so they can be unit-tested.

export const CODE_TTL_MINUTES = 30;
export function resendWaitSeconds(sentAt: string | null | undefined, now: number): number {
  if (!sentAt) return 0;
  return Math.max(0, Math.ceil((new Date(sentAt).getTime() + 60_000 - now) / 1000));
}
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_CODES_PER_HOUR = 3;
export const OPEN_CLAIM_STATUSES = ["pending", "email_verified", "phone_verified"];

// Reservation/menu/website-builder platforms we sometimes stored as a restaurant's
// "website_url" instead of their own domain (same list used in kaartmotor/contact/contact_finder.py).
// An owner has no mailbox on these, so offering "send a code to @this-domain" is a dead end.
const PLATFORM_DOMAINS = [
  "mymenuweb", "mapdetails", "formitable", "zenchef", "resengo", "tablebooker", "eet.nu", "thefork",
  "opentable", "quandoo", "bookdinners", "lightspeed", "mews.", "deliverect", "orderbird", "qopla",
  "thuisbezorgd", "ubereats", "deliveroo", "wix.com", "wixsite.com", "webador", "jimdo", "strato",
  "one.com", "hostnet", "transip", "mijndomein", "vimexx", "websitebuilder", "iens", "tripadvisor",
  "sitebuilder", "site123",
];

export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes(".")) return null;
    if (PLATFORM_DOMAINS.some((p) => host === p || host.endsWith(`.${p}`) || host.includes(p))) return null;
    return host;
  } catch {
    return null;
  }
}

/** Email domain must equal the website domain (without www) or be a subdomain of it. */
export function domainMatches(email: string, restaurantDomain: string | null): boolean {
  if (!restaurantDomain) return false;
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[0]) return false;
  const ed = parts[1].replace(/^www\./, "");
  return ed === restaurantDomain || ed.endsWith(`.${restaurantDomain}`);
}

export function codeExpiry(now: number): Date {
  return new Date(now + CODE_TTL_MINUTES * 60 * 1000);
}

export function isExpired(expiresAt: string | Date, now: number): boolean {
  return new Date(expiresAt).getTime() < now;
}

export function attemptsExhausted(attempts: number): boolean {
  return attempts >= MAX_CODE_ATTEMPTS;
}

export function canSendAnotherCode(codesSentLastHour: number): boolean {
  return codesSentLastHour < MAX_CODES_PER_HOUR;
}

export function canStartClaim(restaurantClaimStatus: string | null, userHasOpenClaim: boolean):
  { ok: true } | { ok: false; reason: "already_claimed" | "locked" | "open_claim" } {
  if (restaurantClaimStatus === "verified_owner") return { ok: false, reason: "already_claimed" };
  if (restaurantClaimStatus === "locked") return { ok: false, reason: "locked" };
  if (userHasOpenClaim) return { ok: false, reason: "open_claim" };
  return { ok: true };
}
