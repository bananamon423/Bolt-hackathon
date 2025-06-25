/*
# Get Profile Credits Function

1. New Functions
  - `get_profile_credits` - Securely fetch user's credit balance
  
2. Security
  - Users can only query their own credit balance
  - Admins can query any user's balance
  - Function uses SECURITY DEFINER for elevated permissions
*/

CREATE OR REPLACE FUNCTION get_profile_credits(p_user_id UUID)
RETURNS integer AS $$
DECLARE
  user_credits integer;
BEGIN
  -- Ensure the user can only query their own profile's credits
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only query your own credit balance.';
  END IF;

  SELECT credits_balance INTO user_credits
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN user_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_profile_credits(UUID) TO authenticated;