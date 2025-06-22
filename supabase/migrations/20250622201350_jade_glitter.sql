/*
  # Add Message Deletion Support

  1. New Features
    - Add deleted_at column to messages table
    - Add delete_reason column for tracking deletion reasons
    - Add RLS policies for message deletion
    - Add function to soft delete messages

  2. Security
    - Users can only delete their own messages
    - Soft delete preserves message history
    - System messages cannot be deleted by users
*/

-- Add columns for message deletion support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'delete_reason'
  ) THEN
    ALTER TABLE messages ADD COLUMN delete_reason text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE messages ADD COLUMN deleted_by uuid REFERENCES profiles(id) DEFAULT NULL;
  END IF;
END $$;

-- Function to soft delete a message
CREATE OR REPLACE FUNCTION public.delete_message(p_message_id bigint, p_reason text DEFAULT 'User deleted')
RETURNS json AS $$
DECLARE
  target_message messages%ROWTYPE;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get the message
  SELECT * INTO target_message FROM messages WHERE id = p_message_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Message not found');
  END IF;

  -- Check if message is already deleted
  IF target_message.deleted_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Message already deleted');
  END IF;

  -- Check if user can delete this message (own message or chat owner)
  IF target_message.sender_id != auth.uid() AND NOT public.is_user_chat_owner(target_message.chat_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to delete this message');
  END IF;

  -- Don't allow deletion of system messages by regular users
  IF target_message.sender_type = 'system' AND NOT public.is_user_chat_owner(target_message.chat_id) THEN
    RETURN json_build_object('success', false, 'error', 'Cannot delete system messages');
  END IF;

  -- Soft delete the message
  UPDATE messages 
  SET 
    deleted_at = now(),
    delete_reason = p_reason,
    deleted_by = auth.uid()
  WHERE id = p_message_id;

  RETURN json_build_object(
    'success', true, 
    'message', 'Message deleted successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Failed to delete message: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy for message deletion
CREATE POLICY "Users can delete own messages"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid() OR public.is_user_chat_owner(chat_id)
  )
  WITH CHECK (
    sender_id = auth.uid() OR public.is_user_chat_owner(chat_id)
  );

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.delete_message(bigint, text) TO authenticated;

-- Create index for better performance on deleted messages
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at) WHERE deleted_at IS NOT NULL;