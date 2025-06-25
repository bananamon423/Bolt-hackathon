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
    if (!userId) return;

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
        () => fetchSubscription()
      )
      .subscribe();

    return () => {
      subscription_channel.unsubscribe();
    };
  }, [userId]);

  const fetchSubscription = async () => {
    if (!userId) return;

    try {
      // Get user profile with subscription data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('plan, tokens, subscription_status, last_token_reset')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Get plan details
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('tokens_per_month')
        .eq('plan_id', profile.plan)
        .single();

      if (planError) throw planError;

      setSubscription({
        plan: profile.plan,
        tokens: profile.tokens,
        maxTokens: planData.tokens_per_month,
        subscriptionStatus: profile.subscription_status,
        lastTokenReset: profile.last_token_reset,
      });
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSubscription = () => {
    fetchSubscription();
  };

  return {
    subscription,
    loading,
    refreshSubscription,
  };
}