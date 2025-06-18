import { useState, useEffect } from 'react';
import { supabase, Chat, Message, ChatMember } from '../lib/supabase';

export function useChats(userId: string | undefined) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    fetchChats();

    // Subscribe to chat changes
    const chatsSubscription = supabase
      .channel('chats')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'chats',
          filter: `owner_id=eq.${userId}`
        },
        () => fetchChats()
      )
      .subscribe();

    // Subscribe to chat member changes
    const membersSubscription = supabase
      .channel('chat_members')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_members',
          filter: `user_id=eq.${userId}`
        },
        () => fetchChats()
      )
      .subscribe();

    return () => {
      chatsSubscription.unsubscribe();
      membersSubscription.unsubscribe();
    };
  }, [userId]);

  const fetchChats = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('chat_members')
        .select(`
          chats (
            id,
            owner_id,
            folder_id,
            chat_title,
            active_model_id,
            share_link,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;

      const chatList = data
        ?.map(item => item.chats)
        .filter(Boolean)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) || [];

      setChats(chatList as Chat[]);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const createChat = async (title: string = 'New Chat') => {
    if (!userId) return null;

    try {
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          owner_id: userId,
          chat_title: title,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add user as member
      const { error: memberError } = await supabase
        .from('chat_members')
        .insert({
          chat_id: chat.id,
          user_id: userId,
          role: 'owner',
        });

      if (memberError) throw memberError;

      await fetchChats();
      return chat;
    } catch (error) {
      console.error('Error creating chat:', error);
      return null;
    }
  };

  const updateChatTitle = async (chatId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ chat_title: title })
        .eq('id', chatId);

      if (error) throw error;
      await fetchChats();
    } catch (error) {
      console.error('Error updating chat title:', error);
    }
  };

  return {
    chats,
    loading,
    createChat,
    updateChatTitle,
    refetch: fetchChats,
  };
}