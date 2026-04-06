import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reviewId } = await req.json();
    if (!reviewId) {
      return new Response(JSON.stringify({ error: "reviewId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get review details
    const { data: review } = await supabase
      .from("reviews")
      .select("id, rating, title, body, restaurant_id, user_id")
      .eq("id", reviewId)
      .single();

    if (!review) {
      return new Response(JSON.stringify({ error: "Review not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get restaurant and owner info
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name, slug, claimed_by_owner_id")
      .eq("id", review.restaurant_id)
      .single();

    if (!restaurant?.claimed_by_owner_id) {
      return new Response(JSON.stringify({ message: "No owner to notify" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get owner email
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("id", restaurant.claimed_by_owner_id)
      .single();

    if (!ownerProfile?.email) {
      return new Response(JSON.stringify({ message: "Owner has no email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get reviewer name
    const { data: reviewerProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", review.user_id)
      .single();

    const reviewerName = reviewerProfile?.name || "Een gebruiker";
    const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

    // Send email
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dishloopr <noreply@dishloopr.com>",
        to: [ownerProfile.email],
        subject: `Nieuwe review voor ${restaurant.name} - ${stars}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #333;">Nieuwe review voor ${restaurant.name}</h2>
            <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin: 16px 0;">
              <p style="font-size: 20px; margin: 0 0 8px;">${stars}</p>
              ${review.title ? `<p style="font-weight: 600; margin: 0 0 8px;">${review.title}</p>` : ""}
              ${review.body ? `<p style="color: #555; margin: 0;">${review.body}</p>` : ""}
              <p style="color: #888; font-size: 13px; margin: 12px 0 0;">— ${reviewerName}</p>
            </div>
            <p style="color: #666; font-size: 14px;">
              Je kunt reageren op deze review via je 
              <a href="https://dishloopr.com/owner" style="color: #E8590C;">eigenaarsdashboard</a>.
            </p>
          </div>
        `,
      }),
    });

    const emailResult = await emailRes.json();

    return new Response(JSON.stringify({ success: true, emailResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
