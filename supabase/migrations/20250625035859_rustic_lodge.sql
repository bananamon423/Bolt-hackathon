/*
  # Fix Real-time Publication for Messages

  This migration ensures that the messages table is properly added to the realtime publication
  and fixes any issues with real-time message synchronization.

  1. Tables
    - Ensures messages table is in realtime publication
    - Ensures chat_members table is in realtime publication
    - Ensures chats table is in realtime publication

  2. Security
    - Maintains existing RLS policies
    - Ensures proper real-time permissions

  3. Performance
    - Adds indexes for real-time queries
    - Optimizes subscription performance
*/

-- Ensure the realtime publication exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Function to safely add table to publication
CREATE OR REPLACE FUNCTION add_table_to_realtime(table_name text)
RETURNS void AS $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = table_name
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
    RAISE NOTICE 'Added table % to realtime publication', table_name;
  ELSE
    RAISE NOTICE 'Table % already in realtime publication', table_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add tables to realtime publication
SELECT add_table_to_realtime('messages');
SELECT add_table_to_realtime('chat_members');
SELECT add_table_to_realtime('chats');

-- Drop the helper function
DROP FUNCTION add_table_to_realtime(text);

-- Ensure proper indexes for real-time performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_created_realtime 
ON messages (chat_id, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_sender_realtime 
ON messages (sender_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Grant necessary permissions for real-time
GRANT SELECT ON messages TO anon, authenticated;
GRANT SELECT ON chat_members TO anon, authenticated;
GRANT SELECT ON chats TO anon, authenticated;

-- Ensure RLS is enabled (should already be enabled)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Add a function to test real-time connection
CREATE OR REPLACE FUNCTION test_realtime_connection()
RETURNS json AS $$
BEGIN
  RETURN json_build_object(
    'status', 'connected',
    'timestamp', now(),
    'tables_in_publication', (
      SELECT json_agg(tablename)
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the test function
GRANT EXECUTE ON FUNCTION test_realtime_connection() TO anon, authenticated;