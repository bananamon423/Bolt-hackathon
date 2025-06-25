/*
# Centralized AI Chat Edge Function - RevenueCat Integration

This function handles all LLM requests with proper credit management:
- Checks chat owner's credits before processing
- Deducts credits from chat owner (not requester)
- Supports both Gemini and OpenRouter models
- Includes credit refund on errors
- Comprehensive logging and error handling
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
  modelId: string; // This is the LLMModel.id from the database
  userPromptId?: number; // Optional: ID of the user's message that triggered this AI response
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  console.log("🚀 ask-llm function started");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiApiKey = Deno.env.get("VITE_GEMINI_API_KEY");
  const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration");
  }
  if (!geminiApiKey) {
    console.warn("VITE_GEMINI_API_KEY is not set. Gemini models might not work.");
  }
  if (!openRouterApiKey) {
    console.warn("OPENROUTER_API_KEY is not set. OpenRouter models might not work.");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let userId: string | null = null;
  let chatOwnerId: string | null = null;
  let deductedCredits = 0;
  let userProfileCreditsBeforeDeduction = 0;

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
    userId = user.id;

    const { chatId, message, modelId, userPromptId }: RequestPayload = await req.json();

    if (!chatId || !message || !modelId) {
      throw new Error("Missing required parameters: chatId, message, or modelId");
    }

    console.log(`👤 User ${userId} asking: "${message}" in chat ${chatId} using model ID ${modelId}`);

    // 1. Get chat owner
    const { data: chatData, error: chatError } = await supabase
      .from("chats")
      .select("owner_id")
      .eq("id", chatId)
      .single();

    if (chatError || !chatData) {
      console.error("❌ Chat lookup error:", chatError);
      throw new Error("Chat not found or user not authorized to access chat.");
    }
    chatOwnerId = chatData.owner_id;

    // 2. Get model information
    const { data: modelData, error: modelError } = await supabase
      .from("llm_models")
      .select("api_identifier, cost_per_token, model_name")
      .eq("id", modelId)
      .single();

    if (modelError || !modelData) {
      console.error("❌ Model lookup error:", modelError);
      throw new Error("Invalid model ID provided.");
    }

    const { api_identifier: llmApiIdentifier, cost_per_token: modelCost, model_name: modelName } = modelData;
    deductedCredits = modelCost; // Store for potential refund

    console.log(`✅ Model found: ${modelName} (${llmApiIdentifier}), Cost: ${modelCost} credits`);

    // 3. Get chat owner's profile and credits
    const { data: ownerProfile, error: ownerProfileError } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", chatOwnerId)
      .single();

    if (ownerProfileError || !ownerProfile) {
      console.error("❌ Owner profile error:", ownerProfileError);
      throw new Error("Could not fetch chat owner's profile.");
    }
    userProfileCreditsBeforeDeduction = ownerProfile.credits_balance;

    // 4. Check owner credits
    if (ownerProfile.credits_balance < modelCost) {
      console.log("❌ Insufficient credits for chat owner.");
      return new Response(
        JSON.stringify({ error: "Insufficient credits for chat owner." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Deduct credits BEFORE LLM call
    const { error: creditDeductionError } = await supabase
      .from("profiles")
      .update({ credits_balance: ownerProfile.credits_balance - modelCost })
      .eq("id", chatOwnerId);

    if (creditDeductionError) {
      console.error("❌ Credit deduction error:", creditDeductionError);
      throw new Error(`Failed to deduct credits: ${creditDeductionError.message}`);
    }
    console.log(`✅ ${modelCost} credits deducted from owner ${chatOwnerId}.`);

    // Get context limit from config
    const { data: contextConfig } = await supabase
      .from("app_config")
      .select("config_value")
      .eq("config_key", "CONTEXT_MESSAGE_LIMIT")
      .single();

    const contextLimit = parseInt(contextConfig?.config_value || "10");

    // Get recent messages for context
    const { data: recentMessages, error: messagesError } = await supabase
      .from("messages")
      .select("content, sender_type")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(contextLimit);

    if (messagesError) {
      throw new Error("Failed to fetch chat history.");
    }

    const contextMessages = recentMessages?.reverse().map(msg => {
      if (msg.sender_type === 'user') {
        return { role: 'user', content: msg.content };
      } else if (msg.sender_type === 'ai') {
        return { role: 'assistant', content: msg.content };
      }
      return null;
    }).filter(Boolean) || [];

    // Add current user message
    contextMessages.push({ role: 'user', content: message });

    let aiResponseContent: string;
    let inputTokens = 0;
    let outputTokens = 0;
    let llmModelUsed = llmApiIdentifier; // Default to the model's API identifier

    // 6. Call appropriate LLM API
    if (llmApiIdentifier === 'google/gemini-1.5-flash') {
      if (!geminiApiKey) {
        throw new Error("Gemini API key (VITE_GEMINI_API_KEY) is not configured.");
      }
      console.log("🤖 Calling Gemini API...");
      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: contextMessages.map(m => ({
                role: m.role === 'user' ? 'user' : 'model', // Gemini uses 'model' for assistant
                parts: [{ text: m.content }]
              })),
              generationConfig: { maxOutputTokens: 1000, temperature: 0.7, topP: 0.8, topK: 40 }
            }),
          }
        );

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          throw new Error(`Gemini API request failed: ${geminiResponse.status} - ${errorText}`);
        }

        const geminiData = await geminiResponse.json();
        aiResponseContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
          "I apologize, but I couldn't generate a response from Gemini. Please try again.";
        // Gemini API doesn't provide token counts directly in this endpoint
        inputTokens = 0;
        outputTokens = 0;
        llmModelUsed = 'google/gemini-1.5-flash'; // Ensure this is consistent
      } catch (geminiApiError) {
        console.error("❌ Gemini API call failed:", geminiApiError);
        throw new Error(`Gemini API error: ${geminiApiError.message}`);
      }
    } else {
      if (!openRouterApiKey) {
        throw new Error("OpenRouter API key (OPENROUTER_API_KEY) is not configured.");
      }
      console.log("🤖 Calling OpenRouter API...");
      try {
        const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://your-app-domain.com", // Replace with your actual domain
            "X-Title": "AI Workspace Chat",
          },
          body: JSON.stringify({
            model: llmApiIdentifier,
            messages: [
              { role: 'system', content: 'You are a helpful AI assistant. Provide clear, concise, and accurate responses.' },
              ...contextMessages
            ],
            max_tokens: 2000,
            temperature: 0.7,
            top_p: 0.9,
            frequency_penalty: 0,
            presence_penalty: 0
          }),
        });

        if (!openRouterResponse.ok) {
          const errorText = await openRouterResponse.text();
          throw new Error(`OpenRouter API request failed: ${openRouterResponse.status} - ${errorText}`);
        }

        const openRouterData: OpenRouterResponse = await openRouterResponse.json();
        aiResponseContent = openRouterData.choices?.[0]?.message?.content ||
          "I apologize, but I couldn't generate a response from OpenRouter. Please try again.";
        inputTokens = openRouterData.usage?.prompt_tokens || 0;
        outputTokens = openRouterData.usage?.completion_tokens || 0;
        llmModelUsed = openRouterData.model; // Use the model identifier returned by OpenRouter
      } catch (openRouterApiError) {
        console.error("❌ OpenRouter API call failed:", openRouterApiError);
        throw new Error(`OpenRouter API error: ${openRouterApiError.message}`);
      }
    }

    console.log("✅ AI response generated.");

    // 7. Save AI message to database
    console.log("💾 Saving AI message to database...");
    const { data: savedMessage, error: messageSaveError } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        sender_id: null, // AI messages don't have a sender_id
        sender_type: "ai",
        content: aiResponseContent,
        model_id: modelId, // Store the LLMModel.id from your database
        token_cost: modelCost, // This is the cost in credits
        message_type: "LLM_TO_USER",
        llm_model_used: llmModelUsed, // The actual API identifier used
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_in_credits: modelCost,
        parent_prompt_id: userPromptId || null,
      })
      .select()
      .single();

    if (messageSaveError) {
      console.error("❌ Message save error:", messageSaveError);
      throw new Error(`Could not save AI message: ${messageSaveError.message}`);
    }
    console.log("✅ AI message saved with ID:", savedMessage.id);

    // 8. Log transaction
    supabase
      .from("credit_transactions")
      .insert({
        user_id: chatOwnerId,
        amount: -modelCost,
        description: `AI response from ${modelName}`,
        chat_id: chatId,
      })
      .then(() => console.log("✅ Transaction logged"))
      .catch(err => console.error("❌ Transaction logging failed:", err));

    // 9. Update last used LLM
    await supabase.rpc('update_last_used_llm', {
      model_identifier: llmApiIdentifier
    });

    console.log("🎉 AI response completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponseContent,
        messageId: savedMessage.id,
        tokensUsed: inputTokens + outputTokens,
        creditsDeducted: modelCost,
        modelUsed: modelName,
        chargedToOwner: chatOwnerId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 ask-llm Function Error:", error);
    console.error("💥 Error stack:", error.stack);

    // Refund credits if an error occurred AFTER deduction but BEFORE successful response
    if (chatOwnerId && deductedCredits > 0) {
      console.log(`🔄 Attempting to refund ${deductedCredits} credits to ${chatOwnerId}...`);
      const { error: refundError } = await supabase
        .from("profiles")
        .update({ credits_balance: userProfileCreditsBeforeDeduction }) // Revert to original balance
        .eq("id", chatOwnerId);

      if (refundError) {
        console.error("❌ CRITICAL: Failed to refund credits:", refundError);
        // Log this to a separate system if possible, as it indicates a potential credit loss
      } else {
        console.log(`✅ ${deductedCredits} credits refunded to ${chatOwnerId}.`);
      }
    }

    // Log error to database (fire and forget)
    try {
      const errorSupabase = createClient(supabaseUrl, supabaseServiceKey);
      errorSupabase
        .from("error_logs")
        .insert({
          user_id: userId,
          chat_id: chatId,
          error_source: "ask-llm Function",
          error_details: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            deductedCredits: deductedCredits,
            chatOwnerId: chatOwnerId,
          },
        })
        .then(() => console.log("✅ Error logged"))
        .catch(() => console.error("❌ Error logging failed"));
    } catch (logErr) {
      console.error("❌ Failed to log error to database:", logErr);
    }

    const errorMessage = error.message.includes("Insufficient credits")
      ? error.message
      : `AI service error: ${error.message}`;

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: {
          type: "function_error",
          originalError: error.message,
          creditsRefunded: chatOwnerId && deductedCredits > 0,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});