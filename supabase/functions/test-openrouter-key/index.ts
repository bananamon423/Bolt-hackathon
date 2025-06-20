// supabase/functions/test-openrouter-key/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey",
};

serve(async (_req) => {
  // Handle OPTIONS request for CORS
  if (_req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("--- Starting OpenRouter Key Test ---");

    // 1. Read the key directly from secrets
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!openRouterApiKey) {
      console.error("!!! TEST FAILED: Could not read OPENROUTER_API_KEY from secrets.");
      throw new Error("Secret key is missing from environment.");
    }
    console.log("✅ Secret key was read successfully.");
    console.log(`  - Key starts with: '${openRouterApiKey.slice(0, 4)}'`);

    // 2. Prepare the fetch request
    const headers = new Headers();
    headers.append("Authorization", `Bearer ${openRouterApiKey}`);
    headers.append("Content-Type", "application/json");

    const body = JSON.stringify({
      model: "google/gemini-pro", // Using a simple, reliable model for testing
      messages: [{ role: "user", content: "Hello!" }],
    });

    console.log("📡 Making fetch request to OpenRouter...");

    // 3. Make the API call
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: headers,
      body: body,
    });
    
    console.log(`STATUS: ${response.status}`);
    console.log(`STATUS TEXT: ${response.statusText}`);

    // 4. Return the direct response from OpenRouter
    const responseData = await response.json();

    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("💥 TEST FAILED: An error occurred in the test function.", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});