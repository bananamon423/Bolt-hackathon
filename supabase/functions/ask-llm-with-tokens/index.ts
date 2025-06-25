/*
# Token-Based LLM Function

Enhanced version of ask-llm that uses token-based billing instead of credits.
Checks chat owner's token balance and deducts tokens for LLM usage.
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
  userPromptId?: number;
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

  console.log("🚀 ask-llm-with-tokens function started");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiApiKey = Deno.env.get("VITE_GEMINI_API_KEY");
  const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let userId: string | null = null;
  let chatOwnerId: string | null = null;
  let messageId: number | null = null;

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

    const { api_identifier: llmApiIdentifier, cost_per_token: tokenCost, model_name: modelName } = modelData;
    console.log(`✅ Model found: ${modelName} (${llmApiIdentifier}), Token cost: ${tokenCost}`);

    // 3. Check and consume tokens from chat owner
    const { data: tokenResult, error: tokenError } = await supabase.rpc('consume_tokens', {
      p_user_id: chatOwnerId,
      p_tokens_to_consume: tokenCost,
      p_chat_id: chatId,
      p_model_used: llmApiIdentifier
    });

    if (tokenError) {
      console.error("❌ Token consumption error:", tokenError);
      throw new Error(`Token consumption failed: ${tokenError.message}`);
    }

    if (!tokenResult.success) {
      console.log("❌ Token consumption failed:", tokenResult.error);
      return new Response(
        JSON.stringify({ 
          error: tokenResult.error,
          tokens_remaining: tokenResult.tokens_remaining,
          upgrade_required: tokenResult.error === "Insufficient tokens"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ ${tokenCost} tokens consumed. Remaining: ${tokenResult.tokens_remaining}`);

    // 4. Get context for LLM
    const { data: contextConfig } = await supabase
      .from("app_config")
      .select("config_value")
      .eq("config_key", "CONTEXT_MESSAGE_LIMIT")
      .single();

    const contextLimit = parseInt(contextConfig?.config_value || "10");

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

    contextMessages.push({ role: 'user', content: message });

    let aiResponseContent: string;
    let inputTokens = 0;
    let outputTokens = 0;
    let llmModelUsed = llmApiIdentifier;

    // 5. Call appropriate LLM API
    if (llmApiIdentifier === 'google/gemini-1.5-flash') {
      if (!geminiApiKey) {
        throw new Error("Gemini API key (VITE_GEMINI_API_KEY) is not configured.");
      }
      console.log("🤖 Calling Gemini API...");
      
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: contextMessages.map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
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
    } else {
      if (!openRouterApiKey) {
        throw new Error("OpenRouter API key (OPENROUTER_API_KEY) is not configured.");
      }
      console.log("🤖 Calling OpenRouter API...");
      
      const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://your-app-domain.com",
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
      llmModelUsed = openRouterData.model;
    }

    console.log("✅ AI response generated.");

    // 6. Save AI message to database
    console.log("💾 Saving AI message to database...");
    const { data: savedMessage, error: messageSaveError } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        sender_id: null,
        sender_type: "ai",
        content: aiResponseContent,
        model_id: modelId,
        token_cost: tokenCost,
        message_type: "LLM_TO_USER",
        llm_model_used: llmModelUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_in_credits: tokenCost, // For backward compatibility
        parent_prompt_id: userPromptId || null,
      })
      .select()
      .single();

    if (messageSaveError) {
      console.error("❌ Message save error:", messageSaveError);
      throw new Error(`Could not save AI message: ${messageSaveError.message}`);
    }
    
    messageId = savedMessage.id;
    console.log("✅ AI message saved with ID:", messageId);

    // 7. Update token usage log with message ID
    await supabase
      .from("token_usage_logs")
      .update({ message_id: messageId })
      .eq("user_id", chatOwnerId)
      .eq("chat_id", chatId)
      .is("message_id", null)
      .order("created_at", { ascending: false })
      .limit(1);

    // 8. Update last used LLM
    await supabase.rpc('update_last_used_llm', {
      model_identifier: llmApiIdentifier
    });

    console.log("🎉 Token-based AI response completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponseContent,
        messageId: messageId,
        tokensUsed: inputTokens + outputTokens,
        tokensConsumed: tokenCost,
        tokensRemaining: tokenResult.tokens_remaining,
        modelUsed: modelName,
        chargedToOwner: chatOwnerId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 ask-llm-with-tokens Function Error:", error);
    console.error("💥 Error stack:", error.stack);

    // Log error to database
    try {
      const errorSupabase = createClient(supabaseUrl, supabaseServiceKey);
      await errorSupabase
        .from("error_logs")
        .insert({
          user_id: userId,
          chat_id: chatId,
          error_source: "ask-llm-with-tokens Function",
          error_details: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            chatOwnerId: chatOwnerId,
            messageId: messageId,
          },
        });
    } catch (logErr) {
      console.error("❌ Failed to log error to database:", logErr);
    }

    const errorMessage = error.message.includes("Insufficient tokens")
      ? error.message
      : `AI service error: ${error.message}`;

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: {
          type: "function_error",
          originalError: error.message,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});