/*
# Get Credits Edge Function

Provides a secure API endpoint for retrieving user credit balances.
Supports both self-queries and admin queries.
*/

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  console.log("🚀 get-credits function started");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Get user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("❌ Auth error:", authError);
      throw new Error("Invalid authentication");
    }

    // Extract userId from path (e.g., /get-credits/YOUR_USER_ID)
    const urlParts = req.url.split('/');
    const targetUserId = urlParts[urlParts.length - 1];

    if (!targetUserId) {
      throw new Error("Missing user ID in path.");
    }

    // Ensure the requesting user is the target user or an admin
    const { data: requestingProfile, error: requestingProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (requestingProfileError || !requestingProfile) {
      throw new Error("Could not fetch requesting user profile.");
    }

    if (user.id !== targetUserId && requestingProfile.role !== 'admin') {
      throw new Error("Unauthorized: You can only view your own credits or have admin privileges.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", targetUserId)
      .single();

    if (profileError || !profile) {
      console.error("❌ Profile error:", profileError);
      throw new Error("Could not fetch user profile.");
    }

    console.log(`✅ Credits for user ${targetUserId}: ${profile.credits_balance}`);

    return new Response(
      JSON.stringify({ credits_balance: profile.credits_balance }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 get-credits Function Error:", error);
    console.error("💥 Error stack:", error.stack);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});