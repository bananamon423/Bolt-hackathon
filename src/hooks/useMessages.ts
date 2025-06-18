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

    // Subscribe to new messages
    const subscription = supabase
      .channel(`messages:${chatId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        async (payload) => {
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
            setMessages((currentMessages) => {
              // Remove any existing message with the same ID (in case of duplicates)
              const filteredMessages = currentMessages.filter(m => m.id !== fullMessage.id);
              return [...filteredMessages, fullMessage];
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [chatId]);

  const fetchMessages = async () => {
    if (!chatId) return;
    setLoading(true);
    try {
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
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string, userId: string) => {
    if (!chatId || !content.trim() || !currentUser) return null;

    // --- Start of Optimistic Update ---
    const optimisticMessage: Message = {
      id: Date.now(), // Use timestamp as temporary ID
      chat_id: chatId,
      sender_id: userId,
      sender_type: 'user',
      content: content.trim(),
      created_at: new Date().toISOString(),
      profiles: currentUser,
    };

    setMessages(currentMessages => [...currentMessages, optimisticMessage]);
    // --- End of Optimistic Update ---

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: userId,
          sender_type: 'user',
          content: content.trim(),
        });

      if (error) {
        console.error('Error sending message:', error);
        setMessages(currentMessages => currentMessages.filter(m => m.id !== optimisticMessage.id));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(currentMessages => currentMessages.filter(m => m.id !== optimisticMessage.id));
    }
    return null;
  };

  const sendAIMessage = async (content: string, modelId: string) => {
    if (!chatId || !content.trim()) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('No auth token');
      }

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
      
      if (!response.ok) {
        throw new Error(result.error || 'AI request failed');
      }

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