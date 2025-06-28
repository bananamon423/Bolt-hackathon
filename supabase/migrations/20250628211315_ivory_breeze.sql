/*
  # Create check_user_chat_membership_v2 function

  1. New Function
    - `check_user_chat_membership_v2(user_id, chat_id)`
      - Accepts two UUID parameters
      - Returns boolean indicating chat membership
      - Optimized for fast read access
      - Independent function for RevenueCat validation

  2. Performance
    - Uses efficient EXISTS query
    - Leverages existing indexes on chat_members table
    - No dependency on RLS policies or other functions
*/

CREATE FUNCTION check_user_chat_membership_v2(
  p_user_id uuid,
  p_chat_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if user is a member of the specified chat
  -- Uses EXISTS for optimal performance with early termination
  RETURN EXISTS (
    SELECT 1 
    FROM chat_members 
    WHERE user_id = p_user_id 
      AND chat_id = p_chat_id
  );
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION check_user_chat_membership_v2(uuid, uuid) IS 
'Fast membership check for RevenueCat subscription validation. Returns true if user is a member of the specified chat.';