import { Purchases } from '@revenuecat/purchases-js';
import { supabase } from './supabase';

let alreadyInitialized = false;

export async function initializeRevenueCatWebBilling(): Promise<boolean> {
  if (alreadyInitialized) {
    console.log('⚠️ RevenueCat: Already initialized. Skipping.');
    return true;
  }

  console.log('🚀 RevenueCat: Starting Web Billing SDK initialization...');

  const apiKey = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;
  if (!apiKey?.startsWith('rcb_')) {
    console.error('❌ RevenueCat: Invalid or missing API key');
    return false;
  }

  let userId: string | null = null;

  // Polling for user ID up to 10 times with 500ms delay
  for (let attempt = 0; attempt < 10; attempt++) {
    console.log(`🔍 Attempt ${attempt + 1}: Getting user ID...`);

    try {
      const sessionRes = await supabase.auth.getSession();
      userId = sessionRes?.data?.session?.user?.id ?? null;

      if (!userId) {
        const userRes = await supabase.auth.getUser();
        userId = userRes?.data?.user?.id ?? null;
      }

      if (userId) {
        console.log('✅ RevenueCat: Got user ID:', userId);
        break;
      }
    } catch (err) {
      console.warn('⚠️ RevenueCat: Error fetching user ID:', err);
    }

    await new Promise(res => setTimeout(res, 500));
  }

  if (!userId) {
    console.error('❌ RevenueCat: Failed to get valid user ID after retries.');
    return false;
  }

  try {
    await Purchases.configure({ apiKey, appUserID: userId });
    const customerInfo = await Purchases.getCustomerInfo();
    console.log('✅ RevenueCat: SDK configured. Customer info:', customerInfo);
    alreadyInitialized = true;
    return true;
  } catch (err) {
    console.error('❌ RevenueCat: Failed to configure SDK:', err);
    return false;
  }
}

/**
 * Check if RevenueCat is initialized
 */
export function isRevenueCatInitialized(): boolean {
  return alreadyInitialized;
}

/**
 * Reset initialization state (useful for testing or re-initialization)
 */
export function resetRevenueCatInitialization(): void {
  console.log('🔄 RevenueCat: Resetting initialization state');
  alreadyInitialized = false;
}

/**
 * Get initialization status for debugging
 */
export function getRevenueCatStatus() {
  return {
    isInitialized: alreadyInitialized,
    isInitializing: false, // Simplified - no complex state tracking
    hasPromise: false
  };
}