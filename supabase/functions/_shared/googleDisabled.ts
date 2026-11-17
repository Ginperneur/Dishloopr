// Google Maps Platform EEA terms: Places content (names, addresses, ratings, opening hours,
// photos) may not be copied or stored outside Google's services; only place_id may be cached,
// lat/lng for at most 30 days. Functions that stored that content now answer 410 Gone.
// See docs/google-places-compliance.md.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function googleContentDisabled(functionName: string, reason: string) {
  return (req: Request): Response => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    return new Response(
      JSON.stringify({ error: `${functionName} is uitgeschakeld: ${reason}`, disabled: true }),
      { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  };
}
