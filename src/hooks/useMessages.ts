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
    console.log('🔄 useMessages: Chat ID changed from', chatIdRef.current, 'to', chatId);
    chatIdRef.current = chatId;
    // Clear processed messages when switching chats
    processedMessageIds.current.clear();
    pendingMessages.current.clear();
    isInitialLoad.current = true;
    console.log('🧹 useMessages: Cleared processed messages and pending messages for new chat');
  }, [chatId]);

  // Memoized function to add a message to the state
  const addMessageToState = useCallback((newMessage: Message, isOptimistic = false) => {
    console.log('📝 useMessages: Attempting to add message to state:', {
      messageId: newMessage.id,
      content: newMessage.content.substring(0, 50) + '...',
      isOptimistic,
      alreadyProcessed: processedMessageIds.current.has(newMessage.id)
    });

    // Avoid duplicates using the processed IDs set
    if (processedMessageIds.current.has(newMessage.id)) {
      console.log('🚫 useMessages: Message already processed, skipping:', newMessage.id);
      return;
    }

    processedMessageIds.current.add(newMessage.id);
    
    setMessages(currentMessages => {
      // Double-check for duplicates in current state
      const exists = currentMessages.some(m => m.id === newMessage.id);
      if (exists) {
        console.log('🚫 useMessages: Message already exists in state, skipping:', newMessage.id);
        return currentMessages;
      }

      console.log('✅ useMessages: Adding new message to state:', {
        messageId: newMessage.id,
        senderType: newMessage.sender_type,
        isOptimistic,
        totalMessages: currentMessages.length + 1
      });
      
      // Add new message and sort by timestamp
      const newMessages = [...currentMessages, newMessage];
      const sortedMessages = newMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      console.log('📊 useMessages: Updated message list:', {
        totalMessages: sortedMessages.length,
        latestMessageId: sortedMessages[sortedMessages.length - 1]?.id
      });
      
      return sortedMessages;
    });
  }, []);

  // Function to add optimistic message
  const addOptimisticMessage = useCallback((content: string, userId: string) => {
    if (!chatId || !currentUser) {
      console.log('🚫 useMessages: Cannot add optimistic message - missing chatId or currentUser');
      return null;
    }

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

    console.log('⚡ useMessages: Adding optimistic message:', {
      tempId,
      messageId: optimisticMessage.id,
      content: content.substring(0, 50) + '...'
    });

    // Add to UI immediately
    addMessageToState(optimisticMessage, true);
    
    return { optimisticMessage, tempId };
  }, [chatId, currentUser, addMessageToState]);

  // Function to replace optimistic message with real one
  const replaceOptimisticMessage = useCallback((tempId: string, realMessage: Message) => {
    const optimisticMessage = pendingMessages.current.get(tempId);
    if (optimisticMessage) {
      console.log('🔄 useMessages: Replacing optimistic message:', {
        tempId,
        optimisticId: optimisticMessage.id,
        realId: realMessage.id
      });
      
      pendingMessages.current.delete(tempId);
      
      setMessages(currentMessages => {
        // Remove optimistic message and add real one
        const withoutOptimistic = currentMessages.filter(m => m.id !== optimisticMessage.id);
        const withReal = [...withoutOptimistic, realMessage];
        
        // Mark real message as processed
        processedMessageIds.current.add(realMessage.id);
        
        const sortedMessages = withReal.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        console.log('✅ useMessages: Optimistic message replaced successfully');
        return sortedMessages;
      });
    } else {
      console.log('⚠️ useMessages: Could not find optimistic message to replace:', tempId);
    }
  }, []);

  // Memoized function to update a message in the state
  const updateMessageInState = useCallback((updatedMessage: Message) => {
    console.log('🔄 useMessages: Attempting to update message in state:', {
      messageId: updatedMessage.id,
      content: updatedMessage.content.substring(0, 50) + '...'
    });

    setMessages(currentMessages => {
      const messageExists = currentMessages.some(m => m.id === updatedMessage.id);
      if (!messageExists) {
        console.log('🚫 useMessages: Message to update not found in state:', updatedMessage.id);
        return currentMessages;
      }

      console.log('✅ useMessages: Updating message in state:', updatedMessage.id);
      return currentMessages.map(m => 
        m.id === updatedMessage.id ? updatedMessage : m
      );
    });
  }, []);

  useEffect(() => {
    if (!chatId) {
      console.log('🧹 useMessages: No chatId provided, clearing messages and cleaning up');
      setMessages([]);
      setLoading(false);
      cleanupSubscription();
      return;
    }

    console.log('🚀 useMessages: Setting up for chat:', chatId);
    fetchMessages();
    setupRealtimeSubscription();

    return () => {
      console.log('🧹 useMessages: Cleaning up useEffect for chat:', chatId);
      cleanupSubscription();
    };
  }, [chatId]);

  const cleanupSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      console.log('🧹 useMessages: Cleaning up subscription for chat:', chatIdRef.current);
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  }, []);

  const setupRealtimeSubscription = useCallback(() => {
    if (!chatId) {
      console.log('🚫 useMessages: Cannot setup subscription - no chatId');
      return;
    }

    // Clean up any existing subscription
    cleanupSubscription();

    console.log('📡 useMessages: Setting up real-time subscription for chat:', chatId);

    // Create subscription with a unique channel name
    const channelName = `messages_${chatId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('📡 useMessages: Creating channel:', channelName);
    
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
          console.log('🔥 useMessages: Real-time INSERT received:', {
            messageId: payload.new.id,
            chatId: payload.new.chat_id,
            senderType: payload.new.sender_type,
            content: payload.new.content?.substring(0, 50) + '...',
            currentChatId: chatIdRef.current,
            isInitialLoad: isInitialLoad.current
          });
          
          // Only process if this is for the current chat
          if (payload.new.chat_id !== chatIdRef.current) {
            console.log('🚫 useMessages: Ignoring message for different chat:', {
              receivedChatId: payload.new.chat_id,
              currentChatId: chatIdRef.current
            });
            return;
          }

          // Skip if this is the initial load to prevent duplicates
          if (isInitialLoad.current) {
            console.log('🚫 useMessages: Skipping real-time message during initial load');
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
          console.log('🔄 useMessages: Real-time UPDATE received:', {
            messageId: payload.new.id,
            chatId: payload.new.chat_id,
            currentChatId: chatIdRef.current
          });
          
          // Only process if this is for the current chat
          if (payload.new.chat_id !== chatIdRef.current) {
            console.log('🚫 useMessages: Ignoring update for different chat');
            return;
          }

          await handleRealtimeUpdate(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('📡 useMessages: Subscription status for', channelName, ':', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ useMessages: Successfully subscribed to real-time messages for chat:', chatId);
          // Mark initial load as complete after subscription is established
          setTimeout(() => {
            console.log('✅ useMessages: Initial load complete, enabling real-time updates');
            isInitialLoad.current = false;
          }, 500);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ useMessages: Channel subscription error for chat:', chatId);
          // Retry subscription after a delay, but only if we're still on the same chat
          setTimeout(() => {
            if (chatIdRef.current === chatId) {
              console.log('🔄 useMessages: Retrying subscription...');
              setupRealtimeSubscription();
            }
          }, 2000);
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ useMessages: Subscription timed out for chat:', chatId);
          // Retry subscription, but only if we're still on the same chat
          setTimeout(() => {
            if (chatIdRef.current === chatId) {
              console.log('🔄 useMessages: Retrying subscription after timeout...');
              setupRealtimeSubscription();
            }
          }, 1000);
        } else if (status === 'CLOSED') {
          console.log('🔒 useMessages: Subscription closed for chat:', chatId);
        }
      });
  }, [chatId, cleanupSubscription]);

  const handleRealtimeMessage = useCallback(async (newMessage: any) => {
    try {
      console.log('🔄 useMessages: Processing real-time message:', {
        messageId: newMessage.id,
        senderType: newMessage.sender_type
      });

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
        console.error('❌ useMessages: Error fetching full message:', error);
        return;
      }

      if (fullMessage) {
        console.log('✅ useMessages: Full message fetched, adding to state:', {
          messageId: fullMessage.id,
          hasProfile: !!fullMessage.profiles
        });
        addMessageToState(fullMessage);
      }
    } catch (err) {
      console.error('❌ useMessages: Error processing real-time message:', err);
    }
  }, [addMessageToState]);

  const handleRealtimeUpdate = useCallback(async (updatedMessage: any) => {
    try {
      console.log('🔄 useMessages: Processing real-time update:', {
        messageId: updatedMessage.id
      });

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
        console.error('❌ useMessages: Error fetching updated message:', error);
        return;
      }

      if (fullMessage) {
        console.log('✅ useMessages: Updated message fetched, updating state:', {
          messageId: fullMessage.id
        });
        updateMessageInState(fullMessage);
      }
    } catch (err) {
      console.error('❌ useMessages: Error processing real-time update:', err);
    }
  }, [updateMessageInState]);

  const fetchMessages = async () => {
    if (!chatId) {
      console.log('🚫 useMessages: Cannot fetch messages - no chatId');
      return;
    }
    
    console.log('📥 useMessages: Starting to fetch messages for chat:', chatId);
    setLoading(true);
    
    try {
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

      if (error) {
        console.error('❌ useMessages: Error fetching messages:', error);
        throw error;
      }
      
      console.log('📥 useMessages: Fetched messages successfully:', {
        count: data?.length || 0,
        chatId
      });
      
      // Clear processed messages and rebuild the set
      processedMessageIds.current.clear();
      pendingMessages.current.clear();
      if (data) {
        data.forEach(message => {
          processedMessageIds.current.add(message.id);
        });
        console.log('📝 useMessages: Processed message IDs updated:', processedMessageIds.current.size);
      }
      
      setMessages(data || []);
    } catch (error) {
      console.error('❌ useMessages: Error fetching messages:', error);
    } finally {
      setLoading(false);
      console.log('✅ useMessages: Message fetching completed');
    }
  };

  const sendMessage = async (content: string, userId: string) => {
    if (!chatId || !content.trim() || !currentUser) {
      console.log('🚫 useMessages: Cannot send message - missing requirements:', {
        hasChatId: !!chatId,
        hasContent: !!content.trim(),
        hasCurrentUser: !!currentUser
      });
      return null;
    }

    console.log('📤 useMessages: Sending message:', {
      content: content.substring(0, 50) + '...',
      userId,
      chatId
    });

    // Add optimistic message immediately
    const optimistic = addOptimisticMessage(content, userId);
    if (!optimistic) {
      console.log('❌ useMessages: Failed to create optimistic message');
      return null;
    }

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
        console.error('❌ useMessages: Error sending message:', error);
        // Remove optimistic message on error
        setMessages(currentMessages => 
          currentMessages.filter(m => m.id !== optimistic.optimisticMessage.id)
        );
        throw error;
      }

      console.log('✅ useMessages: Message sent successfully:', {
        messageId: insertedMessage.id,
        tempId: optimistic.tempId
      });
      
      // Replace optimistic message with real one
      replaceOptimisticMessage(optimistic.tempId, insertedMessage);
      
      return insertedMessage;
    } catch (error) {
      console.error('❌ useMessages: Error sending message:', error);
      throw error;
    }
  };

  const sendAIMessage = async (content: string, modelId: string, modelName?: string) => {
    if (!chatId || !content.trim()) {
      console.log('🚫 useMessages: Cannot send AI message - missing requirements');
      return;
    }

    console.log('🤖 useMessages: Sending AI message:', {
      content: content.substring(0, 50) + '...',
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

      console.log(`🔄 useMessages: Calling ${functionToInvoke} function with payload:`, functionPayload);

      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/${functionToInvoke}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(functionPayload),
      });

      const result = await response.json();
      
      console.log(`🤖 useMessages: ${functionToInvoke} function response:`, {
        success: result.success,
        messageId: result.messageId,
        error: result.error
      });
      
      if (!response.ok) {
        console.error(`❌ useMessages: Error invoking ${functionToInvoke} function:`, result);
        throw new Error(result.error || `${functionToInvoke} request failed`);
      }

      console.log(`✅ useMessages: ${functionToInvoke} request completed successfully`);
      return result;
    } catch (error) {
      console.error('❌ useMessages: Error sending AI message:', error);
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