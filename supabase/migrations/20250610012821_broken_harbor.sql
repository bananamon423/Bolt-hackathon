/*
  # Fix infinite recursion in chat RLS policies

  1. Policy Changes
    - Drop the problematic "Users can read chats they're members of" policy
    - Create a simpler policy that avoids recursion
    - Ensure users can read chats they own or are members of without circular references

  2. Security
    - Maintain proper access control for chat data
    - Prevent unauthorized access to chats
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can read chats they're members of" ON chats;

-- Create a new policy that avoids recursion by using a direct join
CREATE POLICY "Users can read accessible chats"
  ON chats
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() 
    OR 
    EXISTS (
      SELECT 1 
      FROM chat_members 
      WHERE chat_members.chat_id = chats.id 
      AND chat_members.user_id = auth.uid()
    )
  );