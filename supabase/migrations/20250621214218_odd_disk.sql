/*
  # Fix PostgreSQL Function Dependencies and Policy Conflicts

  1. Problem Analysis
    - Functions cannot be dropped because policies depend on them
    - Some policies already exist and cause conflicts
    - Need to drop all dependent objects before recreating functions

  2. Solution
    - Drop ALL existing policies first (including the share_link policy)
    - Then drop functions safely
    - Recreate functions with correct parameter names
    - Recreate all policies with proper function references

  3. Order of Operations
    - Drop policies (removes dependencies)
    - Drop functions (now safe)
    - Create functions (with new signatures)
    - Create policies (using new functions)
    - Grant permissions
*/

-- Step 1: Drop ALL policies that might depend on functions or cause conflicts
DROP POLICY IF EXISTS "Users can read accessible chats" ON chats;
DROP POLICY IF EXISTS "Anyone can read chats by share link" ON chats;
DROP POLICY IF EXISTS "Read/write/delete chat by share_link" ON chats;
DROP POLICY IF EXISTS "Users can create chats" ON chats;
DROP POLICY IF EXISTS "Users can update chats they own" ON chats;
DROP POLICY IF EXISTS "Chat members can read member list" ON chat_members;
DROP POLICY IF EXISTS "Chat owners can read all members" ON chat_members;
DROP POLICY IF EXISTS "Chat owners can add members" ON chat_members;
DROP POLICY IF EXISTS "Chat owners can update members" ON chat_members;
DROP POLICY IF EXISTS "Chat owners can remove members" ON chat_members;
DROP POLICY IF EXISTS "Users can join chats themselves" ON chat_members;
DROP POLICY IF EXISTS "Users can read messages from their chats" ON messages;
DROP POLICY IF EXISTS "Users can insert messages to their chats" ON messages;

-- Step 2: Now safely drop all existing helper functions
DROP FUNCTION IF EXISTS public.is_user_in_chat(uuid);
DROP FUNCTION IF EXISTS public.is_user_chat_owner(uuid);
DROP FUNCTION IF EXISTS public.is_chat_member(uuid);
DROP FUNCTION IF EXISTS public.join_chat_by_share_link(uuid);

-- Step 3: Recreate functions with correct and consistent parameter names

-- Function to check if current user is a member of a specific chat
CREATE OR REPLACE FUNCTION public.is_user_in_chat(p_chat_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chat_members 
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is the owner of a specific chat
CREATE OR REPLACE FUNCTION public.is_user_chat_owner(p_chat_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chats 
    WHERE id = p_chat_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is a member of a specific chat (alias for consistency)
CREATE OR REPLACE FUNCTION public.is_chat_member(p_chat_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chat_members 
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to join a chat by share link
CREATE OR REPLACE FUNCTION public.join_chat_by_share_link(p_share_link_uuid uuid)
RETURNS json AS $$
DECLARE
  target_chat chats%ROWTYPE;
  existing_member chat_members%ROWTYPE;
  user_profile profiles%ROWTYPE;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get user profile for username
  SELECT * INTO user_profile FROM profiles WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Find the chat by share link
  SELECT * INTO target_chat FROM chats WHERE share_link = p_share_link_uuid;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Chat not found or invalid share link');
  END IF;

  -- Check if user is already a member
  SELECT * INTO existing_member FROM chat_members 
  WHERE chat_id = target_chat.id AND user_id = auth.uid();
  
  IF FOUND THEN
    RETURN json_build_object(
      'success', true, 
      'message', 'Already a member of this chat',
      'chat_id', target_chat.id
    );
  END IF;

  -- Add user as member
  INSERT INTO chat_members (chat_id, user_id, role)
  VALUES (target_chat.id, auth.uid(), 'member');

  -- Add system message about user joining
  INSERT INTO messages (chat_id, sender_type, content, message_type)
  VALUES (
    target_chat.id, 
    'system', 
    COALESCE(user_profile.username, 'A user') || ' joined the chat',
    'USER_TO_USER'
  );

  RETURN json_build_object(
    'success', true, 
    'message', 'Successfully joined chat',
    'chat_id', target_chat.id,
    'chat_title', target_chat.chat_title
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Failed to join chat: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Recreate all RLS policies with corrected function calls

-- Chats policies
CREATE POLICY "Users can read accessible chats"
  ON chats
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR public.is_user_in_chat(id) = true
  );

CREATE POLICY "Users can create chats"
  ON chats
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update chats they own"
  ON chats
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- Special policy for shared chat access via share links
CREATE POLICY "Read/write/delete chat by share_link"
  ON chats
  FOR ALL
  TO public
  USING (share_link::text = current_setting('request.headers.share_link', true))
  WITH CHECK (share_link::text = current_setting('request.headers.share_link', true));

-- Chat members policies
CREATE POLICY "Chat members can read member list"
  ON chat_members
  FOR SELECT
  TO authenticated
  USING (public.is_user_in_chat(chat_id));

CREATE POLICY "Chat owners can read all members"
  ON chat_members
  FOR SELECT
  TO authenticated
  USING (public.is_user_chat_owner(chat_id));

CREATE POLICY "Chat owners can add members"
  ON chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_user_chat_owner(chat_id));

CREATE POLICY "Chat owners can update members"
  ON chat_members
  FOR UPDATE
  TO authenticated
  USING (public.is_user_chat_owner(chat_id))
  WITH CHECK (public.is_user_chat_owner(chat_id));

CREATE POLICY "Chat owners can remove members"
  ON chat_members
  FOR DELETE
  TO authenticated
  USING (public.is_user_chat_owner(chat_id));

-- Allow users to add themselves to chats (for shared chat joining)
CREATE POLICY "Users can join chats themselves"
  ON chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Messages policies
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

-- Step 5: Grant proper permissions
GRANT EXECUTE ON FUNCTION public.is_user_in_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_chat_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_chat_by_share_link(uuid) TO authenticated;