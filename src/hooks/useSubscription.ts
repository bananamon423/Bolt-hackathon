import { useState, useEffect } from 'react';
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

    console.log('💳 useSubscription: Fetching subscription for user:', userId);
    fetchSubscription();

    // Subscribe to profile changes
    const subscription_channel = supabase
      .channel('profile_subscription')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        () => {
          console.log('💳 useSubscription: Profile updated, refetching...');
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      console.log('💳 useSubscription: Cleaning up subscription');
      subscription_channel.unsubscribe();
    };
  }, [userId]);

  const fetchSubscription = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      console.log('💳 useSubscription: Fetching profile data...');
      
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

      console.log('💳 useSubscription: Profile data:', profile);

      // Get subscription plan details to determine max tokens
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('tokens_per_month')
        .eq('plan_id', profile.plan)
        .eq('is_active', true)
        .single();

      if (planError) {
        console.error('❌ useSubscription: Plan error:', planError);
        // Don't throw here, use default values for free plan
        console.log('💳 useSubscription: Using default plan values');
      }

      const maxTokens = planData?.tokens_per_month || 10; // Default to 10 for free plan

      setSubscription({
        plan: profile.plan || 'free_plan',
        tokens: profile.tokens || 0,
        maxTokens: maxTokens,
        subscriptionStatus: profile.subscription_status || 'free',
        lastTokenReset: profile.last_token_reset || new Date().toISOString(),
      });

    } catch (error) {
      console.error('❌ useSubscription: Fetch failed:', error);
      // Set a default subscription instead of leaving it null
      setSubscription({
        plan: 'free_plan',
        tokens: 10,
        maxTokens: 10,
        subscriptionStatus: 'free',
        lastTokenReset: new Date().toISOString(),
      });
    } finally {
      console.log('💳 useSubscription: Setting loading to false');
      setLoading(false);
    }
  };

  const refreshSubscription = () => {
    console.log('💳 useSubscription: Manual refresh requested');
    fetchSubscription();
  };

  return {
    subscription,
    loading,
    refreshSubscription,
  };
}