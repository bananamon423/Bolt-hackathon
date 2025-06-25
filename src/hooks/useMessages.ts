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
  const isInitialLoad = useRef(true);
  const pendingMessages = useRef<Map<string, Message>>(new Map());

  // Update chat ID ref when it changes
  useEffect(() => {
    chatIdRef.current = chatId;
    // Clear processed messages when switching chats
    processedMessageIds.current.clear();
    pendingMessages.current.clear();
    isInitialLoad.current = true;
  }, [chatId]);

  // Memoized function to add a message to the state
  const addMessageToState = useCallback((newMessage: Message, isOptimistic = false) => {
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

      console.log('✅ Adding new message to state:', newMessage.id, isOptimistic ? '(optimistic)' : '(confirmed)');
      
      // Add new message and sort by timestamp
      const newMessages = [...currentMessages, newMessage];
      return newMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, []);

  // Function to add optimistic message
  const addOptimisticMessage = useCallback((content: string, userId: string) => {
    if (!chatId || !currentUser) return null;

    const optimisticMessage: Message = {
      id: Date.now(), // Temporary ID
      chat_id: chatId,
      sender_id: userId,
      sender_type: 'user',
      content: content.trim(),
      model_id: null,
      token_cost: null,
      created_at: new Date().toISOString(),
      profiles: currentUser,
      message_type: 'USER_TO_USER'
    };

    // Store as pending
    const tempId = `temp_${Date.now()}`;
    pendingMessages.current.set(tempId, optimisticMessage);

    // Add to UI immediately
    addMessageToState(optimisticMessage, true);
    
    return { optimisticMessage, tempId };
  }, [chatId, currentUser, addMessageToState]);

  // Function to replace optimistic message with real one
  const replaceOptimisticMessage = useCallback((tempId: string, realMessage: Message) => {
    const optimisticMessage = pendingMessages.current.get(tempId);
    if (optimisticMessage) {
      pendingMessages.current.delete(tempId);
      
      setMessages(currentMessages => {
        // Remove optimistic message and add real one
        const withoutOptimistic = currentMessages.filter(m => m.id !== optimisticMessage.id);
        const withReal = [...withoutOptimistic, realMessage];
        
        // Mark real message as processed
        processedMessageIds.current.add(realMessage.id);
        
        return withReal.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    }
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
        broadcast: { self: false }, // Don't receive our own broadcasts
        presence: { key: 'user_id' },
        private: false
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
          
          // Only process if this is for the current chat
          if (payload.new.chat_id !== chatIdRef.current) {
            console.log('🚫 Ignoring message for different chat');
            return;
          }

          // Skip if this is the initial load to prevent duplicates
          if (isInitialLoad.current) {
            console.log('🚫 Skipping real-time message during initial load');
            return;
          }

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
          
          // Only process if this is for the current chat
          if (payload.new.chat_id !== chatIdRef.current) {
            console.log('🚫 Ignoring update for different chat');
            return;
          }

          await handleRealtimeUpdate(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status for', channelName, ':', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time messages for chat:', chatId);
          // Mark initial load as complete after subscription is established
          setTimeout(() => {
            isInitialLoad.current = false;
          }, 500); // Reduced timeout
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
      pendingMessages.current.clear();
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

    // Add optimistic message immediately
    const optimistic = addOptimisticMessage(content, userId);
    if (!optimistic) return null;

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
        // Remove optimistic message on error
        setMessages(currentMessages => 
          currentMessages.filter(m => m.id !== optimistic.optimisticMessage.id)
        );
        throw error;
      }

      console.log('✅ Message sent successfully:', insertedMessage.id);
      
      // Replace optimistic message with real one
      replaceOptimisticMessage(optimistic.tempId, insertedMessage);
      
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

      // Call the new centralized ask-llm Edge Function
      const functionToInvoke = 'ask-llm';
      const functionPayload = {
        chatId,
        message: content,
        modelId,
      };

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