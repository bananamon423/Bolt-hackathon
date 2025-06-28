/*
# Token-Based System Functions

Creates database functions for token management:
1. consume_tokens - Deducts tokens and logs usage
2. reset_monthly_tokens - Resets user tokens based on plan
3. get_user_tokens - Gets current token balance and limits
4. update_user_subscription - Updates subscription and resets tokens

## Security
- All functions use SECURITY DEFINER for proper permissions
- Functions are granted to authenticated users only
*/

-- Drop existing functions if they exist to avoid parameter conflicts
DROP FUNCTION IF EXISTS update_user_subscription(text,text[],text,timestamp with time zone,timestamp with time zone,boolean);
DROP FUNCTION IF EXISTS consume_tokens(uuid,integer,uuid,text);
DROP FUNCTION IF EXISTS reset_monthly_tokens(uuid);
DROP FUNCTION IF EXISTS get_user_tokens(uuid);

-- Function to consume tokens from a user's profile
CREATE OR REPLACE FUNCTION consume_tokens(
  p_user_id UUID,
  p_tokens_to_consume INTEGER,
  p_chat_id UUID DEFAULT NULL,
  p_model_used TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_tokens INTEGER;
  result JSON;
BEGIN
  -- Get current token balance
  SELECT tokens INTO current_tokens
  FROM profiles
  WHERE id = p_user_id;

  -- Check if user exists
  IF current_tokens IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found',
      'tokens_remaining', 0
    );
  END IF;

  -- Check if user has enough tokens
  IF current_tokens < p_tokens_to_consume THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient tokens',
      'tokens_remaining', current_tokens
    );
  END IF;

  -- Deduct tokens
  UPDATE profiles
  SET tokens = tokens - p_tokens_to_consume
  WHERE id = p_user_id;

  -- Get updated token balance
  SELECT tokens INTO current_tokens
  FROM profiles
  WHERE id = p_user_id;

  -- Log the token usage
  INSERT INTO token_usage_logs (
    user_id,
    chat_id,
    tokens_used,
    model_used,
    usage_type,
    created_at
  ) VALUES (
    p_user_id,
    p_chat_id,
    p_tokens_to_consume,
    p_model_used,
    'llm_request',
    NOW()
  );

  -- Return success result
  RETURN json_build_object(
    'success', true,
    'tokens_consumed', p_tokens_to_consume,
    'tokens_remaining', current_tokens
  );
END;
$$;

-- Function to reset monthly tokens based on subscription plan
CREATE OR REPLACE FUNCTION reset_monthly_tokens(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_plan TEXT;
  plan_tokens INTEGER;
  result JSON;
BEGIN
  -- Get user's current plan
  SELECT plan INTO user_plan
  FROM profiles
  WHERE id = p_user_id;

  -- Get tokens per month for the plan
  SELECT tokens_per_month INTO plan_tokens
  FROM subscription_plans
  WHERE plan_id = user_plan AND is_active = true;

  -- If plan not found, default to free plan
  IF plan_tokens IS NULL THEN
    SELECT tokens_per_month INTO plan_tokens
    FROM subscription_plans
    WHERE plan_id = 'free_plan' AND is_active = true;
    
    -- If still null, default to 10
    IF plan_tokens IS NULL THEN
      plan_tokens := 10;
    END IF;
  END IF;

  -- Reset user's tokens
  UPDATE profiles
  SET 
    tokens = plan_tokens,
    last_token_reset = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'tokens_reset_to', plan_tokens,
    'plan', user_plan
  );
END;
$$;

-- Function to get user's current token balance
CREATE OR REPLACE FUNCTION get_user_tokens(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_tokens INTEGER;
  user_plan TEXT;
  max_tokens INTEGER;
BEGIN
  -- Get user's current tokens and plan
  SELECT tokens, plan INTO current_tokens, user_plan
  FROM profiles
  WHERE id = p_user_id;

  -- Get max tokens for the plan
  SELECT tokens_per_month INTO max_tokens
  FROM subscription_plans
  WHERE plan_id = user_plan AND is_active = true;

  -- If plan not found, default to free plan
  IF max_tokens IS NULL THEN
    SELECT tokens_per_month INTO max_tokens
    FROM subscription_plans
    WHERE plan_id = 'free_plan' AND is_active = true;
    
    -- If still null, default to 10
    IF max_tokens IS NULL THEN
      max_tokens := 10;
    END IF;
  END IF;

  RETURN json_build_object(
    'tokens', COALESCE(current_tokens, 0),
    'max_tokens', max_tokens,
    'plan', user_plan
  );
END;
$$;

-- Function to update user subscription and reset tokens
CREATE OR REPLACE FUNCTION update_user_subscription(
  p_revenuecat_user_id TEXT,
  p_entitlement_ids TEXT[],
  p_subscription_status TEXT,
  p_original_purchase_date TIMESTAMPTZ DEFAULT NULL,
  p_expiration_date TIMESTAMPTZ DEFAULT NULL,
  p_is_sandbox BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  new_plan_id TEXT := 'free_plan';
  plan_tokens INTEGER;
  result JSON;
BEGIN
  -- Find user by revenuecat_user_id
  SELECT id INTO target_user_id
  FROM profiles
  WHERE revenuecat_user_id = p_revenuecat_user_id;

  -- If user not found, return error
  IF target_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found with RevenueCat ID: ' || p_revenuecat_user_id
    );
  END IF;

  -- Determine plan based on entitlements
  IF array_length(p_entitlement_ids, 1) > 0 THEN
    -- Find matching plan by entitlement
    SELECT plan_id INTO new_plan_id
    FROM subscription_plans
    WHERE revenuecat_entitlement_id = ANY(p_entitlement_ids)
      AND is_active = true
    LIMIT 1;
    
    -- If no matching plan found, default to beginner_plan for active subscriptions
    IF new_plan_id IS NULL AND p_subscription_status = 'active' THEN
      new_plan_id := 'beginner_plan';
    END IF;
  END IF;

  -- Get tokens for the new plan
  SELECT tokens_per_month INTO plan_tokens
  FROM subscription_plans
  WHERE plan_id = new_plan_id AND is_active = true;

  -- Default to 10 tokens if plan not found
  IF plan_tokens IS NULL THEN
    plan_tokens := 10;
  END IF;

  -- Update or insert user subscription
  INSERT INTO user_subscriptions (
    user_id,
    revenuecat_user_id,
    plan_id,
    subscription_status,
    entitlement_ids,
    original_purchase_date,
    expiration_date,
    is_sandbox,
    created_at,
    updated_at
  ) VALUES (
    target_user_id,
    p_revenuecat_user_id,
    new_plan_id,
    p_subscription_status,
    p_entitlement_ids,
    p_original_purchase_date,
    p_expiration_date,
    p_is_sandbox,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    subscription_status = EXCLUDED.subscription_status,
    entitlement_ids = EXCLUDED.entitlement_ids,
    original_purchase_date = EXCLUDED.original_purchase_date,
    expiration_date = EXCLUDED.expiration_date,
    is_sandbox = EXCLUDED.is_sandbox,
    updated_at = NOW();

  -- Update user profile with new plan and reset tokens
  UPDATE profiles
  SET 
    plan = new_plan_id,
    subscription_status = p_subscription_status,
    tokens = plan_tokens,
    last_token_reset = NOW()
  WHERE id = target_user_id;

  RETURN json_build_object(
    'success', true,
    'user_id', target_user_id,
    'new_plan', new_plan_id,
    'tokens_reset_to', plan_tokens,
    'subscription_status', p_subscription_status
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION consume_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION reset_monthly_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_subscription TO authenticated;