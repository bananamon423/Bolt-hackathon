import React, { useState, useEffect } from 'react';
import { Crown, Zap, Check, X, CreditCard, Users, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SubscriptionPlan {
  id: string;
  plan_id: string;
  name: string;
  tokens_per_month: number;
  price_monthly: number;
  revenuecat_entitlement_id: string;
  is_active: boolean;
}

interface UserSubscription {
  plan_id: string;
  subscription_status: string;
  tokens: number;
  last_token_reset: string;
}

interface SubscriptionManagerProps {
  userId: string;
  currentPlan?: string;
  currentTokens?: number;
  onClose: () => void;
}

export function SubscriptionManager({ 
  userId, 
  currentPlan = 'free_plan', 
  currentTokens = 0,
  onClose 
}: SubscriptionManagerProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
    fetchUserSubscription();
  }, [userId]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchUserSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('plan, subscription_status, tokens, last_token_reset')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserSubscription(data);
    } catch (error) {
      console.error('Error fetching user subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId);
    
    try {
      // In a real implementation, you would:
      // 1. Call RevenueCat SDK to initiate purchase
      // 2. Handle the purchase flow
      // 3. RevenueCat webhook will update the subscription
      
      // For demo purposes, we'll simulate the subscription update
      console.log(`Subscribing to plan: ${planId}`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In production, this would be handled by the RevenueCat webhook
      alert(`Subscription to ${planId} initiated! In production, this would open the payment flow.`);
      
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Failed to initiate subscription. Please try again.');
    } finally {
      setSubscribing(null);
    }
  };

  const getPlanFeatures = (plan: SubscriptionPlan) => {
    const features = [
      `${plan.tokens_per_month} AI messages per month`,
      'Access to all AI models',
      'Real-time collaboration',
    ];

    if (plan.plan_id === 'beginner_plan') {
      features.push('Priority support');
    } else if (plan.plan_id === 'pro_plan') {
      features.push('Priority support', 'Advanced analytics', 'Custom integrations');
    }

    return features;
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'free_plan':
        return <MessageSquare className="w-8 h-8" />;
      case 'beginner_plan':
        return <Zap className="w-8 h-8" />;
      case 'pro_plan':
        return <Crown className="w-8 h-8" />;
      default:
        return <MessageSquare className="w-8 h-8" />;
    }
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'free_plan':
        return 'from-gray-500 to-gray-600';
      case 'beginner_plan':
        return 'from-blue-500 to-cyan-500';
      case 'pro_plan':
        return 'from-purple-500 to-pink-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const isCurrentPlan = (planId: string) => {
    return userSubscription?.plan_id === planId || currentPlan === planId;
  };

  const formatTokenReset = (resetDate: string) => {
    const date = new Date(resetDate);
    const nextReset = new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000); // Add 30 days
    return nextReset.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading subscription plans...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Subscription Plans</h2>
              <p className="text-gray-600 mt-1">Choose the plan that works best for you</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Current Usage */}
        {userSubscription && (
          <div className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Current Usage</h3>
                <p className="text-sm text-gray-600">
                  {userSubscription.tokens} tokens remaining • 
                  Next reset: {formatTokenReset(userSubscription.last_token_reset)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{userSubscription.tokens}</div>
                <div className="text-sm text-gray-500">tokens left</div>
              </div>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="p-6">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl border-2 p-6 transition-all duration-200 ${
                  isCurrentPlan(plan.plan_id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Plan Header */}
                <div className="text-center mb-6">
                  <div className={`w-16 h-16 bg-gradient-to-br ${getPlanColor(plan.plan_id)} rounded-xl flex items-center justify-center text-white mx-auto mb-4`}>
                    {getPlanIcon(plan.plan_id)}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">
                      ${plan.price_monthly}
                    </span>
                    <span className="text-gray-500">/month</span>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6">
                  {getPlanFeatures(plan).map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                <div className="mt-auto">
                  {isCurrentPlan(plan.plan_id) ? (
                    <div className="w-full bg-blue-100 text-blue-700 py-3 px-4 rounded-lg text-center font-medium">
                      Current Plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.plan_id)}
                      disabled={subscribing === plan.plan_id}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                        plan.plan_id === 'free_plan'
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {subscribing === plan.plan_id ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          {plan.plan_id === 'free_plan' ? (
                            'Downgrade'
                          ) : (
                            <>
                              <CreditCard className="w-5 h-5" />
                              Subscribe
                            </>
                          )}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Popular Badge */}
                {plan.plan_id === 'beginner_plan' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-center text-sm text-gray-600">
            <p>
              All plans include access to multiple AI models, real-time collaboration, and secure data storage.
            </p>
            <p className="mt-2">
              Need a custom plan? <a href="mailto:support@example.com" className="text-blue-600 hover:underline">Contact us</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}