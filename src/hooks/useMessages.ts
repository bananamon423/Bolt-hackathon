import { useState, useEffect, useRef } from 'react';
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
  const lastMessageIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!chatId) return;

    fetchMessages();
    setupRealtimeSubscription();

    return () => {
      cleanupSubscription();
    };
  }, [chatId]);

  const cleanupSubscription = () => {
    if (subscriptionRef.current) {
      console.log('Cleaning up subscription');
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  };

  const setupRealtimeSubscription = () => {
    if (!chatId) return;

    // Clean up any existing subscription
    cleanupSubscription();

    console.log('Setting up real-time subscription for chat:', chatId);

    // Create subscription with a unique channel name
    const channel = supabase.channel(`messages_${chatId}_${Date.now()}`, {
      config: {
        broadcast: { self: true },
        presence: { key: 'user' }
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
          console.log('🔥 Real-time message received:', payload);
          
          const newMessage = payload.new as any;
          
          // Avoid duplicate processing
          if (lastMessageIdRef.current === newMessage.id) {
            console.log('Duplicate message, skipping');
            return;
          }
          
          lastMessageIdRef.current = newMessage.id;

          try {
            // Fetch complete message with profile data
            const { data: fullMessage, error } = await supabase
              .from('messages')
              .select(`
                *,
                profiles (
                  id,
                  username,
                  profile_picture_url
                )
              `)
              .eq('id', newMessage.id)
              .single();

            if (error) {
              console.error('Error fetching full message:', error);
              return;
            }

            if (fullMessage) {
              console.log('✅ Adding message to UI:', fullMessage);
              
              setMessages(currentMessages => {
                // Check if message already exists
                const exists = currentMessages.some(m => m.id === fullMessage.id);
                if (exists) {
                  console.log('Message already exists, skipping');
                  return currentMessages;
                }

                // Add new message and sort by timestamp
                const newMessages = [...currentMessages, fullMessage];
                return newMessages.sort((a, b) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              });
            }
          } catch (err) {
            console.error('Error processing real-time message:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel subscription error');
          // Retry subscription after a delay
          setTimeout(() => {
            console.log('🔄 Retrying subscription...');
            setupRealtimeSubscription();
          }, 2000);
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ Subscription timed out');
          // Retry subscription
          setTimeout(() => {
            console.log('🔄 Retrying subscription after timeout...');
            setupRealtimeSubscription();
          }, 1000);
        }
      });
  };

  const fetchMessages = async () => {
    if (!chatId) return;
    setLoading(true);
    
    try {
      console.log('📥 Fetching messages for chat:', chatId);
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles (
            id,
            username,
            profile_picture_url
          )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      console.log('📥 Fetched', data?.length || 0, 'messages');
      setMessages(data || []);
      
      // Update last message ID reference
      if (data && data.length > 0) {
        lastMessageIdRef.current = data[data.length - 1].id;
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string, userId: string) => {
    if (!chatId || !content.trim() || !currentUser) return null;

    console.log('📤 Sending message:', content);

    // Create optimistic message
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const optimisticMessage: Message = {
      id: tempId as any,
      chat_id: chatId,
      sender_id: userId,
      sender_type: 'user',
      content: content.trim(),
      created_at: new Date().toISOString(),
      profiles: currentUser,
    };

    // Add optimistic message immediately
    setMessages(currentMessages => [...currentMessages, optimisticMessage]);

    try {
      const { data: insertedMessage, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: userId,
          sender_type: 'user',
          content: content.trim(),
        })
        .select(`
          *,
          profiles (
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
          currentMessages.filter(m => m.id !== tempId)
        );
        throw error;
      }

      console.log('✅ Message sent successfully');

      // Replace optimistic message with real message
      if (insertedMessage) {
        setMessages(currentMessages => 
          currentMessages.map(m => 
            m.id === tempId ? insertedMessage : m
          )
        );
      }

      return insertedMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(currentMessages => 
        currentMessages.filter(m => m.id !== tempId)
      );
      throw error;
    }
  };

  const sendAIMessage = async (content: string, modelId: string) => {
    if (!chatId || !content.trim()) return;

    console.log('🤖 Sending AI message:', content);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('No auth token');
      }

      console.log('🔄 Calling AI function...');

      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          message: content,
          modelId,
        }),
      });

      const result = await response.json();
      
      console.log('🤖 AI function response:', result);
      
      if (!response.ok) {
        console.error('❌ AI function error:', result);
        throw new Error(result.error || 'AI request failed');
      }

      console.log('✅ AI message request completed');
      
      // The AI response should be automatically added via real-time subscription
      // If it doesn't appear within 3 seconds, refresh messages
      setTimeout(() => {
        console.log('🔄 Checking if AI response appeared...');
        fetchMessages();
      }, 3000);
      
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