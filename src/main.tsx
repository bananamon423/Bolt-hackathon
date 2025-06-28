import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Purchases } from '@revenuecat/purchases-js';
import App from './App.tsx';
import './index.css';

// Initialize RevenueCat SDK
const initializeRevenueCat = async () => {
  const revenueCatPublicKey = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;
  
  if (!revenueCatPublicKey) {
    console.warn('⚠️ RevenueCat: VITE_REVENUECAT_PUBLIC_KEY not found in environment variables');
    return;
  }

  try {
    console.log('🚀 RevenueCat: Initializing SDK...');
    await Purchases.configure(revenueCatPublicKey, null);
    console.log('✅ RevenueCat: SDK initialized successfully');
  } catch (error) {
    console.error('❌ RevenueCat: Failed to initialize SDK:', error);
  }
};

// Initialize RevenueCat before rendering the app
initializeRevenueCat().then(() => {
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