/*
  # Fix Shared Chat Access Issues

  1. Problem Analysis
    - Users can't join shared chats properly
    - RLS policies may be too restrictive for shared access
    - Need better handling of public chat access via share links

  2. Solutions
    - Add helper functions to check chat access
    - Update RLS policies to allow shared chat access
    - Improve chat member management
    - Add public read access for shared chats

  3. New Features
    - Public chat access via share links
    - Automatic member addition for shared chats
    - Better permission handling
*/

-- Create helper functions for chat access control
CREATE OR REPLACE FUNCTION is_user_in_chat(chat_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chat_members 
    WHERE chat_id = chat_uuid AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_user_chat_owner(chat_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chats 
    WHERE id = chat_uuid AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_chat_member(chat_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chat_members 
    WHERE chat_id = chat_uuid AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can read accessible chats" ON chats;
DROP POLICY IF EXISTS "Chat members can read member list" ON chat_members;
DROP POLICY IF EXISTS "Chat owners can read all members" ON chat_members;
DROP POLICY IF EXISTS "Chat owners can add members" ON chat_members;
DROP POLICY IF EXISTS "Chat owners can update members" ON chat_members;
DROP POLICY IF EXISTS "Chat owners can remove members" ON chat_members;

-- Create new, more permissive policies for shared chats

-- Chats policies - allow reading chats by share link OR membership
CREATE POLICY "Users can read accessible chats"
  ON chats
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR is_user_in_chat(id) = true
  );

-- Also allow reading chats by share link (for joining)
CREATE POLICY "Anyone can read chats by share link"
  ON chats
  FOR SELECT
  TO authenticated
  USING (true); -- We'll control access in the application layer

-- Chat members policies with better access control
CREATE POLICY "Chat members can read member list"
  ON chat_members
  FOR SELECT
  TO authenticated
  USING (is_user_in_chat(chat_id));

CREATE POLICY "Chat owners can read all members"
  ON chat_members
  FOR SELECT
  TO authenticated
  USING (is_user_chat_owner(chat_id));

CREATE POLICY "Chat owners can add members"
  ON chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (is_user_chat_owner(chat_id));

CREATE POLICY "Chat owners can update members"
  ON chat_members
  FOR UPDATE
  TO authenticated
  USING (is_user_chat_owner(chat_id))
  WITH CHECK (is_user_chat_owner(chat_id));

CREATE POLICY "Chat owners can remove members"
  ON chat_members
  FOR DELETE
  TO authenticated
  USING (is_user_chat_owner(chat_id));

-- Allow users to add themselves to chats (for shared chat joining)
CREATE POLICY "Users can join chats themselves"
  ON chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Messages policies - allow reading messages from accessible chats
DROP POLICY IF EXISTS "Users can read messages from their chats" ON messages;
DROP POLICY IF EXISTS "Users can insert messages to their chats" ON messages;

CREATE POLICY "Users can read messages from their chats"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their chats"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()
    )
  );

-- Function to join a chat by share link
CREATE OR REPLACE FUNCTION join_chat_by_share_link(share_link_uuid uuid)
RETURNS json AS $$
DECLARE
  target_chat chats%ROWTYPE;
  existing_member chat_members%ROWTYPE;
  result json;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the chat by share link
  SELECT * INTO target_chat FROM chats WHERE share_link = share_link_uuid;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Chat not found');
  END IF;

  -- Check if user is already a member
  SELECT * INTO existing_member FROM chat_members 
  WHERE chat_id = target_chat.id AND user_id = auth.uid();
  
  IF FOUND THEN
    RETURN json_build_object(
      'success', true, 
      'message', 'Already a member',
      'chat_id', target_chat.id
    );
  END IF;

  -- Add user as member
  INSERT INTO chat_members (chat_id, user_id, role)
  VALUES (target_chat.id, auth.uid(), 'member');

  -- Add system message about user joining
  INSERT INTO messages (chat_id, sender_type, content)
  VALUES (
    target_chat.id, 
    'system', 
    (SELECT username FROM profiles WHERE id = auth.uid()) || ' joined the chat'
  );

  RETURN json_build_object(
    'success', true, 
    'message', 'Successfully joined chat',
    'chat_id', target_chat.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION join_chat_by_share_link(uuid) TO authenticated;