// Builds the newsletter e-mail for an edition, with every approved paid placement in it.
// Owners type the placement text themselves, so everything is escaped. {{unsubscribe_url}} is
// replaced per subscriber by send-bulk-email.

export interface NewsletterPlacementItem {
  title: string;
  description: string | null;
  promo_type: string;
  restaurant_name: string;
  restaurant_slug: string;
  city_name?: string | null;
  /** Optional photo uploaded by the owner (Dishloopr storage only). */
  image_url?: string | null;
}

const PROMO_LABEL: Record<string, string> = {
  actie: 'Actie',
  event: 'Event',
  nieuw_gerecht: 'Nieuw gerecht',
  aanbieding: 'Aanbieding',
  overig: 'Tip',
};

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Only images from Dishloopr storage go into the mail. */
export function safeImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/restaurant-images\/[A-Za-z0-9/_.-]+$/.test(url) ? url : null;
}

export function buildNewsletterHtml(opts: {
  title: string;
  intro?: string | null;
  placements: NewsletterPlacementItem[];
  siteUrl?: string;
}): string {
  const site = (opts.siteUrl ?? 'https://dishloopr.nl').replace(/\/$/, '');
  const blocks = opts.placements.map(p => {
    const url = `${site}/restaurant/${encodeURIComponent(p.restaurant_slug)}?utm_source=nieuwsbrief&utm_medium=email`;
    const where = [p.restaurant_name, p.city_name].filter(Boolean).map(v => escapeHtml(String(v))).join(' · ');
    return `
    <tr><td style="padding:0 0 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #ece4dd;border-radius:12px">
        ${safeImage(p.image_url) ? `<tr><td style="padding:0"><a href="${url}"><img src="${escapeHtml(safeImage(p.image_url)!)}" alt="${escapeHtml(p.title)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:12px 12px 0 0"></a></td></tr>` : ''}
        <tr><td style="padding:18px 20px">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#c24a12;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(PROMO_LABEL[p.promo_type] ?? 'Tip')}</p>
          <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1f1a17">${escapeHtml(p.title)}</p>
          <p style="margin:0 0 10px;font-size:13px;color:#7a6f67">${where}</p>
          ${p.description ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:#4a413b">${escapeHtml(p.description).replace(/\n/g, '<br>')}</p>` : ''}
          <a href="${url}" style="display:inline-block;background:#ef6223;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 16px;border-radius:8px">Bekijk ${escapeHtml(p.restaurant_name)}</a>
        </td></tr>
      </table>
    </td></tr>`;
  }).join('');

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;background:#f7f4f1;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4f1"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td style="padding:0 0 20px"><a href="${site}" style="font-size:22px;font-weight:700;color:#ef6223;text-decoration:none">Dishloopr</a></td></tr>
    <tr><td style="padding:0 0 8px;font-size:24px;font-weight:700;color:#1f1a17">${escapeHtml(opts.title)}</td></tr>
    ${opts.intro ? `<tr><td style="padding:0 0 20px;font-size:15px;line-height:1.5;color:#4a413b">${escapeHtml(opts.intro).replace(/\n/g, '<br>')}</td></tr>` : ''}
    ${blocks}
    <tr><td style="padding:12px 0 0;font-size:12px;line-height:1.5;color:#7a6f67">
      Je ontvangt deze mail omdat je je hebt aangemeld voor de nieuwsbrief van Dishloopr.
      Restaurants in deze nieuwsbrief hebben voor hun plek betaald.<br>
      <a href="{{unsubscribe_url}}" style="color:#7a6f67">Afmelden</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
