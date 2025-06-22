import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function useMessageActions() {
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(null);

  const deleteMessage = async (messageId: number, reason: string = 'User deleted') => {
    setDeletingMessageId(messageId);
    
    try {
      console.log('🗑️ Deleting message:', messageId);
      
      const { data, error } = await supabase.rpc('delete_message', {
        p_message_id: messageId,
        p_reason: reason
      });

      if (error) {
        console.error('❌ Error deleting message:', error);
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete message');
      }

      console.log('✅ Message deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    } finally {
      setDeletingMessageId(null);
    }
  };

  const canDeleteMessage = (message: any, currentUserId: string, isOwner: boolean) => {
    // Can't delete already deleted messages
    if (message.deleted_at) return false;
    
    // System messages can only be deleted by chat owners
    if (message.sender_type === 'system') return isOwner;
    
    // Users can delete their own messages, owners can delete any message
    return message.sender_id === currentUserId || isOwner;
  };

  return {
    deleteMessage,
    canDeleteMessage,
    deletingMessageId
  };
}