import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useChats } from './hooks/useChats';
import { useMessages } from './hooks/useMessages';
import { useModels } from './hooks/useModels';
import { usePresence } from './hooks/usePresence';
import { AuthForm } from './components/AuthForm';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { AdminPage } from './pages/AdminPage';
import { SharedChatPage } from './pages/SharedChatPage';
import { Chat, LLMModel } from './lib/supabase';
import { supabase } from './lib/supabase';

function MainApp() {
  // 1. Get the authenticated user first.
  const { user, profile, loading, signIn, signUp, signOut, refreshProfile } = useAuth();
  
  // 2. Define all your component's state variables.
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 3. Now, call the other hooks that DEPEND on the state above.
  const { chats, loading: chatsLoading, createChat, updateChatTitle } = useChats(user?.id);
  const { messages, sendMessage, sendAIMessage } = useMessages(currentChat?.id, profile);
  const { models } = useModels();
  const onlineUsers = usePresence(currentChat?.id, user?.id);

  // ... the rest of your component code remains the same

  // Set default model
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0]);
    }
  }, [models, selectedModel]);

  // Auto-select first chat if none selected
  useEffect(() => {
    if (chats.length > 0 && !currentChat) {
      setCurrentChat(chats[0]);
    }
  }, [chats, currentChat]);

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

  const handleModelChange = async (model: LLMModel) => {
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

  const handleSendAIMessage = async (content: string) => {
    if (user && currentChat && selectedModel) {
      await sendAIMessage(content, selectedModel.id);
      // Refresh profile to update credits
      refreshProfile();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
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
        profile={profile}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onlineUsers={onlineUsers}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatHeader
          chat={currentChat}
          models={models}
          selectedModel={selectedModel}
          onUpdateTitle={handleUpdateTitle}
          onModelChange={handleModelChange}
          onlineUsers={onlineUsers}
        />

        {currentChat ? (
          <>
            <MessageList
              messages={messages}
              currentUserId={user.id}
            />
            <MessageInput
              onSendMessage={handleSendMessage}
              onSendAIMessage={handleSendAIMessage}
              creditsBalance={profile.credits_balance}
              onlineUsers={onlineUsers}
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
                Create a new chat to start collaborating with your team and AI assistant.
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
    </div>
  );
}

export default function App() {
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