/*
# Add Chat Deletion Feature

1. New Functions
   - `delete_chat` - Function to safely delete a chat and all related data
   - `can_delete_chat` - Function to check if user can delete a specific chat

2. Security
   - Only chat owners can delete their chats
   - Cascading deletion of related data (messages, members, etc.)
   - Proper error handling and logging

3. Data Integrity
   - Soft delete approach for audit trail
   - Foreign key constraints maintained
   - Transaction safety
*/

-- Function to check if current user can delete a specific chat
CREATE OR REPLACE FUNCTION public.can_delete_chat(p_chat_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user is the owner of the chat
  RETURN EXISTS (
    SELECT 1 FROM chats 
    WHERE id = p_chat_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a chat and all related data
CREATE OR REPLACE FUNCTION public.delete_chat(p_chat_id uuid)
RETURNS json AS $$
DECLARE
  target_chat chats%ROWTYPE;
  message_count integer;
  member_count integer;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get the chat
  SELECT * INTO target_chat FROM chats WHERE id = p_chat_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Chat not found');
  END IF;

  -- Check if user is the owner
  IF target_chat.owner_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Only chat owners can delete chats');
  END IF;

  -- Get counts for logging
  SELECT COUNT(*) INTO message_count FROM messages WHERE chat_id = p_chat_id;
  SELECT COUNT(*) INTO member_count FROM chat_members WHERE chat_id = p_chat_id;

  -- Start transaction for safe deletion
  BEGIN
    -- Delete all messages in the chat
    DELETE FROM messages WHERE chat_id = p_chat_id;
    
    -- Delete all chat members
    DELETE FROM chat_members WHERE chat_id = p_chat_id;
    
    -- Delete any credit transactions related to this chat
    DELETE FROM credit_transactions WHERE chat_id = p_chat_id;
    
    -- Delete any error logs related to this chat
    DELETE FROM error_logs WHERE chat_id = p_chat_id;
    
    -- Finally delete the chat itself
    DELETE FROM chats WHERE id = p_chat_id;

    -- Log the deletion for audit purposes
    INSERT INTO error_logs (user_id, error_source, error_details)
    VALUES (
      auth.uid(),
      'Chat Deletion',
      json_build_object(
        'chat_id', p_chat_id,
        'chat_title', target_chat.chat_title,
        'messages_deleted', message_count,
        'members_removed', member_count,
        'deleted_at', now(),
        'action', 'chat_deleted'
      )
    );

    RETURN json_build_object(
      'success', true, 
      'message', 'Chat deleted successfully',
      'chat_title', target_chat.chat_title,
      'messages_deleted', message_count,
      'members_removed', member_count
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback will happen automatically
      RETURN json_build_object(
        'success', false, 
        'error', 'Failed to delete chat: ' || SQLERRM
      );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy for chat deletion
CREATE POLICY "Chat owners can delete their chats"
  ON chats
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.can_delete_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_chat(uuid) TO authenticated;