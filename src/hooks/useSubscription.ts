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
      
      // Use the new RPC function to get user tokens and plan info
      const { data: tokenData, error: tokenError } = await supabase.rpc('get_user_tokens', {
        p_user_id: userId
      });

      if (tokenError) {
        console.error('❌ useSubscription: Token RPC error:', tokenError);
        throw tokenError;
      }

      console.log('💳 useSubscription: Token data:', tokenData);

      // Also get additional profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_status, last_token_reset')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ useSubscription: Profile error:', profileError);
        // Don't throw here, use default values
        console.log('💳 useSubscription: Using default profile values');
      }

      setSubscription({
        plan: tokenData.plan || 'free_plan',
        tokens: tokenData.tokens || 0,
        maxTokens: tokenData.max_tokens || 10,
        subscriptionStatus: profile?.subscription_status || 'free',
        lastTokenReset: profile?.last_token_reset || new Date().toISOString(),
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