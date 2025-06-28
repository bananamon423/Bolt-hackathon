import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Purchases from '@revenuecat/purchases-js';
import App from './App.tsx';
import './index.css';

// Initialize RevenueCat SDK
const initializeRevenueCat = async () => {
  const revenueCatPublicKey = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;
  
  if (!revenueCatPublicKey) {
    console.warn('⚠️ RevenueCat: VITE_REVENUECAT_PUBLIC_KEY not found in environment variables');
    return false;
  }

  // Check if the key is a valid RevenueCat key format
  if (!revenueCatPublicKey.startsWith('rc_')) {
    console.warn('⚠️ RevenueCat: Invalid API key format. Please use a RevenueCat Web Billing or Paddle API key that starts with "rc_"');
    return false;
  }

  try {
    console.log('🚀 RevenueCat: Initializing SDK...');
    // Use empty string instead of null for anonymous users
    await Purchases.configure(revenueCatPublicKey, "");
    console.log('✅ RevenueCat: SDK initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ RevenueCat: Failed to initialize SDK:', error);
    return false;
  }
};

// Initialize RevenueCat before rendering the app
initializeRevenueCat().then((success) => {
  if (!success) {
    console.log('ℹ️ App will continue without RevenueCat features');
  }
  
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}).catch((error) => {
  console.error('❌ Failed to initialize RevenueCat:', error);
  // Render app anyway, but RevenueCat features won't work
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});