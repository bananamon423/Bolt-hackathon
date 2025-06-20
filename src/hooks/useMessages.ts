import { useState, useEffect } from 'react';
import { supabase, Message } from '../lib/supabase';
// Import the profile type from your Supabase library if you have it defined
// For now, we'll create a minimal one here.
type Profile = {
  id: string;
  username: string;
  profile_picture_url: string | null;
};

export function useMessages(chatId: string | undefined, currentUser: Profile | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId) return;

    fetchMessages();

    // Create a more specific channel name to avoid conflicts
    const channelName = `messages-${chatId}`;
    console.log('Setting up real-time subscription for channel:', channelName);

    // Subscribe to new messages with better configuration
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        async (payload) => {
          console.log('Real-time message received:', payload.new);
          
          // Add a small delay to ensure the database transaction is complete
          setTimeout(async () => {
            try {
              // Fetch the complete message with profile data
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
                .eq('id', payload.new.id)
                .single();

              if (!error && fullMessage) {
                console.log('Full message data fetched:', fullMessage);
                
                setMessages((currentMessages) => {
                  // Check if message already exists (avoid duplicates)
                  const existingIndex = currentMessages.findIndex(m => m.id === fullMessage.id);
                  if (existingIndex >= 0) {
                    console.log('Replacing existing message');
                    // Replace existing message with complete data
                    const updatedMessages = [...currentMessages];
                    updatedMessages[existingIndex] = fullMessage;
                    return updatedMessages;
                  } else {
                    console.log('Adding new message to list');
                    // Add new message in correct chronological order
                    const newMessages = [...currentMessages, fullMessage];
                    return newMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                  }
                });
              } else {
                console.error('Error fetching full message:', error);
              }
            } catch (err) {
              console.error('Error in real-time message handler:', err);
            }
          }, 100); // Small delay to ensure database consistency
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel subscription error');
        }
      });

    return () => {
      console.log('Unsubscribing from real-time messages');
      subscription.unsubscribe();
    };
  }, [chatId]);

  const fetchMessages = async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      console.log('Fetching messages for chat:', chatId);
      
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
      
      console.log('Fetched messages:', data?.length || 0);
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string, userId: string) => {
    if (!chatId || !content.trim() || !currentUser) return null;

    console.log('Sending message:', content);

    // Create optimistic message with a unique temporary ID
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const optimisticMessage: Message = {
      id: tempId as any, // Temporary ID for optimistic update
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
        console.error('Error sending message:', error);
        // Remove optimistic message on error
        setMessages(currentMessages => 
          currentMessages.filter(m => m.id !== tempId)
        );
        throw error;
      }

      console.log('Message sent successfully:', insertedMessage);

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
      // Remove optimistic message on error
      setMessages(currentMessages => 
        currentMessages.filter(m => m.id !== tempId)
      );
      throw error;
    }
  };

  const sendAIMessage = async (content: string, modelId: string) => {
    if (!chatId || !content.trim()) return;

    console.log('Sending AI message:', content);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('No auth token');
      }

      console.log('Calling AI function...');

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
      
      console.log('AI function response:', result);
      
      if (!response.ok) {
        console.error('AI function error:', result);
        throw new Error(result.error || 'AI request failed');
      }

      console.log('AI message sent successfully');
      
      // The AI response will be automatically added via the real-time subscription
      // No need to manually add it here
      
      return result;
    } catch (error) {
      console.error('Error sending AI message:', error);
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