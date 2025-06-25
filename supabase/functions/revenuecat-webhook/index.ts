/*
# RevenueCat Webhook Handler

Handles RevenueCat webhook events for subscription management:
- INITIAL_PURCHASE: New subscription
- RENEWAL: Subscription renewal
- ENTITLEMENT_GRANTED: Entitlement granted
- ENTITLEMENT_REVOKED: Entitlement revoked
- CANCELLATION: Subscription cancelled

Updates user subscription status and token allocations in Supabase.
*/

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RevenueCatWebhookEvent {
  event: {
    type: string;
    app_user_id: string;
    original_app_user_id?: string;
    product_id?: string;
    period_type?: string;
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    environment?: string;
    entitlement_ids?: string[];
    entitlement_id?: string;
    store?: string;
    country_code?: string;
    price?: number;
    currency?: string;
    is_family_share?: boolean;
    subscriber_attributes?: Record<string, any>;
  };
  api_version: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  console.log("🎣 RevenueCat webhook received");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const revenueCatSecretKey = Deno.env.get("REVENUECAT_SECRET_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration");
  }

  if (!revenueCatSecretKey) {
    throw new Error("Missing RevenueCat secret key");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verify webhook authenticity (optional but recommended)
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${revenueCatSecretKey}`) {
      console.warn("⚠️ Invalid webhook authorization");
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const webhookData: RevenueCatWebhookEvent = await req.json();
    const { event } = webhookData;

    console.log(`📨 Processing event: ${event.type} for user: ${event.app_user_id}`);

    // Extract relevant data
    const appUserId = event.app_user_id;
    const entitlementIds = event.entitlement_ids || (event.entitlement_id ? [event.entitlement_id] : []);
    const isActive = ["INITIAL_PURCHASE", "RENEWAL", "ENTITLEMENT_GRANTED"].includes(event.type);
    const subscriptionStatus = isActive ? "active" : "inactive";
    const originalPurchaseDate = event.purchased_at_ms ? new Date(event.purchased_at_ms) : null;
    const expirationDate = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
    const isSandbox = event.environment === "SANDBOX";

    console.log(`📊 Event details:`, {
      type: event.type,
      appUserId,
      entitlementIds,
      subscriptionStatus,
      isSandbox
    });

    // Handle different event types
    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "ENTITLEMENT_GRANTED":
        console.log(`✅ Processing subscription activation for user: ${appUserId}`);
        
        const { data: updateResult, error: updateError } = await supabase.rpc(
          'update_user_subscription',
          {
            p_revenuecat_user_id: appUserId,
            p_entitlement_ids: entitlementIds,
            p_subscription_status: subscriptionStatus,
            p_original_purchase_date: originalPurchaseDate?.toISOString(),
            p_expiration_date: expirationDate?.toISOString(),
            p_is_sandbox: isSandbox
          }
        );

        if (updateError) {
          console.error("❌ Failed to update subscription:", updateError);
          throw new Error(`Subscription update failed: ${updateError.message}`);
        }

        console.log("✅ Subscription updated successfully:", updateResult);
        break;

      case "ENTITLEMENT_REVOKED":
      case "CANCELLATION":
      case "EXPIRATION":
        console.log(`❌ Processing subscription deactivation for user: ${appUserId}`);
        
        // Downgrade to free plan
        const { data: downgradeResult, error: downgradeError } = await supabase.rpc(
          'update_user_subscription',
          {
            p_revenuecat_user_id: appUserId,
            p_entitlement_ids: [], // No entitlements
            p_subscription_status: "inactive",
            p_original_purchase_date: originalPurchaseDate?.toISOString(),
            p_expiration_date: expirationDate?.toISOString(),
            p_is_sandbox: isSandbox
          }
        );

        if (downgradeError) {
          console.error("❌ Failed to downgrade subscription:", downgradeError);
          throw new Error(`Subscription downgrade failed: ${downgradeError.message}`);
        }

        console.log("✅ Subscription downgraded successfully:", downgradeResult);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
        break;
    }

    // Log the webhook event for debugging
    await supabase
      .from("error_logs")
      .insert({
        error_source: "RevenueCat Webhook",
        error_details: {
          event_type: event.type,
          app_user_id: appUserId,
          entitlement_ids: entitlementIds,
          webhook_data: webhookData,
          processed_at: new Date().toISOString(),
        },
      });

    console.log("🎉 Webhook processed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook processed successfully",
        event_type: event.type,
        app_user_id: appUserId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("💥 RevenueCat Webhook Error:", error);
    console.error("💥 Error stack:", error.stack);

    // Log error to database
    try {
      const errorSupabase = createClient(supabaseUrl, supabaseServiceKey);
      await errorSupabase
        .from("error_logs")
        .insert({
          error_source: "RevenueCat Webhook Error",
          error_details: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
          },
        });
    } catch (logErr) {
      console.error("❌ Failed to log error:", logErr);
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});