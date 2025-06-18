/*
# AI Chat Edge Function - Optimized for Speed

This optimized version reduces response time by:
1. Parallel database operations
2. Reduced context fetching
3. Streamlined API calls
4. Better error handling
*/

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RequestPayload {
  chatId: string;
  message: string;
  modelId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = "AIzaSyDgzgvj-HARYBLmVEQJrE4dSh4HimbvozA";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Get user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Invalid authentication");
    }

    const { chatId, message, modelId }: RequestPayload = await req.json();

    if (!chatId || !message || !modelId) {
      throw new Error("Missing required parameters");
    }

    // Parallel operations to reduce latency
    const [profileResult, configResult, contextResult] = await Promise.all([
      // Check user credits
      supabase
        .from("profiles")
        .select("credits_balance")
        .eq("id", user.id)
        .single(),
      
      // Get context limit
      supabase
        .from("app_config")
        .select("config_value")
        .eq("config_key", "CONTEXT_MESSAGE_LIMIT")
        .single(),
      
      // Get recent messages (limit to 5 for faster response)
      supabase
        .from("messages")
        .select("content, sender_type, profiles(username)")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(5) // Reduced from configurable limit for speed
    ]);

    const { data: profile, error: profileError } = profileResult;
    if (profileError || !profile) {
      throw new Error("Could not fetch user profile");
    }

    if (profile.credits_balance < 1) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build minimal context for faster processing
    const { data: recentMessages } = contextResult;
    const context = recentMessages?.reverse().slice(-3).map(msg => 
      `${msg.sender_type === 'user' ? msg.profiles?.username || 'User' : 'Gwiz'}: ${msg.content}`
    ).join('\n') || '';

    // Use the fastest Gemini model
    const modelIdentifier = 'gemini-1.5-flash';

    // Optimized prompt for faster response
    const prompt = context 
      ? `Recent context:\n${context}\n\nUser: ${message}\n\nGwiz (respond concisely):`
      : `User: ${message}\n\nGwiz (respond concisely):`;

    // Call Gemini API with optimized settings
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelIdentifier}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            maxOutputTokens: 1000, // Limit response length for speed
            temperature: 0.7,
            topP: 0.8,
            topK: 40
          }
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 
      "I apologize, but I couldn't generate a response.";

    // Parallel operations for database updates
    const [messageResult, creditResult] = await Promise.all([
      // Save AI message
      supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: null,
          sender_type: "ai",
          content: aiResponse,
          model_id: modelId,
          token_cost: 1,
        }),
      
      // Update credits
      supabase
        .from("profiles")
        .update({ credits_balance: profile.credits_balance - 1 })
        .eq("id", user.id)
    ]);

    if (messageResult.error) {
      throw new Error(`Could not save AI message: ${messageResult.error.message}`);
    }

    if (creditResult.error) {
      throw new Error(`Could not deduct credits: ${creditResult.error.message}`);
    }

    // Log transaction asynchronously (don't wait for it)
    supabase
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: -1,
        description: "AI chat response",
        chat_id: chatId,
      })
      .then(() => {}) // Fire and forget
      .catch(err => console.error("Transaction logging failed:", err));

    return new Response(
      JSON.stringify({ success: true, response: aiResponse }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("AI Chat Error:", error);

    // Async error logging (don't wait for it)
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      supabase
        .from("error_logs")
        .insert({
          error_source: "AI Chat Function",
          error_details: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
          },
        })
        .then(() => {})
        .catch(() => {});
    } catch {}

    const errorMessage = error.message.includes("Gemini") 
      ? `AI service temporarily unavailable: ${error.message}`
      : "Gwiz is temporarily unavailable. Please try again.";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});