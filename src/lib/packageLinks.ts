/** Stripe client_reference_id: alphanumerics, dashes and underscores, max 200 chars. */
export function clientReferenceId(restaurantId: string, pageSlug: string): string {
  const clean = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, '-');
  return `${clean(restaurantId)}__${clean(pageSlug)}`.slice(0, 200);
}

export function isUsableLink(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https:\/\/[^\s"<>]+$/.test(url.trim());
}

export function withReference(url: string, reference: string): string {
  const u = new URL(url);
  u.searchParams.set('client_reference_id', reference);
  return u.toString();
}
