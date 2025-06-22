import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, Chat } from '../lib/supabase';

export function useSharedChat() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const navigate = useNavigate();
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Load chat by share link
  useEffect(() => {
    if (!shareLink) return;
    
    const loadSharedChat = async () => {
      try {
        console.log('🔍 Loading shared chat with link:', shareLink);
        
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .eq('share_link', shareLink);

        if (error) {
          console.error('❌ Error loading shared chat:', error);
          setError('Failed to load chat');
          return;
        }

        // Check if any chat was found
        if (!data || data.length === 0) {
          console.log('❌ No chat found with share link:', shareLink);
          setError('Chat not found or link is invalid');
          setChat(null);
          return;
        }

        // Use the first (and should be only) chat found
        const foundChat = data[0];
        console.log('✅ Shared chat loaded:', foundChat);
        setChat(foundChat);
      } catch (err) {
        console.error('Error loading shared chat:', err);
        setError('Failed to load chat');
      } finally {
        setLoading(false);
      }
    };

    loadSharedChat();
  }, [shareLink]);

  const joinChat = async (userId: string) => {
    if (!chat || hasJoined || isJoining) return false;

    setIsJoining(true);
    try {
      console.log('🚪 Attempting to join chat:', chat.id);

      const { data, error } = await supabase.rpc('join_chat_by_share_link', {
        share_link_uuid: chat.share_link
      });

      if (error) {
        console.error('❌ Error joining chat:', error);
        setError('Failed to join chat');
        return false;
      }

      console.log('✅ Join result:', data);
      
      if (data.success) {
        setHasJoined(true);
        console.log('🎉 Successfully joined chat');
        
        // Navigate to main app with the chat selected
        setTimeout(() => {
          navigate('/', { 
            state: { 
              selectedChatId: chat.id,
              joinedFromShare: true 
            } 
          });
        }, 2000);
        
        return true;
      } else {
        setError(data.error || 'Failed to join chat');
        return false;
      }
    } catch (err) {
      console.error('Error joining chat:', err);
      setError('Failed to join chat');
      return false;
    } finally {
      setIsJoining(false);
    }
  };

  const checkMembership = async (userId: string) => {
    if (!chat || !userId) return false;

    try {
      const { data, error } = await supabase
        .from('chat_members')
        .select('role')
        .eq('chat_id', chat.id)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking membership:', error);
        return false;
      }

      const isMember = !!data;
      setHasJoined(isMember);
      return isMember;
    } catch (err) {
      console.error('Error checking membership:', err);
      return false;
    }
  };

  return {
    shareLink,
    chat,
    loading,
    error,
    hasJoined,
    isJoining,
    joinChat,
    checkMembership,
    setError
  };
}