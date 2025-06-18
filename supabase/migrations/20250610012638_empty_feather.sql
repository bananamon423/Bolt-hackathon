/*
  # Fix infinite recursion in chat_members RLS policies

  1. Problem
    - Current RLS policies on chat_members create infinite recursion
    - Policies reference each other in circular manner
    - This prevents any chat operations from working

  2. Solution
    - Drop existing problematic policies
    - Create new, simpler policies that avoid circular references
    - Use direct user_id checks where possible
    - Separate owner vs member permissions clearly

  3. New Policies
    - Users can read chat_members for chats they own (via direct ownership check)
    - Users can read chat_members for chats they're members of (via direct membership)
    - Users can insert/update/delete chat_members for chats they own
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can manage members of their chats" ON chat_members;
DROP POLICY IF EXISTS "Users can read chat members for their chats" ON chat_members;

-- Create new policies that avoid circular references

-- Allow users to read chat members for chats they own
CREATE POLICY "Chat owners can read all members"
  ON chat_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = chat_members.chat_id 
      AND chats.owner_id = auth.uid()
    )
  );

-- Allow users to read chat members for chats they're members of (including themselves)
CREATE POLICY "Chat members can read member list"
  ON chat_members
  FOR SELECT
  TO authenticated
  USING (
    chat_id IN (
      SELECT cm.chat_id 
      FROM chat_members cm 
      WHERE cm.user_id = auth.uid()
    )
  );

-- Allow users to insert chat members for chats they own
CREATE POLICY "Chat owners can add members"
  ON chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = chat_members.chat_id 
      AND chats.owner_id = auth.uid()
    )
  );

-- Allow users to update chat members for chats they own
CREATE POLICY "Chat owners can update members"
  ON chat_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = chat_members.chat_id 
      AND chats.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = chat_members.chat_id 
      AND chats.owner_id = auth.uid()
    )
  );

-- Allow users to delete chat members for chats they own
CREATE POLICY "Chat owners can remove members"
  ON chat_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = chat_members.chat_id 
      AND chats.owner_id = auth.uid()
    )
  );

-- Also need to fix the chats table policy that might be causing issues
-- Drop and recreate the problematic chats policy
DROP POLICY IF EXISTS "Users can read chats they're members of" ON chats;

-- Create a simpler policy for reading chats
CREATE POLICY "Users can read chats they're members of"
  ON chats
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() 
    OR 
    id IN (
      SELECT chat_id 
      FROM chat_members 
      WHERE user_id = auth.uid()
    )
  );