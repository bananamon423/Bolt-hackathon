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
        (payload) => {
          // Instead of refetching, append the new message.
          // We also get the full profile info with it.
          const newMessage = payload.new as Message;
          
          setMessages((currentMessages) => {
            // Avoid adding duplicates if the message is already there from the optimistic update
            if (currentMessages.find(m => m.id === newMessage.id)) {
              return currentMessages;
            }
            return [...currentMessages, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [chatId]);

  const fetchMessages = async () => {
    if (!chatId) return;
    setLoading(true); // Set loading true when fetching
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
      id: crypto.randomUUID(), // Generate a temporary unique ID
      chat_id: chatId,
      sender_id: userId,
      sender_type: 'user',
      content: content.trim(),
      created_at: new Date().toISOString(),
      profiles: currentUser, // Use the currently logged-in user's profile info
    };

    setMessages(currentMessages => [...currentMessages, optimisticMessage]);
    // --- End of Optimistic Update ---

    try {
      // The actual insert doesn't need to return data anymore
      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: userId,
          sender_type: 'user',
          content: content.trim(),
        });

      if (error) {
         // If error, remove the optimistic message
        console.error('Error sending message:', error);
        setMessages(currentMessages => currentMessages.filter(m => m.id !== optimisticMessage.id));
      }
      // No 'else' needed. The real message will arrive via subscription and replace the optimistic one if needed.
    } catch (error) {
      console.error('Error sending message:', error);
       // If error, remove the optimistic message
      setMessages(currentMessages => currentMessages.filter(m => m.id !== optimisticMessage.id));
    }
    return null;
  };

  const sendAIMessage = async (content: string, modelId: string) => {
    // This function remains largely the same as it likely triggers a server-side insert
    // which will be caught by the real-time subscription.
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