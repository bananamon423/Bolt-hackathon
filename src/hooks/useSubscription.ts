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
      
      // Get user profile with subscription data
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

      // Get plan details
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('tokens_per_month')
        .eq('plan_id', profile.plan)
        .single();

      if (planError) {
        console.error('❌ useSubscription: Plan error:', planError);
        // Don't throw here, use default values
        console.log('💳 useSubscription: Using default plan values');
        setSubscription({
          plan: profile.plan,
          tokens: profile.tokens,
          maxTokens: 10, // Default for free plan
          subscriptionStatus: profile.subscription_status,
          lastTokenReset: profile.last_token_reset,
        });
      } else {
        console.log('💳 useSubscription: Plan data:', planData);
        setSubscription({
          plan: profile.plan,
          tokens: profile.tokens,
          maxTokens: planData.tokens_per_month,
          subscriptionStatus: profile.subscription_status,
          lastTokenReset: profile.last_token_reset,
        });
      }
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