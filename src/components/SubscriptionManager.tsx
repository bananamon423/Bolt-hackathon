import React, { useState, useEffect } from 'react';
import { Crown, Zap, Check, X, CreditCard, Users, MessageSquare } from 'lucide-react';
import { Purchases } from '@revenuecat/purchases-js';
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
  refreshSubscription?: () => void;
  revenueCatConfigured: boolean;
}

export function SubscriptionManager({ 
  userId, 
  currentPlan = 'free_plan', 
  currentTokens = 0,
  onClose,
  refreshSubscription,
  revenueCatConfigured
}: SubscriptionManagerProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
    fetchUserSubscription();
  }, [userId]);

  const fetchPlans = async () => {
    try {
      console.log('💳 SubscriptionManager: Fetching subscription plans...');
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly');

      if (error) {
        console.error('❌ SubscriptionManager: Error fetching plans:', error);
        throw error;
      }
      
      console.log('✅ SubscriptionManager: Plans fetched:', data?.length || 0);
      setPlans(data || []);
    } catch (error) {
      console.error('❌ SubscriptionManager: Error fetching plans:', error);
      setError('Failed to load subscription plans');
    }
  };

  const fetchUserSubscription = async () => {
    try {
      console.log('💳 SubscriptionManager: Fetching user subscription...');
      const { data, error } = await supabase
        .from('profiles')
        .select('plan, subscription_status, tokens, last_token_reset')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ SubscriptionManager: Error fetching user subscription:', error);
        throw error;
      }
      
      console.log('✅ SubscriptionManager: User subscription fetched:', data);
      setUserSubscription(data);
    } catch (error) {
      console.error('❌ SubscriptionManager: Error fetching user subscription:', error);
      setError('Failed to load current subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId);
    setError(null);
    
    try {
      console.log('💳 SubscriptionManager: Starting subscription process for plan:', planId);
      
      // Check if RevenueCat is configured
      if (!revenueCatConfigured) {
        throw new Error('RevenueCat is still configuring. Please wait a moment and try again.');
      }

      // Check if Purchases.getOfferings is available
      if (typeof Purchases.getOfferings !== 'function') {
        throw new Error('RevenueCat SDK not properly configured. Please refresh the page and try again.');
      }
      
      // Find the selected plan
      const selectedPlan = plans.find(plan => plan.plan_id === planId);
      if (!selectedPlan) {
        throw new Error('Selected plan not found');
      }

      console.log('💳 SubscriptionManager: Selected plan:', selectedPlan);

      console.log('💳 SubscriptionManager: Getting offerings from RevenueCat...');
      
      // Get available packages from RevenueCat
      const offerings = await Purchases.getOfferings();
      console.log('💳 SubscriptionManager: Available offerings:', offerings);

      // Find the package that matches our plan
      let packageToPurchase = null;
      
      // Look through all offerings for a package with matching identifier
      for (const offering of Object.values(offerings.all)) {
        for (const pkg of offering.availablePackages) {
          if (pkg.identifier === planId || pkg.product.identifier === planId) {
            packageToPurchase = pkg;
            break;
          }
        }
        if (packageToPurchase) break;
      }

      if (!packageToPurchase) {
        console.warn('⚠️ SubscriptionManager: Package not found in RevenueCat, using fallback');
        // If we can't find the exact package, try to use the current offering's default
        const currentOffering = offerings.current;
        if (currentOffering && currentOffering.availablePackages.length > 0) {
          // Try to find a package that might match by price or name
          packageToPurchase = currentOffering.availablePackages.find(pkg => 
            pkg.product.title.toLowerCase().includes(selectedPlan.name.toLowerCase())
          ) || currentOffering.availablePackages[0];
        }
      }

      if (!packageToPurchase) {
        throw new Error(`No RevenueCat package found for plan: ${planId}. Please ensure the plan is configured in RevenueCat.`);
      }

      console.log('💳 SubscriptionManager: Found package to purchase:', packageToPurchase);

      // Attempt the purchase
      console.log('💳 SubscriptionManager: Initiating purchase...');
      const purchaseResult = await Purchases.purchasePackage(packageToPurchase);
      
      console.log('✅ SubscriptionManager: Purchase completed:', purchaseResult);

      // Check if the purchase was successful
      if (purchaseResult.customerInfo.entitlements.active[selectedPlan.revenuecat_entitlement_id]) {
        console.log('✅ SubscriptionManager: Entitlement is active');
        
        // Sync the subscription with Supabase
        const { data, error } = await supabase.rpc('update_user_subscription', {
          p_revenuecat_user_id: userId,
          p_entitlement_ids: [selectedPlan.revenuecat_entitlement_id],
          p_subscription_status: 'active',
          p_original_purchase_date: purchaseResult.customerInfo.originalPurchaseDate || null,
          p_expiration_date: null, // Will be updated by webhook
          p_is_sandbox: false
        });

        if (error) {
          console.error('❌ SubscriptionManager: Failed to sync subscription:', error);
          throw new Error(`Purchase successful but sync failed: ${error.message}`);
        }

        console.log('✅ SubscriptionManager: Subscription synced:', data);
        
        // Refresh subscription data
        if (refreshSubscription) {
          console.log('🔄 SubscriptionManager: Refreshing subscription data...');
          refreshSubscription();
        }
        
        // Close the modal
        setTimeout(() => {
          onClose();
        }, 1000);
        
        // Show success message
        setError(null);
        alert('Subscription activated successfully! Your tokens have been updated.');
        
      } else {
        console.warn('⚠️ SubscriptionManager: Purchase completed but entitlement not active');
        throw new Error('Purchase completed but subscription not activated. Please contact support.');
      }
      
    } catch (error: any) {
      console.error('❌ SubscriptionManager: Subscription error:', error);
      
      // Handle different types of errors
      if (error.code === 'PURCHASE_CANCELLED') {
        console.log('ℹ️ SubscriptionManager: Purchase was cancelled by user');
        setError('Purchase was cancelled');
      } else if (error.code === 'PAYMENT_PENDING') {
        console.log('⏳ SubscriptionManager: Payment is pending');
        setError('Payment is pending. Please wait for confirmation.');
      } else if (error.code === 'PRODUCT_NOT_AVAILABLE') {
        console.error('❌ SubscriptionManager: Product not available');
        setError('This subscription plan is not available. Please try another plan or contact support.');
      } else {
        console.error('❌ SubscriptionManager: Unknown error:', error);
        setError(error.message || 'Failed to process subscription. Please try again.');
      }
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

        {/* RevenueCat Configuration Status */}
        {!revenueCatConfigured && (
          <div className="p-6 bg-yellow-50 border-b border-yellow-200">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <h3 className="font-medium text-yellow-800">Loading subscription options...</h3>
                <p className="text-sm text-yellow-700">Setting up payment system, please wait a moment.</p>
              </div>
            </div>
          </div>
        )}

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

        {/* Error Message */}
        {error && (
          <div className="p-6 border-b border-gray-200">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{error}</p>
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
                      disabled={subscribing === plan.plan_id || !revenueCatConfigured}
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
                          ) : !revenueCatConfigured ? (
                            'Loading...'
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