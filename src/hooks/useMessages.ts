import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Message } from '../lib/supabase';

type Profile = {
  id: string;
  username: string;
  profile_picture_url: string | null;
};

export function useMessages(chatId: string | undefined, currentUser: Profile | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef<any>(null);
  const chatIdRef = useRef<string | undefined>(chatId);
  const processedMessageIds = useRef<Set<number>>(new Set());

  // Update chat ID ref when it changes
  useEffect(() => {
    chatIdRef.current = chatId;
    // Clear processed messages when switching chats
    processedMessageIds.current.clear();
  }, [chatId]);

  // Memoized function to add a message to the state
  const addMessageToState = useCallback((newMessage: Message) => {
    // Avoid duplicates using the processed IDs set
    if (processedMessageIds.current.has(newMessage.id)) {
      console.log('🚫 Message already processed:', newMessage.id);
      return;
    }

    processedMessageIds.current.add(newMessage.id);
    
    setMessages(currentMessages => {
      // Double-check for duplicates in current state
      const exists = currentMessages.some(m => m.id === newMessage.id);
      if (exists) {
        console.log('🚫 Message already exists in state:', newMessage.id);
        return currentMessages;
      }

      console.log('✅ Adding new message to state:', newMessage.id);
      
      // Add new message and sort by timestamp
      const newMessages = [...currentMessages, newMessage];
      return newMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, []);

  // Memoized function to update a message in the state
  const updateMessageInState = useCallback((updatedMessage: Message) => {
    setMessages(currentMessages => {
      const messageExists = currentMessages.some(m => m.id === updatedMessage.id);
      if (!messageExists) {
        console.log('🚫 Message to update not found in state:', updatedMessage.id);
        return currentMessages;
      }

      console.log('✅ Updating message in state:', updatedMessage.id);
      return currentMessages.map(m => 
        m.id === updatedMessage.id ? updatedMessage : m
      );
    });
  }, []);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      cleanupSubscription();
      return;
    }

    fetchMessages();
    setupRealtimeSubscription();

    return () => {
      cleanupSubscription();
    };
  }, [chatId]);

  const cleanupSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      console.log('🧹 Cleaning up subscription for chat:', chatIdRef.current);
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  }, []);

  const setupRealtimeSubscription = useCallback(() => {
    if (!chatId) return;

    // Clean up any existing subscription
    cleanupSubscription();

    console.log('📡 Setting up real-time subscription for chat:', chatId);

    // Create subscription with a unique channel name
    const channelName = `messages_${chatId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: 'user_id' }
      }
    });

    subscriptionRef.current = channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        async (payload) => {
          console.log('🔥 Real-time INSERT received:', payload);
          await handleRealtimeMessage(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        async (payload) => {
          console.log('🔄 Real-time UPDATE received:', payload);
          await handleRealtimeUpdate(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status for', channelName, ':', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time messages for chat:', chatId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel subscription error for chat:', chatId);
          // Retry subscription after a delay, but only if we're still on the same chat
          setTimeout(() => {
            if (chatIdRef.current === chatId) {
              console.log('🔄 Retrying subscription...');
              setupRealtimeSubscription();
            }
          }, 2000);
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ Subscription timed out for chat:', chatId);
          // Retry subscription, but only if we're still on the same chat
          setTimeout(() => {
            if (chatIdRef.current === chatId) {
              console.log('🔄 Retrying subscription after timeout...');
              setupRealtimeSubscription();
            }
          }, 1000);
        } else if (status === 'CLOSED') {
          console.log('🔒 Subscription closed for chat:', chatId);
        }
      });
  }, [chatId, cleanupSubscription]);

  const handleRealtimeMessage = useCallback(async (newMessage: any) => {
    // Only process if this is for the current chat
    if (newMessage.chat_id !== chatIdRef.current) {
      console.log('🚫 Ignoring message for different chat:', newMessage.chat_id, 'vs', chatIdRef.current);
      return;
    }

    try {
      // Fetch complete message with profile data
      const { data: fullMessage, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles!messages_sender_id_fkey (
            id,
            username,
            profile_picture_url
          )
        `)
        .eq('id', newMessage.id)
        .single();

      if (error) {
        console.error('❌ Error fetching full message:', error);
        return;
      }

      if (fullMessage) {
        addMessageToState(fullMessage);
      }
    } catch (err) {
      console.error('❌ Error processing real-time message:', err);
    }
  }, [addMessageToState]);

  const handleRealtimeUpdate = useCallback(async (updatedMessage: any) => {
    // Only process if this is for the current chat
    if (updatedMessage.chat_id !== chatIdRef.current) {
      console.log('🚫 Ignoring update for different chat:', updatedMessage.chat_id, 'vs', chatIdRef.current);
      return;
    }

    try {
      // Fetch complete updated message with profile data
      const { data: fullMessage, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles!messages_sender_id_fkey (
            id,
            username,
            profile_picture_url
          )
        `)
        .eq('id', updatedMessage.id)
        .single();

      if (error) {
        console.error('❌ Error fetching updated message:', error);
        return;
      }

      if (fullMessage) {
        updateMessageInState(fullMessage);
      }
    } catch (err) {
      console.error('❌ Error processing real-time update:', err);
    }
  }, [updateMessageInState]);

  const fetchMessages = async () => {
    if (!chatId) return;
    setLoading(true);
    
    try {
      console.log('📥 Fetching messages for chat:', chatId);
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles!messages_sender_id_fkey (
            id,
            username,
            profile_picture_url
          )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      console.log('📥 Fetched', data?.length || 0, 'messages');
      
      // Clear processed messages and rebuild the set
      processedMessageIds.current.clear();
      if (data) {
        data.forEach(message => processedMessageIds.current.add(message.id));
      }
      
      setMessages(data || []);
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string, userId: string) => {
    if (!chatId || !content.trim() || !currentUser) return null;

    console.log('📤 Sending message:', content);

    try {
      const { data: insertedMessage, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: userId,
          sender_type: 'user',
          content: content.trim(),
          message_type: 'USER_TO_USER'
        })
        .select(`
          *,
          profiles!messages_sender_id_fkey (
            id,
            username,
            profile_picture_url
          )
        `)
        .single();

      if (error) {
        console.error('❌ Error sending message:', error);
        throw error;
      }

      console.log('✅ Message sent successfully:', insertedMessage.id);
      
      // Don't add the message immediately - let the real-time subscription handle it
      // This ensures all users see the message at the same time
      
      return insertedMessage;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  };

  const sendAIMessage = async (content: string, modelId: string, modelName?: string) => {
    if (!chatId || !content.trim()) return;

    console.log('🤖 Sending AI message:', {
      content,
      modelId,
      modelName,
      chatId
    });

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('No auth token');
      }

      // Enhanced routing logic
      let functionToInvoke = '';
      let functionPayload = {};

      const isGwizModel = modelName === 'Gwiz' || modelId === 'gwiz-hardcoded';

      console.log('🔄 Routing decision:', {
        modelName,
        modelId,
        isGwizModel
      });

      if (isGwizModel) {
        console.log('🔄 ✅ ROUTING TO AI-CHAT FUNCTION FOR GWIZ');
        functionToInvoke = 'ai-chat';
        functionPayload = {
          chatId,
          message: content,
          modelId,
        };
      } else {
        console.log('🔄 ✅ ROUTING TO OPENROUTER-CHAT FUNCTION FOR:', modelName);
        functionToInvoke = 'openrouter-chat';
        functionPayload = {
          chatId,
          message: content,
          modelId,
        };
      }

      console.log(`🔄 Calling ${functionToInvoke} function with payload:`, functionPayload);

      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/${functionToInvoke}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(functionPayload),
      });

      const result = await response.json();
      
      console.log(`🤖 ${functionToInvoke} function response:`, result);
      
      if (!response.ok) {
        console.error(`❌ Error invoking ${functionToInvoke} function:`, result);
        throw new Error(result.error || `${functionToInvoke} request failed`);
      }

      console.log(`✅ ${functionToInvoke} request completed successfully`);
      return result;
    } catch (error) {
      console.error('❌ Error sending AI message:', error);
      throw error;
    }
  };

  return {
    messages,
    loading,
    sendMessage,
    sendAIMessage,
    refetch: fetchMessages,
  };
}