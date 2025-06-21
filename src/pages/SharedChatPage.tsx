import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../hooks/useMessages';
import { useModels } from '../hooks/useModels';
import { usePresence } from '../hooks/usePresence';
import { AuthForm } from '../components/AuthForm';
import { ChatHeader } from '../components/ChatHeader';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import { Chat, LLMModel } from '../lib/supabase';
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
  const { shareLink } = useParams<{ shareLink: string }>();
  const { user, profile, loading, signIn, signUp, refreshProfile } = useAuth();
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [thinkingModelName, setThinkingModelName] = useState<string>('');

  const { messages, sendMessage, sendAIMessage } = useMessages(chat?.id, profile);
  const { models } = useModels();
  const onlineUsers = usePresence(chat?.id, user?.id);

  // Combine Gwiz with other models
  const allModels = [
    GWIZ_MODEL, 
    ...models.filter(model => model.id !== 'gwiz-hardcoded' && model.model_name !== 'Gwiz')
  ];

  // Load chat by share link
  useEffect(() => {
    if (!shareLink) return;
    
    const loadSharedChat = async () => {
      try {
        console.log('🔍 Loading shared chat with link:', shareLink);
        
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .eq('share_link', shareLink)
          .single();

        if (error) {
          console.error('❌ Error loading shared chat:', error);
          if (error.code === 'PGRST116') {
            setError('Chat not found or link is invalid');
          } else {
            setError('Failed to load chat');
          }
          return;
        }

        console.log('✅ Shared chat loaded:', data);
        setChat(data);
      } catch (err) {
        console.error('Error loading shared chat:', err);
        setError('Failed to load chat');
      } finally {
        setChatLoading(false);
      }
    };

    loadSharedChat();
  }, [shareLink]);

  // Auto-join user to chat when they're authenticated
  useEffect(() => {
    if (!user || !chat || hasJoined || isJoining) return;

    const joinChat = async () => {
      setIsJoining(true);
      try {
        console.log('🚪 Attempting to join chat:', chat.id);

        // Use the new join function
        const { data, error } = await supabase.rpc('join_chat_by_share_link', {
          share_link_uuid: chat.share_link
        });

        if (error) {
          console.error('❌ Error joining chat:', error);
          setError('Failed to join chat');
          return;
        }

        console.log('✅ Join result:', data);
        
        if (data.success) {
          setHasJoined(true);
          console.log('🎉 Successfully joined chat');
        } else {
          setError(data.error || 'Failed to join chat');
        }
      } catch (err) {
        console.error('Error joining chat:', err);
        setError('Failed to join chat');
      } finally {
        setIsJoining(false);
      }
    };

    joinChat();
  }, [user, chat, profile, hasJoined, isJoining]);

  // Set default model
  useEffect(() => {
    if (allModels.length > 0 && !selectedModel) {
      setSelectedModel(GWIZ_MODEL); // Default to Gwiz
    }
  }, [allModels, selectedModel]);

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
      
      setChat({ ...chat, chat_title: title });
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

        console.log('🚀 SharedChatPage - Sending AI message:', {
          content,
          targetModelId,
          targetModelName
        });

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
        
        // Refresh profile to update credits
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
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto pt-16">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-white">💬</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Chat</h1>
            <p className="text-gray-600">
              Sign in to join "{chat?.chat_title || 'this chat'}" and start participating in the conversation
            </p>
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
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Joining chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header with join indicator */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">💬</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Shared Chat</h1>
              <p className="text-sm text-gray-600">
                {hasJoined ? '✅ You have joined this chat' : '⏳ Joining chat...'}
              </p>
            </div>
          </div>
          
          {onlineUsers.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{onlineUsers.length} online</span>
            </div>
          )}
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
      />

      <MessageInput
        onSendMessage={handleSendMessage}
        onSendAIMessage={handleSendAIMessage}
        creditsBalance={profile.credits_balance}
        onlineUsers={onlineUsers}
        availableModels={allModels}
      />
    </div>
  );
}