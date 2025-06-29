import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Purchases } from '@revenuecat/purchases-js';
import { useAuth } from './hooks/useAuth';
import { useChats } from './hooks/useChats';
import { useMessages } from './hooks/useMessages';
import { useModels } from './hooks/useModels';
import { usePresence } from './hooks/usePresence';
import { useSubscription } from './hooks/useSubscription';
import { AuthForm } from './components/AuthForm';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { SubscriptionManager } from './components/SubscriptionManager';
import { TokenUsageIndicator } from './components/TokenUsageIndicator';
import { AdminPage } from './pages/AdminPage';
import { SharedChatPage } from './pages/SharedChatPage';
import { Chat, LLMModel, Profile } from './lib/supabase';
import { supabase } from './lib/supabase';

function MainApp() {
  const location = useLocation();
  const { user, profile, loading: authLoading, signIn, signUp, signOut, refreshProfile } = useAuth();
  const { subscription, loading: subscriptionLoading, refreshSubscription } = useSubscription(user?.id);
  
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [thinkingModelName, setThinkingModelName] = useState<string>('');
  const [showSubscriptionManager, setShowSubscriptionManager] = useState(false);
  const [chatOwnerTokens, setChatOwnerTokens] = useState(0);
  const [chatOwnerProfile, setChatOwnerProfile] = useState<Profile | null>(null);
  const [revenueCatSDKInitialized, setRevenueCatSDKInitialized] = useState(false);
  const [revenueCatConfigured, setRevenueCatConfigured] = useState(false);

  const { chats, loading: chatsLoading, createChat, updateChatTitle, deleteChat, canDeleteChat, deletingChatId } = useChats(user?.id);
  const { messages, sendMessage, sendAIMessage } = useMessages(currentChat?.id, profile);
  const { models } = useModels();
  const onlineUsers = usePresence(currentChat?.id, user?.id);

  // 🚨 DEVELOPMENT ONLY: RevenueCat Error Injection Test
  useEffect(() => {
    if (import.meta.env.DEV) {
      const testRevenueCatErrors = async () => {
        console.log('🧪 [DEV ONLY] Starting RevenueCat Error Injection Test...');
        console.log('🎯 This test intentionally triggers errors to verify error logging');
        
        try {
          // Test 1: Configure with invalid API key
          console.log('🔧 Test 1: Configuring RevenueCat with INVALID API key...');
          
          await Purchases.configure({
            apiKey: 'invalid_api_key_12345',
          });
          
          console.log('⚠️ Test 1: Unexpected success with invalid API key');
          
        } catch (configError) {
          console.log('✅ Test 1: Expected error caught during configure:');
          console.error('📋 Configure Error Details:', {
            message: configError.message,
            code: configError.code,
            name: configError.name,
            stack: configError.stack
          });
        }

        try {
          // Test 2: Attempt login with fake user ID
          console.log('🔧 Test 2: Attempting RevenueCat login with fake user ID...');
          
          const loginResult = await Purchases.logIn('fake_user_id_12345');
          
          console.log('⚠️ Test 2: Unexpected success with fake user ID:', loginResult);
          
        } catch (loginError) {
          console.log('✅ Test 2: Expected error caught during login:');
          console.error('📋 Login Error Details:', {
            message: loginError.message,
            code: loginError.code,
            name: loginError.name,
            stack: loginError.stack
          });
        }

        try {
          // Test 3: Try to get offerings without proper configuration
          console.log('🔧 Test 3: Attempting to get offerings after invalid configuration...');
          
          const offerings = await Purchases.getOfferings();
          
          console.log('⚠️ Test 3: Unexpected success getting offerings:', offerings);
          
        } catch (offeringsError) {
          console.log('✅ Test 3: Expected error caught during getOfferings:');
          console.error('📋 Offerings Error Details:', {
            message: offeringsError.message,
            code: offeringsError.code,
            name: offeringsError.name,
            stack: offeringsError.stack
          });
        }

        console.log('🏁 [DEV ONLY] RevenueCat Error Injection Test Complete');
        console.log('💡 Check the console above for error details and verify they are being logged properly');
      };

      // Run the error test after a short delay to let other initialization complete
      const timeoutId = setTimeout(testRevenueCatErrors, 2000);
      
      return () => clearTimeout(timeoutId);
    }
  }, []); // Run once on component mount in development only

  // Initialize RevenueCat SDK once on app startup (without user ID)
  useEffect(() => {
    const initializeRevenueCatSDK = async () => {
      if (revenueCatSDKInitialized) return;

      const revenueCatPublicKey = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;
      
      if (!revenueCatPublicKey) {
        console.error('❌ RevenueCat: VITE_REVENUECAT_PUBLIC_KEY not found in environment variables');
        return;
      }

      if (!revenueCatPublicKey.startsWith('rcb_')) {
        console.warn('⚠️ RevenueCat: API key should start with "rcb_" for Web Billing. Current key starts with:', revenueCatPublicKey.substring(0, 4));
        return;
      }

      try {
        console.log('🔑 Initializing RevenueCat SDK...');
        Purchases.setLogLevel("DEBUG");
        
        await Purchases.configure({
          apiKey: revenueCatPublicKey,
        });
        
        console.log('✅ RevenueCat SDK initialized successfully');
        setRevenueCatSDKInitialized(true);
      } catch (error) {
        console.error('❌ Failed to initialize RevenueCat SDK:', error);
        setRevenueCatSDKInitialized(false);
      }
    };

    initializeRevenueCatSDK();
  }, []); // Run once on component mount

  // Handle RevenueCat user login/logout based on authentication state
  useEffect(() => {
    const handleRevenueCatUserAuth = async () => {
      if (!revenueCatSDKInitialized) {
        console.log('⏳ RevenueCat SDK not initialized yet, waiting...');
        return;
      }

      if (authLoading) {
        console.log('⏳ Auth still loading, waiting for user ID to become available for RevenueCat login/logout...');
        return;
      }

      try {
        if (user?.id) {
          // User is logged in - log them into RevenueCat
          console.log('🔑 Attempting RevenueCat login for user ID:', user.id);
          
          const { customerInfo } = await Purchases.logIn(user.id);
          
          console.log('✅ RevenueCat logged in with user ID:', user.id);
          console.log('👤 RevenueCat customer info:', customerInfo);
          setRevenueCatConfigured(true);

          // Test fetching offerings after successful login
          try {
            const offerings = await Purchases.getOfferings();
            console.log('📦 RevenueCat: Offerings fetched successfully:', offerings);
            console.log('🎯 RevenueCat: Current offering:', offerings.current);
            console.log('📋 RevenueCat: All offerings:', Object.keys(offerings.all));
          } catch (offeringsError) {
            console.warn('⚠️ RevenueCat: Failed to fetch offerings after login:', offeringsError);
          }
        } else {
          // User is logged out - log them out of RevenueCat
          console.log('🚫 No authenticated user ID. Attempting RevenueCat logout...');
          
          const { customerInfo } = await Purchases.logOut();
          
          console.log('✅ RevenueCat logged out successfully');
          console.log('👤 RevenueCat anonymous customer info:', customerInfo);
          setRevenueCatConfigured(false);
        }
      } catch (error) {
        console.error('❌ Failed RevenueCat user authentication operation:', error);
        console.error('❌ Error details:', {
          message: error.message,
          code: error.code,
          stack: error.stack
        });
        setRevenueCatConfigured(false);
      }
    };

    handleRevenueCatUserAuth();
  }, [authLoading, user?.id, revenueCatSDKInitialized]);

  // Use models directly from the database
  const allModels = models;

  // Set default model (prefer Gwiz by api_identifier)
  useEffect(() => {
    if (allModels.length > 0 && !selectedModel) {
      // Try to find Gwiz by api_identifier first
      const gwizModel = allModels.find(model => 
        model.api_identifier === 'google/gemini-1.5-flash' || 
        model.model_name.toLowerCase() === 'gwiz'
      );
      setSelectedModel(gwizModel || allModels[0]);
    }
  }, [allModels, selectedModel]);

  // Handle navigation state for shared chat joins
  useEffect(() => {
    if (location.state?.selectedChatId && chats.length > 0) {
      const targetChat = chats.find(chat => chat.id === location.state.selectedChatId);
      if (targetChat) {
        setCurrentChat(targetChat);
        // Clear the state to prevent re-selection
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, chats]);

  // Auto-select first chat if none selected (and not coming from shared chat)
  useEffect(() => {
    if (chats.length > 0 && !currentChat && !location.state?.selectedChatId) {
      setCurrentChat(chats[0]);
    }
  }, [chats, currentChat, location.state]);

  // If current chat is deleted, select another chat
  useEffect(() => {
    if (currentChat && !chats.find(chat => chat.id === currentChat.id)) {
      setCurrentChat(chats.length > 0 ? chats[0] : null);
    }
  }, [chats, currentChat]);

  // Fetch chat owner's tokens and profile when currentChat changes
  useEffect(() => {
    const fetchOwnerData = async () => {
      if (currentChat?.owner_id) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('tokens, username, profile_picture_url, id')
            .eq('id', currentChat.owner_id)
            .single();
          
          if (error) throw error;
          setChatOwnerTokens(data.tokens);
          setChatOwnerProfile({
            id: data.id,
            username: data.username,
            email: null, // Not needed for display
            profile_picture_url: data.profile_picture_url,
            credits_balance: 0, // Not needed for display
            role: 'member', // Default role
            created_at: '' // Not needed for display
          });
        } catch (error) {
          console.error('Error fetching chat owner data:', error);
          setChatOwnerTokens(0);
          setChatOwnerProfile(null);
        }
      } else {
        setChatOwnerTokens(subscription?.tokens || 0);
        setChatOwnerProfile(profile);
      }
    };
    fetchOwnerData();
  }, [currentChat, subscription, profile]);

  const handleNewChat = async () => {
    const newChat = await createChat();
    if (newChat) {
      setCurrentChat(newChat);
    }
  };

  const handleChatSelect = (chat: Chat) => {
    setCurrentChat(chat);
  };

  const handleUpdateTitle = async (title: string) => {
    if (currentChat) {
      await updateChatTitle(currentChat.id, title);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteChat(chatId);
      // If we deleted the current chat, the useEffect above will handle selecting a new one
    } catch (error) {
      console.error('Failed to delete chat:', error);
      throw error;
    }
  };

  const handleModelChange = async (model: LLMModel) => {
    console.log('🔄 Model changed to:', model.model_name, 'ID:', model.id);
    setSelectedModel(model);
    
    // Add system message about model switch
    if (currentChat && user) {
      try {
        await supabase
          .from('messages')
          .insert({
            chat_id: currentChat.id,
            sender_type: 'system',
            content: `--- Switched to ${model.model_name} ---`,
          });
      } catch (error) {
        console.error('Error adding system message:', error);
      }
    }
  };

  const handleSendMessage = async (content: string) => {
    if (user && currentChat) {
      await sendMessage(content, user.id);
    }
  };

  const handleSendAIMessage = async (content: string, modelId?: string, modelName?: string) => {
    if (user && currentChat) {
      // Check if chat owner has tokens
      if (chatOwnerTokens <= 0) {
        alert('The chat owner has run out of tokens. Please upgrade to continue using AI features.');
        return;
      }

      // Set thinking state
      setIsAIThinking(true);
      setThinkingModelName(modelName || selectedModel?.model_name || 'AI');
      
      try {
        // Use provided modelId or fall back to selected model
        const targetModelId = modelId || selectedModel?.id;
        const targetModelName = modelName || selectedModel?.model_name;
        
        if (!targetModelId) {
          throw new Error('No model selected');
        }

        console.log('🚀 App.tsx - Sending AI message:', {
          content,
          targetModelId,
          targetModelName
        });

        // Call the token-based LLM function
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.access_token) {
          throw new Error('No auth token');
        }

        const response = await fetch(`${supabase.supabaseUrl}/functions/v1/ask-llm-with-tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId: currentChat.id,
            message: content,
            modelId: targetModelId,
          }),
        });

        const result = await response.json();
        
        if (!response.ok) {
          if (result.upgrade_required) {
            setShowSubscriptionManager(true);
          }
          throw new Error(result.error || 'AI request failed');
        }

        // Update local token count
        setChatOwnerTokens(result.tokensRemaining);
        
        // Update last used LLM in database
        if (targetModelName) {
          const targetModel = allModels.find(m => m.model_name === targetModelName);
          if (targetModel) {
            await supabase.rpc('update_last_used_llm', {
              model_identifier: targetModel.api_identifier
            });
          }
        }
        
        // Refresh subscription data
        refreshSubscription();
      } catch (error) {
        console.error('AI message error:', error);
        throw error;
      } finally {
        setIsAIThinking(false);
        setThinkingModelName('');
      }
    }
  };

  // Show loading state with better debugging
  const isLoading = authLoading || subscriptionLoading;
  
  console.log('🔄 App.tsx render state:', {
    authLoading,
    subscriptionLoading,
    isLoading,
    user: user ? 'Present' : 'None',
    profile: profile ? 'Present' : 'None',
    revenueCatSDKInitialized,
    revenueCatConfigured
  });

  if (isLoading) {
    const getRevenueCatStatus = () => {
      if (!revenueCatSDKInitialized) return 'Initializing SDK...';
      if (authLoading) return 'Waiting for auth...';
      if (!revenueCatConfigured) return 'Waiting for user login...';
      return 'Configured';
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application...</p>
          <p className="text-xs text-gray-400 mt-2">
            Auth: {authLoading ? 'Loading...' : 'Ready'} | 
            Subscription: {subscriptionLoading ? 'Loading...' : 'Ready'} |
            RevenueCat: {getRevenueCatStatus()}
          </p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthForm onSignIn={signIn} onSignUp={signUp} />;
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <ChatSidebar
        chats={chats}
        currentChat={currentChat}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
        onSignOut={signOut}
        onDeleteChat={handleDeleteChat}
        canDeleteChat={canDeleteChat}
        profile={profile}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onlineUsers={onlineUsers}
        deletingChatId={deletingChatId}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Token Usage Indicator */}
        {subscription && !sidebarCollapsed && (
          <div className="p-4 border-b border-gray-200">
            <TokenUsageIndicator
              tokens={subscription.tokens}
              plan={subscription.plan}
              maxTokens={subscription.maxTokens}
              onUpgradeClick={() => setShowSubscriptionManager(true)}
            />
          </div>
        )}

        <ChatHeader
          chat={currentChat}
          models={allModels}
          selectedModel={selectedModel}
          onUpdateTitle={handleUpdateTitle}
          onModelChange={handleModelChange}
          onlineUsers={onlineUsers}
          currentUserId={user.id}
          chatOwnerProfile={chatOwnerProfile}
        />

        {currentChat ? (
          <>
            <MessageList
              messages={messages}
              currentUserId={user.id}
              isAIThinking={isAIThinking}
              thinkingModelName={thinkingModelName}
              chatOwnerId={currentChat.owner_id}
            />
            <MessageInput
              onSendMessage={handleSendMessage}
              onSendAIMessage={handleSendAIMessage}
              creditsBalance={chatOwnerTokens} // Pass chat owner's tokens
              onlineUsers={onlineUsers}
              availableModels={allModels}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-white">💬</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Welcome to AI Workspace
              </h2>
              <p className="text-gray-600 mb-4">
                Create a new chat to start collaborating with your team and multiple AI assistants.
              </p>
              <button
                onClick={handleNewChat}
                className="bg-gradient-to-r from-blue-500 to-teal-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-teal-600 transition-colors"
              >
                Start New Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Manager Modal */}
      {showSubscriptionManager && subscription && (
        <SubscriptionManager
          userId={user.id}
          currentPlan={subscription.plan}
          currentTokens={subscription.tokens}
          onClose={() => setShowSubscriptionManager(false)}
          refreshSubscription={refreshSubscription}
          revenueCatConfigured={revenueCatConfigured}
        />
      )}
    </div>
  );
}

export default function App() {
  console.log('🚀 App.tsx: Application starting...');
  
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/shared/:shareLink" element={<SharedChatPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}