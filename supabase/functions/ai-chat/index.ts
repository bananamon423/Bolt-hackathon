/*
# AI Chat Edge Function - Fixed Gemini API Integration

This file contains the corrected Supabase Edge Function code with the proper Gemini API model identifier.

## Key Changes
1. **Correct Model Identifier:** Using 'gemini-1.5-flash' which is available and supported
2. **Proper API Endpoint:** Using the correct v1beta API endpoint
3. **Fallback Model:** Set a reliable fallback model identifier
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
    
    // Use hardcoded API key as requested
    const geminiApiKey = "AIzaSyDgzgvj-HARYBLmVEQJrE4dSh4HimbvozA";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration in environment variables.");
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
      
    // Use a working Gemini model identifier
    let finalModelIdentifier = "gemini-1.5-flash";
    
    // Map old model identifiers to working ones
    if (model?.api_identifier) {
      switch (model.api_identifier) {
        case 'gemini-pro':
        case 'gemini-1.5-pro-latest':
        case 'gemini-1.5-pro':
          finalModelIdentifier = 'gemini-1.5-flash';
          break;
        case 'gemini-pro-vision':
          finalModelIdentifier = 'gemini-1.5-flash';
          break;
        default:
          finalModelIdentifier = 'gemini-1.5-flash';
      }
    }

    // Build context for AI
    const context = recentMessages?.reverse().map(msg => 
      `${msg.sender_type === 'user' ? msg.profiles?.username || 'User' : 'Gwiz'}: ${msg.content}`
    ).join('\n') || '';

    // Call Gemini API with the correct model identifier and endpoint
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${finalModelIdentifier}:generateContent?key=${geminiApiKey}`,
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
        token_cost: 1,
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