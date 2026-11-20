import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { timingSafeEqual } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SMS costs money: fail closed when the limiter itself is unavailable.
    const rl = await enforceRateLimit(req, {
      functionName: 'send-sms-verification',
      user: { max: 15, window: 3600 },
      anon: { max: 5, window: 3600 },
      failClosed: true,
    });
    if (!rl.allowed && rl.response) return rl.response;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { claimId, phoneNumber, action, code } = await req.json();

    if (!claimId || !phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Missing claimId or phoneNumber' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone number format (basic validation)
    const cleanPhone = phoneNumber.replace(/\s+/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(cleanPhone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the claim belongs to this user
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('restaurant_claims')
      .select('id, user_id, restaurant_id, phone_verification_code, phone_code_expires_at, claim_attempt_count')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      return new Response(
        JSON.stringify({ error: 'Claim not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (claim.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // The number must be the restaurant's own public phone number
    const { data: rest } = await supabaseAdmin
      .from('restaurants').select('phone').eq('id', claim.restaurant_id).maybeSingle();
    const norm = (v: string) => {
      let d = String(v || '').replace(/[^\d+]/g, '');
      if (d.startsWith('00')) d = '+' + d.slice(2);
      if (d.startsWith('0')) d = '+31' + d.slice(1);
      return d;
    };
    if (!rest?.phone || norm(rest.phone) !== norm(cleanPhone)) {
      return new Response(
        JSON.stringify({ error: 'Phone number must match the restaurant\'s listed number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: max 5 attempts
    if (claim.claim_attempt_count >= 5) {
      return new Response(
        JSON.stringify({ error: 'Too many verification attempts. Please contact support.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extra counters on top of the per-claim send cap, kept in the rate-limit table (no schema change).
    const counter = async (identifier: string, fn: string, max: number, window: number): Promise<boolean> => {
      const { data, error: rpcError } = await supabaseAdmin.rpc('check_and_log_rate_limit', {
        p_identifier: identifier, p_function: fn, p_max: max, p_window_seconds: window,
      });
      if (rpcError) { console.error('counter rpc error', rpcError.message); return false; } // fail closed
      return (data as { allowed?: boolean } | null)?.allowed === true;
    };

    if (action === 'send') {
      // Max 5 SMS per restaurant per day, whoever asks (stops SMS-bombing a restaurant's phone via many claims).
      if (!(await counter(`restaurant:${claim.restaurant_id}`, 'sms-send-restaurant', 5, 86400))) {
        return new Response(
          JSON.stringify({ error: 'Too many verification attempts. Please contact support.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Generate 6-digit code
      const verificationCode = (100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Send SMS via Twilio
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        console.error('Missing Twilio credentials');
        return new Response(
          JSON.stringify({ error: 'SMS service not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      const formData = new URLSearchParams();
      formData.append('To', cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`);
      formData.append('From', twilioPhoneNumber);
      formData.append('Body', `Je Dishloopr verificatiecode is: ${verificationCode}. Geldig voor 10 minuten.`);

      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!twilioResponse.ok) {
        const twilioError = await twilioResponse.text();
        console.error('Twilio error:', twilioError);
        return new Response(
          JSON.stringify({ error: 'Failed to send SMS. Please check the phone number.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Store the code in the database
      const { error: updateError } = await supabaseAdmin
        .from('restaurant_claims')
        .update({
          phone_number: cleanPhone,
          phone_verification_code: verificationCode,
          phone_code_expires_at: expiresAt,
          claim_attempt_count: claim.claim_attempt_count + 1,
        })
        .eq('id', claimId);

      if (updateError) {
        console.error('Database update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to save verification code' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`SMS sent for claim ${claimId}`);

      return new Response(
        JSON.stringify({ success: true, message: 'Verification code sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'verify') {
      if (!code) {
        return new Response(
          JSON.stringify({ error: 'Missing verification code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Lock after 5 verify attempts per claim per hour (every attempt counts, so guessing is capped).
      if (!(await counter(`claim:${claimId}`, 'sms-verify-claim', 5, 3600))) {
        return new Response(
          JSON.stringify({ error: 'Too many verification attempts. Please contact support.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if code is valid and not expired
      if (!claim.phone_verification_code || !claim.phone_code_expires_at) {
        return new Response(
          JSON.stringify({ error: 'No verification code sent. Please request a new code.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new Date(claim.phone_code_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Verification code expired. Please request a new code.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!timingSafeEqual(String(claim.phone_verification_code), String(code))) {
        return new Response(
          JSON.stringify({ error: 'Invalid verification code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark phone as verified
      const { error: verifyError } = await supabaseAdmin
        .from('restaurant_claims')
        .update({
          phone_verified: true,
          phone_verified_at: new Date().toISOString(),
          phone_verification_code: null, // Clear the code
          phone_code_expires_at: null,
        })
        .eq('id', claimId);

      if (verifyError) {
        console.error('Verification update error:', verifyError);
        return new Response(
          JSON.stringify({ error: 'Failed to verify phone' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Phone verified for claim ${claimId}`);

      return new Response(
        JSON.stringify({ success: true, message: 'Phone verified successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-sms-verification:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
