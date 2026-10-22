const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Returns only the public GA4 measurement ID (it is visible in every page that runs Analytics).
Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const id = (Deno.env.get('GOOGLE_ANALYTICS_MEASUREMENT_ID') ?? '').trim();
  const valid = /^G-[A-Z0-9]+$/.test(id);
  return new Response(JSON.stringify({ ga_measurement_id: valid ? id : null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
});
