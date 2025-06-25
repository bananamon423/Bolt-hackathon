import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../hooks/useMessages';
import { useModels } from '../hooks/useModels';
import { usePresence } from '../hooks/usePresence';
import { useSharedChat } from '../hooks/useSharedChat';
import { AuthForm } from '../components/AuthForm';
import { ChatHeader } from '../components/ChatHeader';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import { UserPresenceIndicator } from '../components/UserPresenceIndicator';
import { LLMModel } from '../lib/supabase';
import { supabase } from '../lib/supabase';

// Define Gwiz as a special hardcoded model
const GWIZ_MODEL: LLMModel = {
  id: 'gwiz-hardcoded',
  model_name: 'Gwiz',
  api_identifier: 'google/gemini-1.5-flash',
  cost_per_token: 1,
  is_active: true
};

export function SharedChatPage() {
  const { user, profile, loading, signIn, signUp, refreshProfile } = useAuth();
  const { shareLink, chat, loading: chatLoading, error, hasJoined, isJoining, joinChat, checkMembership, setError } = useSharedChat();
  
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [thinkingModelName, setThinkingModelName] = useState<string>('');
  const [joinSuccess, setJoinSuccess] = useState(false);

  const { messages, sendMessage, sendAIMessage } = useMessages(chat?.id, profile);
  const { models } = useModels();
  const onlineUsers = usePresence(chat?.id, user?.id);

  // Combine Gwiz with other models
  const allModels = [
    GWIZ_MODEL, 
    ...models.filter(model => model.id !== 'gwiz-hardcoded' && model.model_name !== 'Gwiz')
  ];

  // Set default model
  useEffect(() => {
    if (allModels.length > 0 && !selectedModel) {
      setSelectedModel(GWIZ_MODEL);
    }
  }, [allModels, selectedModel]);

  // Check membership when user and chat are available
  useEffect(() => {
    if (user && chat && !hasJoined && !isJoining) {
      checkMembership(user.id);
    }
  }, [user, chat, hasJoined, isJoining, checkMembership]);

  // Auto-join user to chat when they're authenticated
  useEffect(() => {
    if (user && chat && !hasJoined && !isJoining) {
      const performJoin = async () => {
        const success = await joinChat(user.id);
        if (success) {
          setJoinSuccess(true);
        }
      };
      performJoin();
    }
  }, [user, chat, hasJoined, isJoining, joinChat]);

  const handleUpdateTitle = async (title: string) => {
    if (!chat || !user) return;
    
    // Only allow chat owner to update title
    if (chat.owner_id !== user.id) {
      setError('Only the chat owner can update the title');
      return;
    }

    try {
      const { error } = await supabase
        .from('chats')
        .update({ chat_title: title })
        .eq('id', chat.id);

      if (error) throw error;
      
      // Update local state would be handled by real-time subscription
    } catch (err) {
      console.error('Error updating chat title:', err);
      setError('Failed to update chat title');
    }
  };

  const handleModelChange = async (model: LLMModel) => {
    console.log('🔄 Model changed to:', model.model_name, 'ID:', model.id);
    setSelectedModel(model);
    
    // Add system message about model switch
    if (chat && user) {
      try {
        await supabase
          .from('messages')
          .insert({
            chat_id: chat.id,
            sender_type: 'system',
            content: `--- Switched to ${model.model_name} ---`,
          });
      } catch (error) {
        console.error('Error adding system message:', error);
      }
    }
  };

  const handleSendMessage = async (content: string) => {
    if (user && chat) {
      await sendMessage(content, user.id);
    }
  };

  const handleSendAIMessage = async (content: string, modelId?: string, modelName?: string) => {
    if (user && chat) {
      setIsAIThinking(true);
      setThinkingModelName(modelName || selectedModel?.model_name || 'AI');
      
      try {
        const targetModelId = modelId || selectedModel?.id;
        const targetModelName = modelName || selectedModel?.model_name;
        
        if (!targetModelId) {
          throw new Error('No model selected');
        }

        await sendAIMessage(content, targetModelId, targetModelName);
        
        // Update last used LLM in database
        if (targetModelName) {
          const targetModel = allModels.find(m => m.model_name === targetModelName);
          if (targetModel) {
            await supabase.rpc('update_last_used_llm', {
              model_identifier: targetModel.api_identifier
            });
          }
        }
        
        refreshProfile();
      } catch (error) {
        console.error('AI message error:', error);
        throw error;
      } finally {
        setIsAIThinking(false);
        setThinkingModelName('');
      }
    }
  };

  if (!shareLink) {
    return <Navigate to="/" replace />;
  }

  if (loading || chatLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-200 rounded-lg p-6 max-w-md">
            <h1 className="text-xl font-semibold text-red-800 mb-2">Error</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
        <div className="max-w-md mx-auto pt-16">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-white">💬</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Chat</h1>
            <p className="text-gray-600 mb-4">
              Sign in to join "{chat?.chat_title || 'this chat'}" and start participating in the conversation
            </p>
            {chat && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-blue-900 mb-2">Chat Preview</h3>
                <div className="text-left">
                  <p className="text-sm text-blue-800 mb-1">
                    <strong>Title:</strong> {chat.chat_title}
                  </p>
                  <p className="text-sm text-blue-800">
                    <strong>Created:</strong> {new Date(chat.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </div>
          <AuthForm onSignIn={signIn} onSignUp={signUp} />
        </div>
      </div>
    );
  }

  if (!chat) {
    return <Navigate to="/" replace />;
  }

  if (isJoining) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Joining Chat</h2>
          <p className="text-gray-600">Adding you to "{chat.chat_title}"...</p>
        </div>
      </div>
    );
  }

  if (joinSuccess && !hasJoined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-white">✅</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Successfully Joined!</h2>
          <p className="text-gray-600 mb-4">
            You've been added to "{chat.chat_title}". Redirecting to your dashboard...
          </p>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header with join status */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">💬</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Shared Chat</h1>
              <p className="text-sm text-gray-600">
                {hasJoined ? '✅ You are a member of this chat' : '⏳ Joining chat...'}
              </p>
            </div>
          </div>
          
          {/* User Presence Indicator */}
          <UserPresenceIndicator onlineUsers={onlineUsers} />
        </div>
      </div>

      <ChatHeader
        chat={chat}
        models={allModels}
        selectedModel={selectedModel}
        onUpdateTitle={handleUpdateTitle}
        onModelChange={handleModelChange}
        onlineUsers={onlineUsers}
      />

      <MessageList
        messages={messages}
        currentUserId={user.id}
        isAIThinking={isAIThinking}
        thinkingModelName={thinkingModelName}
        chatOwnerId={chat.owner_id}
      />

      <MessageInput
        onSendMessage={handleSendMessage}
        onSendAIMessage={handleSendAIMessage}
        creditsBalance={profile.credits_balance}
        onlineUsers={onlineUsers}
        availableModels={allModels}
        disabled={!hasJoined}
      />
    </div>
  );
}