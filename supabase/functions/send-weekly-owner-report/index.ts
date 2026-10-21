import { requireAdminOrInternal, serviceClient, escapeHtml } from "../_shared/auth.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  claimed_by_owner_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    { const __deny = await requireAdminOrInternal(req, serviceClient(), corsHeaders); if (__deny) return __deny; }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sinceIso = sinceDate.toISOString();

    // Find owners opted in (default true if no row)
    const { data: optedOut } = await supabase
      .from('owner_email_preferences')
      .select('user_id')
      .eq('weekly_report', false);
    const skipUserIds = new Set((optedOut || []).map((r: any) => r.user_id));

    // Fetch claimed restaurants
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name, slug, claimed_by_owner_id')
      .not('claimed_by_owner_id', 'is', null)
      .eq('is_active', true);

    if (!restaurants || restaurants.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no restaurants' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group by owner
    const byOwner = new Map<string, Restaurant[]>();
    for (const r of restaurants as Restaurant[]) {
      if (!r.claimed_by_owner_id || skipUserIds.has(r.claimed_by_owner_id)) continue;
      const arr = byOwner.get(r.claimed_by_owner_id) || [];
      arr.push(r);
      byOwner.set(r.claimed_by_owner_id, arr);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) throw new Error('Email keys not configured');

    let sent = 0;
    let failed = 0;

    for (const [ownerId, ownerRestaurants] of byOwner) {
      // Get owner profile + email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('id', ownerId)
        .maybeSingle();
      if (!profile?.email) continue;

      // Aggregate stats per restaurant
      const rows = [];
      for (const r of ownerRestaurants) {
        const { data: events } = await supabase
          .from('analytics_events')
          .select('event_type')
          .eq('restaurant_id', r.id)
          .gte('created_at', sinceIso);

        const { count: reviewCount } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', r.id)
          .gte('created_at', sinceIso);

        const views = (events || []).filter((e: any) => e.event_type === 'view').length;
        const clicks = (events || []).filter((e: any) => e.event_type === 'click').length;
        rows.push({ name: r.name, slug: r.slug, views, clicks, reviews: reviewCount || 0 });
      }

      const html = renderReport(profile.name || 'eigenaar', rows);

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
          subject: 'Je wekelijkse Dishloopr rapport',
          html,
        }),
      });

      if (res.ok) sent++;
      else failed++;
    }

    return new Response(JSON.stringify({ sent, failed, owners: byOwner.size }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function renderReport(name: string, rows: Array<{ name: string; slug: string; views: number; clicks: number; reviews: number }>) {
  const totalViews = rows.reduce((s, r) => s + r.views, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalReviews = rows.reduce((s, r) => s + r.reviews, 0);

  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #eee;font-weight:600;">${escape(r.name)}</td>
      <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;">${r.views}</td>
      <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;">${r.clicks}</td>
      <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;">${r.reviews}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#111;">
      <h1 style="color:#F26522;font-size:24px;margin:0 0 8px;">Hoi ${escape(name)} 👋</h1>
      <p style="color:#555;margin:0 0 24px;">Hier is je Dishloopr-rapport van afgelopen 7 dagen.</p>

      <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;background:#fff7f0;border:1px solid #f6d4b8;padding:16px;border-radius:12px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#F26522;">${totalViews}</div>
          <div style="font-size:12px;color:#666;">Profielweergaven</div>
        </div>
        <div style="flex:1;background:#fff7f0;border:1px solid #f6d4b8;padding:16px;border-radius:12px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#F26522;">${totalClicks}</div>
          <div style="font-size:12px;color:#666;">Kliks</div>
        </div>
        <div style="flex:1;background:#fff7f0;border:1px solid #f6d4b8;padding:16px;border-radius:12px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#F26522;">${totalReviews}</div>
          <div style="font-size:12px;color:#666;">Nieuwe reviews</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;border:1px solid #eee;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Restaurant</th>
            <th style="padding:12px;text-align:center;font-size:12px;color:#666;text-transform:uppercase;">Weergaven</th>
            <th style="padding:12px;text-align:center;font-size:12px;color:#666;text-transform:uppercase;">Kliks</th>
            <th style="padding:12px;text-align:center;font-size:12px;color:#666;text-transform:uppercase;">Reviews</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <div style="text-align:center;margin-top:32px;">
        <a href="https://dishloopr.com/owner-dashboard" style="background:#F26522;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Open dashboard</a>
      </div>

      <p style="color:#999;font-size:12px;margin-top:32px;text-align:center;">
        Je ontvangt deze e-mail omdat je rapportages aan hebt staan.
        <a href="https://dishloopr.com/owner-dashboard" style="color:#999;">Beheren</a>.
      </p>
    </div>
  `;
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}