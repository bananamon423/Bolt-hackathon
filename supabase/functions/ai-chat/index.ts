/*
# AI Chat Edge Function - Corrected Version

This file contains the updated Supabase Edge Function code to fix the Gemini API error.

## Key Changes
1.  **Model Identifier Fix:** Added logic to explicitly check for and replace the outdated 'gemini-pro'
    model identifier with 'gemini-1.5-pro-latest'. This resolves the 404 Not Found error.
2.  **API Key Security:** Removed the hardcoded Gemini API key. The key is now securely loaded
    from environment variables, which is a critical security best practice. You must set
    `GEMINI_API_KEY` in your Supabase Function settings.
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
    // Validate required environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    // SECURITY FIX: Load Gemini API Key from environment variables.
    // Never hardcode API keys in your code.
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration in environment variables.");
    }

    if (!geminiApiKey) {
        throw new Error("Missing GEMINI_API_KEY in environment variables.");
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
      throw new Error("Missing required parameters: chatId, message, or modelId");
    }

    // Check user credits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", user.id)
      .single();

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

    // Get context limit from config
    const { data: config } = await supabase
      .from("app_config")
      .select("config_value")
      .eq("config_key", "CONTEXT_MESSAGE_LIMIT")
      .single();

    const contextLimit = parseInt(config?.config_value || "10");

    // Get recent messages for context
    const { data: recentMessages } = await supabase
      .from("messages")
      .select(`
        content,
        sender_type,
        profiles(username)
      `)
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(contextLimit);

    // Get model info from your database
    const { data: model } = await supabase
      .from("llm_models")
      .select("api_identifier")
      .eq("id", modelId)
      .single();
      
    // --- START: FIX FOR OUTDATED MODEL IDENTIFIER ---
    // This logic checks if the database returned the old 'gemini-pro' model name
    // and updates it to a valid one to prevent the API error.
    let finalModelIdentifier = model?.api_identifier;
    if (finalModelIdentifier === 'gemini-pro') {
        finalModelIdentifier = 'gemini-1.5-pro-latest';
    }
    // If no model was found in the DB, use a reliable fallback.
    if (!finalModelIdentifier) {
        finalModelIdentifier = 'gemini-1.5-pro-latest';
    }
    // --- END: FIX ---

    // Build context for AI
    const context = recentMessages?.reverse().map(msg => 
      `${msg.sender_type === 'user' ? msg.profiles?.username || 'User' : 'Gwiz'}: ${msg.content}`
    ).join('\n') || '';

    // Call Gemini API with the corrected model identifier
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${finalModelIdentifier}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Context:\n${context}\n\nUser: ${message}\n\nPlease respond as Gwiz, a helpful AI assistant.`
            }]
          }]
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, but I couldn't generate a response.";

    // Save AI message to your database
    const { error: messageError } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        sender_id: null, // AI messages don't have a user sender_id
        sender_type: "ai",
        content: aiResponse,
        model_id: modelId,
        token_cost: 1, // Note: You might want to implement actual token counting
      });

    if (messageError) {
      throw new Error(`Could not save AI message: ${messageError.message}`);
    }

    // Deduct credit and log transaction
    const { error: creditError } = await supabase
      .from("profiles")
      .update({ credits_balance: profile.credits_balance - 1 })
      .eq("id", user.id);

    if (creditError) {
      // Note: Consider how to handle this failure case. Maybe roll back the message?
      throw new Error(`Could not deduct credits: ${creditError.message}`);
    }

    const { error: transactionError } = await supabase
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: -1,
        description: "AI chat response",
        chat_id: chatId,
      });

    if (transactionError) {
      // This is a non-critical error, so we just log it.
      console.error("Transaction logging failed:", transactionError);
    }

    return new Response(
      JSON.stringify({ success: true, response: aiResponse }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("AI Chat Error:", error);

    // Log the error to your database for monitoring
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabase
        .from("error_logs")
        .insert({
          error_source: "AI Chat Function",
          error_details: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
          },
        });
    } catch (logError) {
      console.error("Failed to log error to database:", logError);
    }

    const errorMessage = error.message.includes("Gemini API") 
      ? `AI service error: ${error.message}`
      : "Gwiz encountered an error. Please try again.";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
