/*
# OpenRouter Multi-LLM Chat Function

This function handles AI chat requests through OpenRouter, supporting multiple LLM models
with proper context management, token tracking, and credit system integration.

Features:
- Multiple LLM support via OpenRouter
- Context management with configurable message limits
- Token usage tracking
- Credit system integration
- Comprehensive error handling and logging
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

  console.log("🚀 OpenRouter Chat function started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get OpenRouter API key from app config
    const { data: configData, error: configError } = await supabase
      .from("app_config")
      .select("config_value")
      .eq("config_key", "OPENROUTER_API_KEY")
      .single();

    if (configError || !configData?.config_value) {
      throw new Error("OpenRouter API key not configured");
    }

    const openRouterApiKey = configData.config_value;

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

    const { chatId, message, modelId, userPromptId }: RequestPayload = await req.json();

    if (!chatId || !message || !modelId) {
      throw new Error("Missing required parameters");
    }

    console.log(`👤 User ${user.id} asking: "${message}" using model ${modelId}`);

    // Get model information
    const { data: modelData, error: modelError } = await supabase
      .from("llm_models")
      .select("*")
      .eq("id", modelId)
      .single();

    if (modelError || !modelData) {
      throw new Error("Invalid model ID");
    }

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

    if (profile.credits_balance < modelData.cost_per_token) {
      console.log("❌ Insufficient credits");
      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get context limit from config
    const { data: contextConfig } = await supabase
      .from("app_config")
      .select("config_value")
      .eq("config_key", "CONTEXT_MESSAGE_LIMIT")
      .single();

    const contextLimit = parseInt(contextConfig?.config_value || "10");

    // Get recent messages for context
    const { data: recentMessages } = await supabase
      .from("messages")
      .select(`
        content, 
        sender_type, 
        llm_model_used,
        profiles(username)
      `)
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(contextLimit);

    // Build conversation context
    const contextMessages = recentMessages?.reverse().map(msg => {
      if (msg.sender_type === 'user') {
        return {
          role: 'user',
          content: msg.content
        };
      } else if (msg.sender_type === 'ai') {
        return {
          role: 'assistant',
          content: msg.content
        };
      }
      return null;
    }).filter(Boolean) || [];

    // Add current user message
    contextMessages.push({
      role: 'user',
      content: message
    });

    console.log(`🤖 Calling OpenRouter with ${contextMessages.length} context messages`);

    // Call OpenRouter API
    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-app-domain.com", // Replace with your domain
        "X-Title": "AI Workspace Chat"
      },
      body: JSON.stringify({
        model: modelData.api_identifier,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant. Provide clear, concise, and accurate responses.'
          },
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
      console.error("❌ OpenRouter API error:", openRouterResponse.status, errorText);
      throw new Error(`OpenRouter API error: ${openRouterResponse.status} - ${errorText}`);
    }

    const openRouterData: OpenRouterResponse = await openRouterResponse.json();
    const aiResponse = openRouterData.choices?.[0]?.message?.content || 
      "I apologize, but I couldn't generate a response. Please try again.";

    console.log("✅ OpenRouter response received, length:", aiResponse.length);

    // Calculate credit cost (use model's cost_per_token)
    const creditCost = modelData.cost_per_token;

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
        token_cost: creditCost,
        message_type: "LLM_TO_USER",
        metadata: {
          openrouter_response_id: openRouterData.id,
          model_used: openRouterData.model,
          finish_reason: openRouterData.choices?.[0]?.finish_reason
        },
        llm_model_used: modelData.api_identifier,
        input_tokens: openRouterData.usage?.prompt_tokens || 0,
        output_tokens: openRouterData.usage?.completion_tokens || 0,
        cost_in_credits: creditCost,
        parent_prompt_id: userPromptId || null
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
      .update({ credits_balance: profile.credits_balance - creditCost })
      .eq("id", user.id);

    if (creditError) {
      console.error("❌ Credit update error:", creditError);
      throw new Error(`Could not deduct credits: ${creditError.message}`);
    }

    console.log(`✅ Credits updated: -${creditCost}`);

    // Update last used LLM
    await supabase.rpc('update_last_used_llm', {
      model_identifier: modelData.api_identifier
    });

    // Log transaction (fire and forget)
    supabase
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: -creditCost,
        description: `AI response from ${modelData.model_name}`,
        chat_id: chatId,
      })
      .then(() => console.log("✅ Transaction logged"))
      .catch(err => console.error("❌ Transaction logging failed:", err));

    console.log("🎉 OpenRouter AI response completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: aiResponse,
        messageId: savedMessage.id,
        tokensUsed: openRouterData.usage?.total_tokens || 0,
        creditsDeducted: creditCost,
        modelUsed: modelData.model_name
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 OpenRouter Chat Error:", error);

    // Log error to database (fire and forget)
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      supabase
        .from("error_logs")
        .insert({
          error_source: "OpenRouter Chat Function",
          error_details: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
          },
        })
        .then(() => console.log("✅ Error logged"))
        .catch(() => console.error("❌ Error logging failed"));
    } catch {}

    const errorMessage = error.message.includes("OpenRouter") 
      ? `AI service error: ${error.message}`
      : error.message.includes("credits")
      ? error.message
      : "AI service temporarily unavailable. Please try again.";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});