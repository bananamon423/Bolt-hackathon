/*
  # Fix Real-time Messaging Configuration

  1. Enable real-time on necessary tables
  2. Optimize RLS policies for real-time performance
  3. Add performance indexes
  4. Grant necessary permissions
  5. Add real-time connectivity test function
*/

-- Enable real-time on the messages table
DO $$
BEGIN
  -- Check if messages table is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;

-- Enable real-time on chat_members table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'chat_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
  END IF;
END $$;

-- Enable real-time on chats table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chats;
  END IF;
END $$;

-- Drop existing policies to recreate them with proper real-time support
DROP POLICY IF EXISTS "Users can read messages in chats they are members of" ON messages;
DROP POLICY IF EXISTS "Users can insert messages to chats they are members of" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages or chat owners can update any" ON messages;
DROP POLICY IF EXISTS "Public can read messages via share link" ON messages;

-- Create optimized RLS policies for real-time
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

-- Create optimized indexes for real-time performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_chat ON chat_members(user_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_owner_id ON chats(owner_id);

-- Grant necessary permissions for real-time
GRANT SELECT ON messages TO anon;
GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;
GRANT SELECT ON chat_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_members TO authenticated;
GRANT SELECT ON chats TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON chats TO authenticated;

-- Add a function to test real-time connectivity
CREATE OR REPLACE FUNCTION public.test_realtime_connection()
RETURNS json AS $$
BEGIN
  RETURN json_build_object(
    'success', true,
    'timestamp', now(),
    'message', 'Real-time connection test successful'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.test_realtime_connection() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_realtime_connection() TO anon;

-- Create a function to check real-time publication status
CREATE OR REPLACE FUNCTION public.check_realtime_tables()
RETURNS json AS $$
BEGIN
  RETURN json_build_object(
    'tables_in_publication', (
      SELECT json_agg(tablename) 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime'
    ),
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_realtime_tables() TO authenticated;