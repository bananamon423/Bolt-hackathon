import { useState, useEffect } from 'react';
import { Purchases } from '@revenuecat/purchases-js';
import { supabase } from '../lib/supabase';

interface SubscriptionData {
  plan: string;
  tokens: number;
  maxTokens: number;
  subscriptionStatus: string;
  lastTokenReset: string;
}

export function useSubscription(userId: string | undefined) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      console.log('💳 useSubscription: No user ID provided');
      setLoading(false);
      return;
    }

    console.log('💳 useSubscription: Initializing subscription tracking for user:', userId);
    initializeRevenueCat();
    fetchSubscription();

    // Subscribe to profile changes with enhanced logging
    const subscription_channel = supabase
      .channel(`profile_subscription_${userId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: userId },
          private: false
        }
      })
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 useSubscription: Profile UPDATE event received:', {
            userId: payload.new.id,
            newTokens: payload.new.tokens,
            newPlan: payload.new.plan,
            subscriptionStatus: payload.new.subscription_status,
            eventType: payload.eventType
          });
          
          // Immediately update local state with new data
          if (payload.new) {
            console.log('⚡ useSubscription: Applying real-time profile update');
            updateSubscriptionFromProfile(payload.new);
          }
          
          // Also fetch fresh data to ensure consistency
          console.log('🔄 useSubscription: Fetching fresh subscription data after real-time update');
          fetchSubscription();
        }
      )
      .subscribe((status) => {
        console.log('📡 useSubscription: Profile subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ useSubscription: Successfully subscribed to profile changes for user:', userId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ useSubscription: Channel subscription error for user:', userId);
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ useSubscription: Subscription timed out for user:', userId);
        } else if (status === 'CLOSED') {
          console.log('🔒 useSubscription: Subscription closed for user:', userId);
        }
      });

    return () => {
      console.log('🧹 useSubscription: Cleaning up subscription for user:', userId);
      subscription_channel.unsubscribe();
    };
  }, [userId]);

  const initializeRevenueCat = async () => {
    if (!userId) return;

    try {
      console.log('🚀 useSubscription: Configuring RevenueCat for user:', userId);
      
      const revenueCatPublicKey = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;
      if (!revenueCatPublicKey) {
        console.warn('⚠️ useSubscription: VITE_REVENUECAT_PUBLIC_KEY not found');
        return;
      }

      // Configure RevenueCat with user ID
      await Purchases.configure({
        apiKey: revenueCatPublicKey,
        appUserID: userId,
      });

      console.log('✅ useSubscription: RevenueCat configured successfully');

      // Sync RevenueCat entitlements with Supabase
      await syncRevenueCatEntitlements();

    } catch (error) {
      console.error('❌ useSubscription: RevenueCat configuration failed:', error);
    }
  };

  const syncRevenueCatEntitlements = async () => {
    if (!userId) return;

    try {
      console.log('🔄 useSubscription: Syncing RevenueCat entitlements...');
      
      // Get customer info from RevenueCat
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('📊 useSubscription: Customer info:', customerInfo);

      // Extract active entitlements
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      console.log('🎫 useSubscription: Active entitlements:', activeEntitlements);

      // Update user subscription in Supabase
      const { data, error } = await supabase.rpc('update_user_subscription', {
        p_revenuecat_user_id: userId,
        p_entitlement_ids: activeEntitlements,
        p_subscription_status: activeEntitlements.length > 0 ? 'active' : 'inactive',
        p_original_purchase_date: customerInfo.originalPurchaseDate || null,
        p_expiration_date: null, // Will be set by RevenueCat webhook
        p_is_sandbox: customerInfo.entitlements.active ? false : true // Detect sandbox
      });

      if (error) {
        console.error('❌ useSubscription: Failed to update subscription:', error);
        throw error;
      }

      console.log('✅ useSubscription: Subscription synced successfully:', data);

    } catch (error) {
      console.error('❌ useSubscription: Failed to sync entitlements:', error);
    }
  };

  const updateSubscriptionFromProfile = async (profileData: any) => {
    try {
      console.log('🔄 useSubscription: Updating subscription from profile data:', {
        plan: profileData.plan,
        tokens: profileData.tokens,
        subscriptionStatus: profileData.subscription_status
      });

      // Get subscription plan details to determine max tokens
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('tokens_per_month')
        .eq('plan_id', profileData.plan)
        .eq('is_active', true)
        .single();

      if (planError) {
        console.warn('⚠️ useSubscription: Could not fetch plan data, using defaults:', planError);
      }

      const maxTokens = planData?.tokens_per_month || 10; // Default to 10 for free plan

      const newSubscription = {
        plan: profileData.plan || 'free_plan',
        tokens: profileData.tokens || 0,
        maxTokens: maxTokens,
        subscriptionStatus: profileData.subscription_status || 'free',
        lastTokenReset: profileData.last_token_reset || new Date().toISOString(),
      };

      console.log('✅ useSubscription: Setting new subscription data:', newSubscription);
      setSubscription(newSubscription);

    } catch (error) {
      console.error('❌ useSubscription: Error updating subscription from profile:', error);
    }
  };

  const fetchSubscription = async () => {
    if (!userId) {
      console.log('🚫 useSubscription: Cannot fetch subscription - no userId');
      setLoading(false);
      return;
    }

    try {
      console.log('💳 useSubscription: Fetching profile data for user:', userId);
      
      // Get user profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('plan, tokens, subscription_status, last_token_reset')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ useSubscription: Profile error:', profileError);
        throw profileError;
      }

      console.log('💳 useSubscription: Profile data fetched:', {
        plan: profile.plan,
        tokens: profile.tokens,
        subscriptionStatus: profile.subscription_status,
        lastTokenReset: profile.last_token_reset
      });

      // Get subscription plan details to determine max tokens
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('tokens_per_month')
        .eq('plan_id', profile.plan)
        .eq('is_active', true)
        .single();

      if (planError) {
        console.warn('⚠️ useSubscription: Plan error (using defaults):', planError);
      } else {
        console.log('💳 useSubscription: Plan data fetched:', {
          planId: profile.plan,
          tokensPerMonth: planData.tokens_per_month
        });
      }

      const maxTokens = planData?.tokens_per_month || 10; // Default to 10 for free plan

      const subscriptionData = {
        plan: profile.plan || 'free_plan',
        tokens: profile.tokens || 0,
        maxTokens: maxTokens,
        subscriptionStatus: profile.subscription_status || 'free',
        lastTokenReset: profile.last_token_reset || new Date().toISOString(),
      };

      console.log('✅ useSubscription: Setting subscription data:', subscriptionData);
      setSubscription(subscriptionData);

    } catch (error) {
      console.error('❌ useSubscription: Fetch failed:', error);
      // Set a default subscription instead of leaving it null
      const defaultSubscription = {
        plan: 'free_plan',
        tokens: 10,
        maxTokens: 10,
        subscriptionStatus: 'free',
        lastTokenReset: new Date().toISOString(),
      };
      
      console.log('🔄 useSubscription: Setting default subscription due to error:', defaultSubscription);
      setSubscription(defaultSubscription);
    } finally {
      console.log('💳 useSubscription: Setting loading to false');
      setLoading(false);
    }
  };

  const refreshSubscription = () => {
    console.log('💳 useSubscription: Manual refresh requested');
    if (userId) {
      syncRevenueCatEntitlements();
    }
    fetchSubscription();
  };

  return {
    subscription,
    loading,
    refreshSubscription,
  };
}