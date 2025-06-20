/*
# AI Chat Edge Function - Fixed Model Identifier

This fixes the Gemini API model identifier issue and improves error handling.

Key fixes:
1. Use correct Gemini model identifier
2. Better error handling and logging
3. Improved response time optimization
4. More robust API calls
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

    if (!geminiApiKey) {
      throw new Error("Missing Gemini API key");
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
      console.error("Auth error:", authError);
      throw new Error("Invalid authentication");
    }

    const { chatId, message, modelId }: RequestPayload = await req.json();

    if (!chatId || !message || !modelId) {
      throw new Error("Missing required parameters");
    }

    console.log("Processing AI request for user:", user.id, "chat:", chatId);

    // Parallel operations to reduce latency
    const [profileResult, contextResult] = await Promise.all([
      // Check user credits
      supabase
        .from("profiles")
        .select("credits_balance")
        .eq("id", user.id)
        .single(),
      
      // Get recent messages (limit to 5 for faster response)
      supabase
        .from("messages")
        .select("content, sender_type, profiles(username)")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(5)
    ]);

    const { data: profile, error: profileError } = profileResult;
    if (profileError || !profile) {
      console.error("Profile error:", profileError);
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

    // Build context for better AI responses
    const { data: recentMessages } = contextResult;
    const context = recentMessages?.reverse().slice(-3).map(msg => 
      `${msg.sender_type === 'user' ? msg.profiles?.username || 'User' : 'Gwiz'}: ${msg.content}`
    ).join('\n') || '';

    // Use the correct Gemini model identifier
    const modelIdentifier = 'gemini-1.5-flash'; // This is the correct model name

    // Build the prompt with context
    const prompt = context 
      ? `Previous conversation:\n${context}\n\nUser: ${message}\n\nGwiz (respond helpfully and concisely):`
      : `User: ${message}\n\nGwiz (respond helpfully and concisely):`;

    console.log("Calling Gemini API with model:", modelIdentifier);

    // Call Gemini API with correct model identifier
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
      console.error("Gemini API error:", geminiResponse.status, errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    console.log("Gemini response received");

    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 
      "I apologize, but I couldn't generate a response. Please try again.";

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
      console.error("Message save error:", messageResult.error);
      throw new Error(`Could not save AI message: ${messageResult.error.message}`);
    }

    if (creditResult.error) {
      console.error("Credit update error:", creditResult.error);
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
      .then(() => console.log("Transaction logged"))
      .catch(err => console.error("Transaction logging failed:", err));

    console.log("AI response completed successfully");

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
        .then(() => console.log("Error logged"))
        .catch(() => console.error("Error logging failed"));
    } catch {}

    const errorMessage = error.message.includes("Gemini") 
      ? `AI service error: ${error.message}`
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