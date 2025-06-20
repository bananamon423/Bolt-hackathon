/*
# AI Chat Edge Function - Fixed Model UUID Lookup

This version properly looks up the model UUID from the database before inserting messages.
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

    console.log("🔍 Environment check:");
    console.log("- SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing");
    console.log("- SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✅ Set" : "❌ Missing");
    console.log("- VITE_GEMINI_API_KEY:", geminiApiKey ? "✅ Set" : "❌ Missing");

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
    console.log(`🤖 Model ID received: "${modelId}"`);

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
    const { data: recentMessages, error: messagesError } = await supabase
      .from("messages")
      .select("content, sender_type")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true }) // Ascending to build history correctly
      .limit(10); // Get a bit more history

    if (messagesError) {
      throw new Error("Failed to fetch chat history.");
    }

    // Build the conversational history for the Gemini API
    const contents = recentMessages.map(msg => ({
      role: msg.sender_type === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Add the current user's message to the conversation
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const modelIdentifier = 'gemini-1.5-flash';

    console.log("🤖 Calling Gemini API with structured conversational contents...");
    console.log("📝 Contents structure:", JSON.stringify(contents, null, 2));

    // Call Gemini API using the environment variable
    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelIdentifier}:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: contents, // Use the new structured contents array
            generationConfig: {
              maxOutputTokens: 1000,
              temperature: 0.7,
              topP: 0.8,
              topK: 40
            }
          }),
        }
      );

      console.log("📡 Gemini API response status:", geminiResponse.status);

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("❌ Original error from Google Gemini API:", errorText);
        console.error("❌ Gemini API response headers:", Object.fromEntries(geminiResponse.headers.entries()));
        
        // Return specific error message
        return new Response(
          JSON.stringify({ 
            error: `Gemini API request failed: ${geminiResponse.status} - ${errorText}`,
            details: {
              status: geminiResponse.status,
              statusText: geminiResponse.statusText,
              response: errorText
            }
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const geminiData = await geminiResponse.json();
      console.log("📦 Gemini API response structure:", JSON.stringify(geminiData, null, 2));

      const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 
        "I apologize, but I couldn't generate a response. Please try again.";

      console.log("✅ Gemini response received, length:", aiResponse.length);

      // ----- START NEW CODE BLOCK -----
      console.log("🔍 Looking up model UUID for modelId:", modelId);

      // Look up the model UUID from the database
      // For the hardcoded Gwiz model, we'll handle it specially
      let retrievedModelUUID = null;
      
      if (modelId === 'gwiz-hardcoded') {
        // For the hardcoded Gwiz model, we can either:
        // 1. Set model_id to null (since it's a special hardcoded model)
        // 2. Or create a special entry in llm_models table
        console.log("🤖 Using hardcoded Gwiz model - setting model_id to null");
        retrievedModelUUID = null;
      } else {
        // For other models, look them up in the database
        const { data: modelData, error: modelError } = await supabase
          .from("llm_models")
          .select("id")
          .eq("id", modelId) // Try looking up by ID first
          .single();

        if (modelError || !modelData) {
          console.log("🔍 Model not found by ID, trying by model_name...");
          
          // Try looking up by model_name as fallback
          const { data: modelDataByName, error: modelErrorByName } = await supabase
            .from("llm_models")
            .select("id")
            .eq("model_name", "Gwiz")
            .single();

          if (modelErrorByName || !modelDataByName) {
            console.error("❌ Model lookup error:", modelError, modelErrorByName);
            console.log("⚠️ Could not find model in database, setting model_id to null");
            retrievedModelUUID = null;
          } else {
            retrievedModelUUID = modelDataByName.id;
            console.log("✅ Found model UUID by name:", retrievedModelUUID);
          }
        } else {
          retrievedModelUUID = modelData.id;
          console.log("✅ Found model UUID by ID:", retrievedModelUUID);
        }
      }
      // ----- END NEW CODE BLOCK -----

      // Save AI message to database with enhanced metadata
      console.log("💾 Saving AI message to database...");
      
      const { data: savedMessage, error: messageError } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: null,
          sender_type: "ai",
          content: aiResponse,
          model_id: retrievedModelUUID, // Use the retrieved UUID instead of modelId
          token_cost: 1,
          message_type: "LLM_TO_USER",
          metadata: {
            model_used: modelIdentifier,
            api_source: "google_gemini_direct",
            original_model_id: modelId // Keep track of the original modelId for debugging
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

    } catch (geminiError) {
      console.error("💥 Original error from Google Gemini API:", geminiError);
      console.error("💥 Gemini error stack:", geminiError.stack);
      
      // Return specific Gemini API error
      return new Response(
        JSON.stringify({ 
          error: `Gemini API request failed: ${geminiError.message}`,
          details: {
            type: "gemini_api_error",
            originalError: geminiError.message
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    console.error("💥 AI Chat Function Error:", error);
    console.error("💥 Error stack:", error.stack);

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

    // Return specific error message instead of generic one
    const errorMessage = error.message.includes("Gemini") 
      ? `AI service error: ${error.message}`
      : error.message.includes("credits")
      ? error.message
      : error.message.includes("Missing")
      ? `Configuration error: ${error.message}`
      : `Function error: ${error.message}`;

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: {
          type: "function_error",
          originalError: error.message
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});