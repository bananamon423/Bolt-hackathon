import { useState, useEffect } from 'react';
import { supabase, Chat, Message, ChatMember } from '../lib/supabase';

export function useChats(userId: string | undefined) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      console.log('💬 useChats: No user ID provided');
      return;
    }

    console.log('💬 useChats: Initializing chat tracking for user:', userId);
    fetchChats();

    // Subscribe to chat changes with enhanced logging
    const chatsSubscription = supabase
      .channel(`chats_${userId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: userId },
          private: false
        }
      })
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'chats'
        },
        (payload) => {
          console.log('🔄 useChats: Chat change event received:', {
            eventType: payload.eventType,
            chatId: payload.new?.id || payload.old?.id,
            chatTitle: payload.new?.chat_title || payload.old?.chat_title
          });
          fetchChats();
        }
      )
      .subscribe((status) => {
        console.log('📡 useChats: Chat subscription status:', status);
      });

    // Subscribe to chat member changes with enhanced logging
    const membersSubscription = supabase
      .channel(`chat_members_${userId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: userId },
          private: false
        }
      })
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_members',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 useChats: Chat member change event received:', {
            eventType: payload.eventType,
            chatId: payload.new?.chat_id || payload.old?.chat_id,
            userId: payload.new?.user_id || payload.old?.user_id,
            role: payload.new?.role || payload.old?.role
          });
          fetchChats();
        }
      )
      .subscribe((status) => {
        console.log('📡 useChats: Chat members subscription status:', status);
      });

    return () => {
      console.log('🧹 useChats: Cleaning up chat subscriptions for user:', userId);
      chatsSubscription.unsubscribe();
      membersSubscription.unsubscribe();
    };
  }, [userId]);

  const fetchChats = async () => {
    if (!userId) {
      console.log('🚫 useChats: Cannot fetch chats - no userId');
      return;
    }

    try {
      console.log('📥 useChats: Fetching chats for user:', userId);
      
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
        console.error('❌ useChats: Error fetching chats:', error);
        throw error;
      }

      const chatList = data
        ?.map(item => item.chats)
        .filter(Boolean)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) || [];

      console.log('📥 useChats: Fetched chats successfully:', {
        count: chatList.length,
        chatIds: chatList.map(chat => chat.id)
      });
      
      setChats(chatList as Chat[]);
    } catch (error) {
      console.error('❌ useChats: Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const createChat = async (title: string = 'New Chat') => {
    if (!userId) {
      console.log('🚫 useChats: Cannot create chat - no userId');
      return null;
    }

    try {
      console.log('🆕 useChats: Creating new chat:', title);
      
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          owner_id: userId,
          chat_title: title,
        })
        .select()
        .single();

      if (chatError) {
        console.error('❌ useChats: Error creating chat:', chatError);
        throw chatError;
      }

      console.log('✅ useChats: Chat created:', chat.id);

      // Add user as owner/member
      const { error: memberError } = await supabase
        .from('chat_members')
        .insert({
          chat_id: chat.id,
          user_id: userId,
          role: 'owner',
        });

      if (memberError) {
        console.error('❌ useChats: Error adding user as member:', memberError);
        throw memberError;
      }

      console.log('✅ useChats: User added as chat owner');

      await fetchChats();
      return chat;
    } catch (error) {
      console.error('❌ useChats: Error creating chat:', error);
      return null;
    }
  };

  const updateChatTitle = async (chatId: string, title: string) => {
    try {
      console.log('📝 useChats: Updating chat title:', { chatId, title });
      
      const { error } = await supabase
        .from('chats')
        .update({ chat_title: title })
        .eq('id', chatId);

      if (error) {
        console.error('❌ useChats: Error updating chat title:', error);
        throw error;
      }
      
      console.log('✅ useChats: Chat title updated');
      await fetchChats();
    } catch (error) {
      console.error('❌ useChats: Error updating chat title:', error);
    }
  };

  const deleteChat = async (chatId: string) => {
    if (!userId) {
      console.log('🚫 useChats: Cannot delete chat - no userId');
      return false;
    }

    setDeletingChatId(chatId);
    
    try {
      console.log('🗑️ useChats: Deleting chat:', chatId);
      
      const { data, error } = await supabase.rpc('delete_chat', {
        p_chat_id: chatId
      });

      if (error) {
        console.error('❌ useChats: Error deleting chat:', error);
        throw new Error(error.message);
      }

      if (!data.success) {
        console.error('❌ useChats: Delete chat failed:', data.error);
        throw new Error(data.error || 'Failed to delete chat');
      }

      console.log('✅ useChats: Chat deleted successfully:', data);
      
      // Remove chat from local state immediately
      setChats(prevChats => {
        const updatedChats = prevChats.filter(chat => chat.id !== chatId);
        console.log('🔄 useChats: Updated local chat list after deletion:', {
          removedChatId: chatId,
          remainingChats: updatedChats.length
        });
        return updatedChats;
      });
      
      return true;
    } catch (error) {
      console.error('❌ useChats: Error deleting chat:', error);
      throw error;
    } finally {
      setDeletingChatId(null);
    }
  };

  const canDeleteChat = (chat: Chat) => {
    const canDelete = chat.owner_id === userId;
    console.log('🔍 useChats: Checking delete permission:', {
      chatId: chat.id,
      chatOwnerId: chat.owner_id,
      currentUserId: userId,
      canDelete
    });
    return canDelete;
  };

  const joinChatByShareLink = async (shareLink: string) => {
    if (!userId) {
      console.log('🚫 useChats: Cannot join chat - no userId');
      return null;
    }

    try {
      console.log('🚪 useChats: Joining chat by share link:', shareLink);
      
      const { data, error } = await supabase.rpc('join_chat_by_share_link', {
        p_share_link_uuid: shareLink
      });

      if (error) {
        console.error('❌ useChats: Error joining chat:', error);
        throw error;
      }

      console.log('✅ useChats: Join result:', data);
      
      if (data.success) {
        await fetchChats();
        return data.chat_id;
      } else {
        throw new Error(data.error || 'Failed to join chat');
      }
    } catch (error) {
      console.error('❌ useChats: Error joining chat by share link:', error);
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