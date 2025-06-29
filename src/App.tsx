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
  const [revenueCatConfigured, setRevenueCatConfigured] = useState(false);

  const { chats, loading: chatsLoading, createChat, updateChatTitle, deleteChat, canDeleteChat, deletingChatId } = useChats(user?.id);
  const { messages, sendMessage, sendAIMessage } = useMessages(currentChat?.id, profile);
  const { models } = useModels();
  const onlineUsers = usePresence(currentChat?.id, user?.id);

  // Configure RevenueCat only when user is authenticated
  useEffect(() => {
    const configureRevenueCat = async () => {
      if (authLoading) {
        console.log('⏳ Auth still loading, waiting...');
        return;
      }

      if (!user?.id) {
        console.warn('🚫 No authenticated user ID yet. Skipping RevenueCat configuration.');
        setRevenueCatConfigured(false);
        return;
      }

      console.log('🧠 Supabase user object:', user);

      const revenueCatPublicKey = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;

      if (!revenueCatPublicKey || !revenueCatPublicKey.startsWith('rcb_')) {
        console.warn('⚠️ Invalid or missing RevenueCat public key');
        setRevenueCatConfigured(false);
        return;
      }

      try {
        Purchases.setLogLevel("DEBUG");
        console.log('🔑 Configuring RevenueCat with user.id:', user.id);

        await Purchases.configure({
          apiKey: revenueCatPublicKey,
          appUserID: user.id,
        });

        console.log('✅ RevenueCat configured successfully');
        setRevenueCatConfigured(true);

        const offerings = await Purchases.getOfferings();
        console.log('📦 RevenueCat: Offerings fetched successfully:', offerings);
      } catch (error) {
        console.error('❌ Failed to configure RevenueCat:', error);
        setRevenueCatConfigured(false);
      }
    };

    configureRevenueCat();
  }, [authLoading, user?.id]);

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
    revenueCatConfigured
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application...</p>
          <p className="text-xs text-gray-400 mt-2">
            Auth: {authLoading ? 'Loading...' : 'Ready'} | 
            Subscription: {subscriptionLoading ? 'Loading...' : 'Ready'} |
            RevenueCat: {revenueCatConfigured ? 'Configured' : 'Waiting for auth...'}
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