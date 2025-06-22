import { useState, useEffect } from 'react';
import { supabase, Chat, Message, ChatMember } from '../lib/supabase';

export function useChats(userId: string | undefined) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

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
          table: 'chats'
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
      console.log('📥 Fetching chats for user:', userId);
      
      // Get all chats where user is a member
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

      if (error) {
        console.error('❌ Error fetching chats:', error);
        throw error;
      }

      const chatList = data
        ?.map(item => item.chats)
        .filter(Boolean)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) || [];

      console.log('📥 Fetched', chatList.length, 'chats');
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
      console.log('🆕 Creating new chat:', title);
      
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          owner_id: userId,
          chat_title: title,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      console.log('✅ Chat created:', chat.id);

      // Add user as owner/member
      const { error: memberError } = await supabase
        .from('chat_members')
        .insert({
          chat_id: chat.id,
          user_id: userId,
          role: 'owner',
        });

      if (memberError) {
        console.error('❌ Error adding user as member:', memberError);
        throw memberError;
      }

      console.log('✅ User added as chat owner');

      await fetchChats();
      return chat;
    } catch (error) {
      console.error('Error creating chat:', error);
      return null;
    }
  };

  const updateChatTitle = async (chatId: string, title: string) => {
    try {
      console.log('📝 Updating chat title:', chatId, title);
      
      const { error } = await supabase
        .from('chats')
        .update({ chat_title: title })
        .eq('id', chatId);

      if (error) throw error;
      
      console.log('✅ Chat title updated');
      await fetchChats();
    } catch (error) {
      console.error('Error updating chat title:', error);
    }
  };

  const deleteChat = async (chatId: string) => {
    if (!userId) return false;

    setDeletingChatId(chatId);
    
    try {
      console.log('🗑️ Deleting chat:', chatId);
      
      const { data, error } = await supabase.rpc('delete_chat', {
        p_chat_id: chatId
      });

      if (error) {
        console.error('❌ Error deleting chat:', error);
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete chat');
      }

      console.log('✅ Chat deleted successfully:', data);
      
      // Remove chat from local state immediately
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
      
      return true;
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    } finally {
      setDeletingChatId(null);
    }
  };

  const canDeleteChat = (chat: Chat) => {
    return chat.owner_id === userId;
  };

  const joinChatByShareLink = async (shareLink: string) => {
    if (!userId) return null;

    try {
      console.log('🚪 Joining chat by share link:', shareLink);
      
      const { data, error } = await supabase.rpc('join_chat_by_share_link', {
        p_share_link_uuid: shareLink
      });

      if (error) {
        console.error('❌ Error joining chat:', error);
        throw error;
      }

      console.log('✅ Join result:', data);
      
      if (data.success) {
        await fetchChats();
        return data.chat_id;
      } else {
        throw new Error(data.error || 'Failed to join chat');
      }
    } catch (error) {
      console.error('Error joining chat by share link:', error);
      throw error;
    }
  };

  return {
    chats,
    loading,
    createChat,
    updateChatTitle,
    deleteChat,
    canDeleteChat,
    joinChatByShareLink,
    refetch: fetchChats,
    deletingChatId,
  };
}