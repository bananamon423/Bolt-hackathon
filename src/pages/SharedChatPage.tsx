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

export function SharedChatPage() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const { user, profile, loading, signIn, signUp, refreshProfile } = useAuth();
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

  const { messages, sendMessage, sendAIMessage } = useMessages(chat?.id, profile);
  const { models } = useModels();
  const onlineUsers = usePresence(chat?.id, user?.id);

  // Load chat by share link
  useEffect(() => {
    if (!shareLink) return;
    
    const loadSharedChat = async () => {
      try {
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .eq('share_link', shareLink)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            setError('Chat not found or link is invalid');
          } else {
            setError('Failed to load chat');
          }
          return;
        }

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
    if (!user || !chat || hasJoined) return;

    const joinChat = async () => {
      try {
        // Check if user is already a member
        const { data: existingMember } = await supabase
          .from('chat_members')
          .select('*')
          .eq('chat_id', chat.id)
          .eq('user_id', user.id)
          .single();

        if (!existingMember) {
          // Add user as member
          const { error } = await supabase
            .from('chat_members')
            .insert({
              chat_id: chat.id,
              user_id: user.id,
              role: 'member',
            });

          if (error) {
            console.error('Error joining chat:', error);
            setError('Failed to join chat');
            return;
          }

          // Add system message about user joining
          await supabase
            .from('messages')
            .insert({
              chat_id: chat.id,
              sender_type: 'system',
              content: `${profile?.username || 'User'} joined the chat`,
            });
        }

        setHasJoined(true);
      } catch (err) {
        console.error('Error joining chat:', err);
        setError('Failed to join chat');
      }
    };

    joinChat();
  }, [user, chat, profile, hasJoined]);

  // Set default model
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0]);
    }
  }, [models, selectedModel]);

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

  const handleSendAIMessage = async (content: string) => {
    if (user && chat && selectedModel) {
      await sendAIMessage(content, selectedModel.id);
      refreshProfile();
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Chat</h1>
            <p className="text-gray-600">
              Sign in to join "{chat?.chat_title || 'this chat'}" and start participating
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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <ChatHeader
        chat={chat}
        models={models}
        selectedModel={selectedModel}
        onUpdateTitle={handleUpdateTitle}
        onModelChange={handleModelChange}
        onlineUsers={onlineUsers}
      />

      <MessageList
        messages={messages}
        currentUserId={user.id}
      />

      <MessageInput
        onSendMessage={handleSendMessage}
        onSendAIMessage={handleSendAIMessage}
        creditsBalance={profile.credits_balance}
      />
    </div>
  );
}