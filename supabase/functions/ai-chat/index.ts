/*
# AI Chat Edge Function - Enhanced with Better Logging

This version includes comprehensive logging to help debug real-time issues.
Uses the VITE_GEMINI_API_KEY environment variable for Gemini API access.
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

  console.log("🚀 AI Chat function started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    // Use the VITE_GEMINI_API_KEY from environment variables
    const geminiApiKey = Deno.env.get("VITE_GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!geminiApiKey) {
      throw new Error("Missing Gemini API key (VITE_GEMINI_API_KEY)");
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
      console.error("❌ Auth error:", authError);
      throw new Error("Invalid authentication");
    }

    const { chatId, message, modelId }: RequestPayload = await req.json();

    if (!chatId || !message || !modelId) {
      throw new Error("Missing required parameters");
    }

    console.log(`👤 User ${user.id} asking: "${message}" in chat ${chatId}`);

    // Check user credits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("❌ Profile error:", profileError);
      throw new Error("Could not fetch user profile");
    }

    if (profile.credits_balance < 1) {
      console.log("❌ Insufficient credits");
      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get recent messages for context
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("content, sender_type, profiles(username)")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(5);

    const context = recentMessages?.reverse().slice(-3).map(msg => 
      `${msg.sender_type === 'user' ? msg.profiles?.username || 'User' : 'Gwiz'}: ${msg.content}`
    ).join('\n') || '';

    const modelIdentifier = 'gemini-1.5-flash';
    const prompt = context 
      ? `Previous conversation:\n${context}\n\nUser: ${message}\n\nGwiz (respond helpfully and concisely):`
      : `User: ${message}\n\nGwiz (respond helpfully and concisely):`;

    console.log("🤖 Calling Gemini API with VITE_GEMINI_API_KEY...");

    // Call Gemini API using the environment variable
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
            maxOutputTokens: 1000,
            temperature: 0.7,
            topP: 0.8,
            topK: 40
          }
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("❌ Gemini API error:", geminiResponse.status, errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 
      "I apologize, but I couldn't generate a response. Please try again.";

    console.log("✅ Gemini response received, length:", aiResponse.length);

    // Save AI message to database with enhanced metadata
    console.log("💾 Saving AI message to database...");
    
    const { data: savedMessage, error: messageError } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        sender_id: null,
        sender_type: "ai",
        content: aiResponse,
        model_id: modelId,
        token_cost: 1,
        message_type: "LLM_TO_USER",
        metadata: {
          model_used: modelIdentifier,
          api_source: "google_gemini_direct"
        },
        llm_model_used: "google/gemini-1.5-flash",
        input_tokens: 0, // Gemini doesn't provide token counts in this API
        output_tokens: 0,
        cost_in_credits: 1
      })
      .select()
      .single();

    if (messageError) {
      console.error("❌ Message save error:", messageError);
      throw new Error(`Could not save AI message: ${messageError.message}`);
    }

    console.log("✅ AI message saved with ID:", savedMessage.id);

    // Update user credits
    const { error: creditError } = await supabase
      .from("profiles")
      .update({ credits_balance: profile.credits_balance - 1 })
      .eq("id", user.id);

    if (creditError) {
      console.error("❌ Credit update error:", creditError);
      throw new Error(`Could not deduct credits: ${creditError.message}`);
    }

    console.log("✅ Credits updated");

    // Update last used LLM to Gwiz
    await supabase.rpc('update_last_used_llm', {
      model_identifier: 'google/gemini-1.5-flash'
    });

    // Log transaction (fire and forget)
    supabase
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: -1,
        description: "AI chat response from Gwiz",
        chat_id: chatId,
      })
      .then(() => console.log("✅ Transaction logged"))
      .catch(err => console.error("❌ Transaction logging failed:", err));

    console.log("🎉 AI response completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: aiResponse,
        messageId: savedMessage.id 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 AI Chat Error:", error);

    // Log error to database (fire and forget)
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
        .then(() => console.log("✅ Error logged"))
        .catch(() => console.error("❌ Error logging failed"));
    } catch {}

    const errorMessage = error.message.includes("Gemini") 
      ? `AI service error: ${error.message}`
      : error.message.includes("credits")
      ? error.message
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