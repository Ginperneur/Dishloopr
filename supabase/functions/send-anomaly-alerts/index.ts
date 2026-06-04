import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

interface AnomalyRow {
  metric: string;
  current_value: number;
  previous_value: number;
  delta_pct: number;
  severity: 'critical' | 'warning' | 'ok' | 'none';
}

const METRIC_LABEL: Record<string, { label: string; advice: string }> = {
  views: { label: 'Profielweergaven', advice: 'Boost zichtbaarheid: deel je restaurant via social of overweeg een Featured-plek.' },
  clicks: { label: 'Klikken', advice: 'Check of CTA-knoppen (website, telefoon, reserveren) up-to-date en zichtbaar zijn.' },
  conversions: { label: 'Conversies', advice: 'Voeg een reserveerlink toe en controleer telefoonnummer en menu-fotos.' },
  conversion_rate: { label: 'Conversieratio', advice: 'Verbeter de pagina met sterke openingstekst, signatuur-gerechten en duidelijke CTAs.' },
  avg_review_rating: { label: 'Gem. review-score (30d)', advice: 'Reageer snel op recente negatieve reviews en check Review-intelligence.' },
};

function weekStart(d = new Date()): string {
  const date = new Date(d);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) throw new Error('Email keys not configured');

    const wk = weekStart();

    // Owners opted out of anomaly alerts
    const { data: optedOut } = await supabase
      .from('owner_email_preferences')
      .select('user_id')
      .eq('anomaly_alerts', false);
    const skip = new Set((optedOut || []).map((r: any) => r.user_id));

    // Pro subscribers only — anomalies are a Pro feature
    const { data: proRows } = await supabase
      .from('owner_pro_subscriptions')
      .select('user_id, status, current_period_end');
    const proUsers = new Set(
      (proRows || [])
        .filter((r: any) => ['active', 'trialing'].includes(r.status))
        .map((r: any) => r.user_id)
    );

    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name, slug, claimed_by_owner_id')
      .not('claimed_by_owner_id', 'is', null)
      .eq('is_active', true);

    let owners_checked = 0;
    let alerts_sent = 0;
    let skipped_duplicates = 0;
    let failed = 0;

    for (const r of (restaurants || []) as any[]) {
      const ownerId: string = r.claimed_by_owner_id;
      if (!ownerId || skip.has(ownerId) || !proUsers.has(ownerId)) continue;
      owners_checked++;

      const { data: rows, error } = await supabase.rpc('get_owner_funnel_anomalies' as any, {
        p_restaurant_id: r.id,
      });
      if (error || !rows) continue;

      const critical = (rows as AnomalyRow[]).filter((a) => a.severity === 'critical');
      if (critical.length === 0) continue;

      // Dedup: filter out metrics already alerted this week
      const { data: existing } = await supabase
        .from('owner_anomaly_alerts_log')
        .select('metric')
        .eq('restaurant_id', r.id)
        .eq('week_start', wk);
      const already = new Set((existing || []).map((e: any) => e.metric));
      const fresh = critical.filter((a) => !already.has(a.metric));
      if (fresh.length === 0) {
        skipped_duplicates++;
        continue;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('id', ownerId)
        .maybeSingle();
      if (!profile?.email) continue;

      const html = renderAlert(profile.name || 'eigenaar', r.name, r.slug, fresh);
      const subject = `Let op: kritieke daling bij ${r.name}`;

      const res = await fetch(`${GATEWAY_URL}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: 'Dishloopr <hallo@dishloopr.com>',
          to: [profile.email],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        failed++;
        continue;
      }

      // Log to prevent re-sending this week
      await supabase.from('owner_anomaly_alerts_log').insert(
        fresh.map((a) => ({
          user_id: ownerId,
          restaurant_id: r.id,
          metric: a.metric,
          severity: a.severity,
          delta_pct: a.delta_pct,
          week_start: wk,
        }))
      );
      alerts_sent++;
    }

    return new Response(
      JSON.stringify({ owners_checked, alerts_sent, skipped_duplicates, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function renderAlert(name: string, restaurantName: string, slug: string, alerts: AnomalyRow[]) {
  const itemsHtml = alerts
    .map((a) => {
      const cfg = METRIC_LABEL[a.metric] ?? { label: a.metric, advice: '' };
      return `
        <div style="background:#fff5f3;border:1px solid #f5b8ad;border-radius:12px;padding:16px;margin-bottom:12px;">
          <div style="font-weight:700;color:#b3261e;font-size:14px;margin-bottom:4px;">${escape(cfg.label)}</div>
          <div style="color:#444;font-size:13px;margin-bottom:6px;">
            ${a.previous_value} → <strong>${a.current_value}</strong> (${a.delta_pct > 0 ? '+' : ''}${a.delta_pct}%)
          </div>
          <div style="color:#666;font-size:12px;">${escape(cfg.advice)}</div>
        </div>`;
    })
    .join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#111;">
      <h1 style="color:#F26522;font-size:22px;margin:0 0 8px;">Hoi ${escape(name)},</h1>
      <p style="color:#555;margin:0 0 20px;font-size:14px;">
        We zien een kritieke daling in de kerncijfers van <strong>${escape(restaurantName)}</strong> de afgelopen 7 dagen (vergeleken met de week ervoor).
      </p>
      ${itemsHtml}
      <div style="text-align:center;margin-top:24px;">
        <a href="https://dishloopr.com/owner-dashboard?tab=insights"
           style="background:#F26522;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
          Open Inzichten
        </a>
      </div>
      <p style="color:#999;font-size:11px;margin-top:32px;text-align:center;">
        Je ontvangt deze e-mail omdat je funnel-alerts aan hebt staan. Beheer voorkeuren in je dashboard onder Instellingen.
      </p>
    </div>
  `;
}