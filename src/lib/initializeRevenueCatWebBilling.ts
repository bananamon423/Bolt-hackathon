import { Purchases } from '@revenuecat/purchases-js';
import { supabase } from './supabase';

interface InitializationResult {
  success: boolean;
  error?: string;
  userId?: string;
}

// Singleton state management
let isInitialized = false;
let initializationPromise: Promise<InitializationResult> | null = null;
let isInitializing = false;

/**
 * Wait for a valid user ID from Supabase with polling and multiple strategies
 */
async function waitForUserId(): Promise<string> {
  console.log('👤 RevenueCat: Starting user ID polling...');
  
  for (let attempt = 1; attempt <= 10; attempt++) {
    console.log(`🔍 RevenueCat: User ID attempt ${attempt}/10`);
    
    try {
      // Strategy 1: Check cached session first (fastest)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (!sessionError && sessionData?.session?.user?.id) {
        const userId = sessionData.session.user.id;
        console.log(`✅ RevenueCat: Got user ID from session (attempt ${attempt}):`, userId);
        return userId;
      }
      
      // Strategy 2: Fetch user from API
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (!userError && userData?.user?.id) {
        const userId = userData.user.id;
        console.log(`✅ RevenueCat: Got user ID from API (attempt ${attempt}):`, userId);
        return userId;
      }
      
      // Log what we found (or didn't find)
      console.log(`⏳ RevenueCat: Attempt ${attempt} - No valid user ID yet`, {
        sessionError: sessionError?.message,
        userError: userError?.message,
        hasSession: !!sessionData?.session,
        hasUser: !!userData?.user,
        sessionUserId: sessionData?.session?.user?.id,
        userDataUserId: userData?.user?.id
      });
      
    } catch (error) {
      console.warn(`⚠️ RevenueCat: Error in attempt ${attempt}:`, error);
    }
    
    // Wait 500ms before next attempt (except on last attempt)
    if (attempt < 10) {
      console.log(`⏳ RevenueCat: Waiting 500ms before attempt ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  throw new Error("User ID unavailable after multiple attempts - user may not be logged in");
}

/**
 * Perform the actual RevenueCat initialization
 */
async function performInitialization(): Promise<InitializationResult> {
  console.log('🚀 RevenueCat: Starting robust Web Billing SDK initialization...');
  
  // Prevent concurrent initialization attempts
  if (isInitializing) {
    throw new Error('Initialization already in progress');
  }
  
  isInitializing = true;
  
  try {
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

    // 2. Wait for valid user ID with polling
    let userId: string;
    
    try {
      userId = await waitForUserId();
    } catch (userError) {
      const error = `Failed to get user ID: ${userError.message}`;
      console.error('❌ RevenueCat:', error);
      return { success: false, error, userId: undefined };
    }

    // 3. Validate user ID format
    if (!userId || userId === 'undefined' || userId === 'null' || userId.trim() === '') {
      const error = `Invalid user ID format: "${userId}"`;
      console.error('❌ RevenueCat:', error);
      return { success: false, error, userId };
    }

    console.log('✅ RevenueCat: Valid user ID obtained:', userId);

    // 4. Configure RevenueCat with validated user ID
    try {
      console.log('⚙️ RevenueCat: Configuring SDK...');
      
      // Set debug logging for development
      if (import.meta.env.DEV) {
        Purchases.setLogLevel("DEBUG");
        console.log('🔧 RevenueCat: Debug logging enabled');
      }

      // Configure RevenueCat with validated user ID
      await Purchases.configure({
        apiKey: revenueCatPublicKey,
        appUserID: userId, // Guaranteed to be valid at this point
      });

      console.log('✅ RevenueCat: SDK configured successfully');
      isInitialized = true;

      // 5. Verify configuration by getting customer info
      try {
        console.log('👤 RevenueCat: Verifying configuration with customer info...');
        const customerInfo = await Purchases.getCustomerInfo();
        
        console.log('✅ RevenueCat: Customer info retrieved successfully:', {
          originalAppUserId: customerInfo.originalAppUserId,
          activeEntitlements: Object.keys(customerInfo.entitlements.active),
          hasActiveEntitlements: Object.keys(customerInfo.entitlements.active).length > 0,
          latestExpirationDate: customerInfo.latestExpirationDate,
          originalPurchaseDate: customerInfo.originalPurchaseDate
        });
        
        // Verify the user ID matches what we configured
        if (customerInfo.originalAppUserId !== userId) {
          console.warn('⚠️ RevenueCat: User ID mismatch!', {
            configured: userId,
            returned: customerInfo.originalAppUserId
          });
        }
        
      } catch (customerError) {
        console.warn('⚠️ RevenueCat: Could not retrieve customer info:', customerError.message);
        // Don't fail initialization for this - customer info might not be available immediately
      }

      console.log('🎉 RevenueCat: Initialization completed successfully!');
      console.log('💡 RevenueCat: Using Web Billing - offerings managed via dashboard');

      return { success: true, userId };

    } catch (configError: any) {
      const error = `Failed to configure RevenueCat SDK: ${configError.message}`;
      console.error('❌ RevenueCat:', error);
      console.error('📋 Error details:', {
        message: configError.message,
        code: configError.code,
        name: configError.name,
        userId: userId
      });
      
      isInitialized = false;
      return { success: false, error, userId };
    }
    
  } finally {
    isInitializing = false;
  }
}

/**
 * Initialize RevenueCat Web Billing SDK with singleton pattern
 * Ensures only one initialization attempt at a time
 */
export async function initializeRevenueCatWebBilling(): Promise<InitializationResult> {
  // Return early if already initialized
  if (isInitialized) {
    console.log('✅ RevenueCat: Already initialized (singleton check)');
    return { success: true };
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    console.log('🔄 RevenueCat: Initialization already in progress, waiting...');
    return initializationPromise;
  }

  // Start new initialization
  console.log('🚀 RevenueCat: Starting new initialization...');
  initializationPromise = performInitialization();
  
  try {
    const result = await initializationPromise;
    
    if (result.success) {
      console.log('🎉 RevenueCat: Singleton initialization successful');
    } else {
      console.error('❌ RevenueCat: Singleton initialization failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ RevenueCat: Unexpected initialization error:', error);
    isInitialized = false;
    return { 
      success: false, 
      error: `Unexpected error: ${error.message}` 
    };
  } finally {
    // Clear the promise after completion (success or failure)
    initializationPromise = null;
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
  isInitializing = false;
}

/**
 * Get initialization status for debugging
 */
export function getRevenueCatStatus() {
  return {
    isInitialized,
    isInitializing,
    hasPromise: !!initializationPromise
  };
}