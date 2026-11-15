// Owner outreach (mail golf): shared types and pure helpers for the admin screen.

export interface OutreachTarget {
  restaurant_id: string; name: string; slug: string; stad: string | null; address: string | null;
  phone: string | null; website_url: string | null; is_active: boolean; claim_status: string;
  verborgen_reden: string | null; goedgekeurde_gerechten: number; email: string | null;
  email_kwaliteit: string | null; rechtsvorm: string | null; kvk: string | null; instagram: string | null;
  mail_golf: number | null; laatst_gemaild_op: string | null; afgemeld_op: string | null;
  segment: 'zichtbaar' | 'onzichtbaar_menu' | 'uitgesloten'; mail_status: string;
}

export interface OutreachSettings {
  enabled: boolean; wave: number; batch_size: number; daily_cap: number;
  skip_natural_persons: boolean; menu_minimum: number;
  flyer_mode: 'bijlage' | 'link' | 'uit'; flyer_warning: string | null;
}

export interface OutreachReply {
  id: string; restaurant_id: string | null; from_email: string; from_name: string | null;
  subject: string | null; body_text: string | null; attachments: { filename: string; content_type: string }[];
  received_at: string; categorie: string | null; prioriteit: 'hoog' | 'normaal' | 'laag' | null;
  deal_kans: number | null; samenvatting: string | null; aanbevolen_actie: string | null;
  concept_antwoord: string | null; classify_error: string | null; status: string; answer_text: string | null;
}

export const MAIL_STATUS_LABEL: Record<string, string> = {
  mailbaar: 'Mailbaar', geen_email: 'Geen mailadres', al_geclaimd: 'Al geclaimd', afgemeld: 'Afgemeld',
  natuurlijk_persoon: 'Eenmanszaak/vof (toestemming nodig)', uitgesloten: 'Uitgesloten',
};

export const CATEGORY_LABEL: Record<string, string> = {
  wil_claimen: 'Wil claimen', interesse_uitgelicht: 'Interesse Uitgelicht', interesse_pro: 'Interesse Owner Pro',
  menu_aangeleverd: 'Menu aangeleverd', vraag: 'Vraag', terugbellen: 'Wil gebeld worden',
  niet_geinteresseerd: 'Niet geïnteresseerd', afmelden: 'Afmelden', gegevens_onjuist: 'Gegevens onjuist',
  verwijderen: 'Wil verwijderd worden', verkeerde_persoon: 'Verkeerde persoon', klacht: 'Klacht',
  automatisch: 'Automatisch antwoord', overig: 'Overig',
};

/** segment -> mail_status -> count */
export function segmentMatrix(rows: Pick<OutreachTarget, 'segment' | 'mail_status'>[]) {
  const m: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    m[r.segment] ??= {};
    m[r.segment][r.mail_status] = (m[r.segment][r.mail_status] ?? 0) + 1;
  }
  return m;
}

/** Rows that the next run would still mail in this wave. */
export function pendingForWave(rows: Pick<OutreachTarget, 'mail_status' | 'mail_golf' | 'segment'>[], wave: number) {
  return rows.filter(r => r.mail_status === 'mailbaar' && r.segment !== 'uitgesloten' && (r.mail_golf ?? 0) < wave).length;
}

const CSV_COLS: (keyof OutreachTarget)[] = [
  'restaurant_id', 'name', 'stad', 'segment', 'mail_status', 'email', 'email_kwaliteit', 'phone', 'website_url',
  'address', 'instagram', 'rechtsvorm', 'kvk', 'claim_status', 'is_active', 'verborgen_reden',
  'goedgekeurde_gerechten', 'mail_golf', 'laatst_gemaild_op', 'afgemeld_op', 'slug',
];

export function targetsCsv(rows: OutreachTarget[]): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Semicolons: Dutch Excel opens this directly in columns.
  return [CSV_COLS.join(';'), ...rows.map(r => CSV_COLS.map(c => cell(r[c])).join(';'))].join('\r\n');
}
