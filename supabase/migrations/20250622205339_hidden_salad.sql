/*
# Fix Real-time Messaging Configuration

This migration ensures that:
1. Realtime is enabled on the messages table
2. RLS policies allow proper message access for chat members
3. All necessary permissions are granted

## Changes Made
1. Enable realtime on messages table
2. Update RLS policies for proper message access
3. Grant necessary permissions
*/

-- Enable realtime on the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Drop existing message policies to recreate them properly
DROP POLICY IF EXISTS "Users can read messages from their chats" ON messages;
DROP POLICY IF EXISTS "Users can insert messages to their chats" ON messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;

-- Create comprehensive RLS policies for messages
CREATE POLICY "Users can read messages in chats they are members of"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM chat_members 
      WHERE chat_members.chat_id = messages.chat_id 
      AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to chats they are members of"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM chat_members 
      WHERE chat_members.chat_id = messages.chat_id 
      AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages or chat owners can update any"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid() OR 
    EXISTS (
      SELECT 1 
      FROM chats 
      WHERE chats.id = messages.chat_id 
      AND chats.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    sender_id = auth.uid() OR 
    EXISTS (
      SELECT 1 
      FROM chats 
      WHERE chats.id = messages.chat_id 
      AND chats.owner_id = auth.uid()
    )
  );

-- Allow public read access to messages via share link (for shared chats)
CREATE POLICY "Public can read messages via share link"
  ON messages
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 
      FROM chats 
      WHERE chats.id = messages.chat_id 
      AND chats.share_link::text = current_setting('request.headers.share_link', true)
    )
  );

-- Grant necessary permissions
GRANT SELECT ON messages TO anon;
GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;

-- Ensure chat_members table also has realtime enabled
ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
GRANT SELECT ON chat_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_members TO authenticated;

-- Ensure chats table has realtime enabled
ALTER PUBLICATION supabase_realtime ADD TABLE chats;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_user ON chat_members(chat_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chats_share_link ON chats(share_link);

-- Refresh the realtime schema cache
NOTIFY pgrst, 'reload schema';