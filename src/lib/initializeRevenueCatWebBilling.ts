import { Purchases } from '@revenuecat/purchases-js';
import { supabase } from './supabase';

interface InitializationResult {
  success: boolean;
  error?: string;
  userId?: string;
}

let isInitialized = false;
let initializationPromise: Promise<InitializationResult> | null = null;

/**
 * Initialize RevenueCat Web Billing SDK with proper Supabase Auth integration
 * Handles timing issues and prevents [Not provided] errors
 */
export async function initializeRevenueCatWebBilling(): Promise<InitializationResult> {
  // Prevent multiple simultaneous initialization attempts
  if (initializationPromise) {
    console.log('🔄 RevenueCat: Initialization already in progress, waiting...');
    return initializationPromise;
  }

  // Return early if already initialized
  if (isInitialized) {
    console.log('✅ RevenueCat: Already initialized');
    return { success: true };
  }

  // Create initialization promise
  initializationPromise = performInitialization();
  
  try {
    const result = await initializationPromise;
    return result;
  } finally {
    // Clear the promise after completion (success or failure)
    initializationPromise = null;
  }
}

async function performInitialization(): Promise<InitializationResult> {
  console.log('🚀 RevenueCat: Starting Web Billing SDK initialization...');

  // 1. Validate API key presence and format
  const revenueCatPublicKey = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;
  
  if (!revenueCatPublicKey) {
    const error = 'VITE_REVENUECAT_PUBLIC_KEY environment variable is missing!';
    console.error('❌ RevenueCat:', error);
    console.error('💡 Please add VITE_REVENUECAT_PUBLIC_KEY=rcb_sb_... to your .env file');
    return { success: false, error };
  }

  if (!revenueCatPublicKey.startsWith('rcb_')) {
    const error = 'Invalid API key format for Web Billing! Keys should start with "rcb_"';
    console.error('❌ RevenueCat:', error);
    console.error('🔑 Current key starts with:', revenueCatPublicKey.substring(0, 4));
    return { success: false, error };
  }

  console.log('🔑 RevenueCat: API key validated:', revenueCatPublicKey.substring(0, 10) + '...');

  // 2. Get user ID from Supabase with multiple fallback strategies
  let userId: string | null = null;

  try {
    console.log('👤 RevenueCat: Attempting to get user ID from Supabase...');

    // Strategy 1: Try getSession first (faster, uses cached session)
    console.log('🔍 Strategy 1: Checking cached session...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.warn('⚠️ RevenueCat: Session error:', sessionError.message);
    } else if (sessionData?.session?.user?.id) {
      userId = sessionData.session.user.id;
      console.log('✅ RevenueCat: Got user ID from session:', userId);
    } else {
      console.log('ℹ️ RevenueCat: No user in cached session');
    }

    // Strategy 2: If session didn't work, try getUser (makes API call)
    if (!userId) {
      console.log('🔍 Strategy 2: Fetching user from API...');
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.warn('⚠️ RevenueCat: User fetch error:', userError.message);
      } else if (userData?.user?.id) {
        userId = userData.user.id;
        console.log('✅ RevenueCat: Got user ID from API:', userId);
      } else {
        console.log('ℹ️ RevenueCat: No user from API call');
      }
    }

    // Strategy 3: Wait a bit and try session again (for hot reload scenarios)
    if (!userId) {
      console.log('🔍 Strategy 3: Waiting 500ms and retrying session...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: retrySessionData } = await supabase.auth.getSession();
      if (retrySessionData?.session?.user?.id) {
        userId = retrySessionData.session.user.id;
        console.log('✅ RevenueCat: Got user ID from retry:', userId);
      }
    }

  } catch (authError) {
    console.error('❌ RevenueCat: Auth error while getting user:', authError);
  }

  // 3. Validate user ID before proceeding
  if (!userId || userId === 'undefined' || userId === 'null') {
    const error = 'No valid user ID available from Supabase Auth';
    console.error('❌ RevenueCat:', error);
    console.error('💡 User might not be logged in or auth is still loading');
    console.error('🔍 Debug info:', {
      userId,
      hasUserId: !!userId,
      userIdType: typeof userId,
      userIdLength: userId?.length
    });
    return { success: false, error, userId: userId || undefined };
  }

  // 4. Configure RevenueCat with validated user ID
  try {
    console.log('⚙️ RevenueCat: Configuring SDK...');
    console.log('👤 User ID:', userId);
    console.log('🔑 API Key:', revenueCatPublicKey.substring(0, 10) + '...');

    // Set debug logging for development
    if (import.meta.env.DEV) {
      Purchases.setLogLevel("DEBUG");
      console.log('🔧 RevenueCat: Debug logging enabled');
    }

    // Configure RevenueCat
    await Purchases.configure({
      apiKey: revenueCatPublicKey,
      appUserID: userId, // Use validated Supabase user ID
    });

    console.log('✅ RevenueCat: SDK configured successfully');
    isInitialized = true;

    // 5. Verify configuration by getting customer info
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('👤 RevenueCat: Customer info retrieved:', {
        originalAppUserId: customerInfo.originalAppUserId,
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
        hasActiveEntitlements: Object.keys(customerInfo.entitlements.active).length > 0
      });
    } catch (customerError) {
      console.warn('⚠️ RevenueCat: Could not retrieve customer info:', customerError.message);
      // Don't fail initialization for this - customer info might not be available immediately
    }

    // Note: For Web Billing, we don't call getOfferings() as offerings are managed via dashboard
    console.log('💡 RevenueCat: Using Web Billing - offerings managed via dashboard');

    return { success: true, userId };

  } catch (configError: any) {
    const error = `Failed to configure RevenueCat SDK: ${configError.message}`;
    console.error('❌ RevenueCat:', error);
    console.error('📋 Error details:', {
      message: configError.message,
      code: configError.code,
      name: configError.name,
      stack: configError.stack
    });
    
    isInitialized = false;
    return { success: false, error, userId };
  }
}

/**
 * Check if RevenueCat is initialized
 */
export function isRevenueCatInitialized(): boolean {
  return isInitialized;
}

/**
 * Reset initialization state (useful for testing or re-initialization)
 */
export function resetRevenueCatInitialization(): void {
  console.log('🔄 RevenueCat: Resetting initialization state');
  isInitialized = false;
  initializationPromise = null;
}