/*
# RevenueCat Integration Schema

1. New Tables
   - `subscription_plans` - Stores plan configurations
   - `user_subscriptions` - Tracks user subscription status
   - `token_usage_logs` - Logs token consumption

2. Schema Updates
   - Add RevenueCat fields to profiles table
   - Add token tracking fields

3. Security
   - Enable RLS on all new tables
   - Add appropriate policies for data access
*/

-- Add RevenueCat fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'revenuecat_user_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN revenuecat_user_id text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'plan'
  ) THEN
    ALTER TABLE profiles ADD COLUMN plan text DEFAULT 'free_plan';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'tokens'
  ) THEN
    ALTER TABLE profiles ADD COLUMN tokens integer DEFAULT 10;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_token_reset'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_token_reset timestamptz DEFAULT now();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_status text DEFAULT 'free';
  END IF;
END $$;

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text UNIQUE NOT NULL,
  name text NOT NULL,
  tokens_per_month integer NOT NULL,
  price_monthly numeric(10,2),
  revenuecat_entitlement_id text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default plans
INSERT INTO subscription_plans (plan_id, name, tokens_per_month, price_monthly, revenuecat_entitlement_id) 
VALUES 
  ('free_plan', 'Free Plan', 10, 0.00, 'free_plan'),
  ('beginner_plan', 'Beginner Plan', 100, 9.99, 'beginner_plan'),
  ('pro_plan', 'Pro Plan', 1000, 29.99, 'pro_plan')
ON CONFLICT (plan_id) DO NOTHING;

-- Create user subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  revenuecat_user_id text NOT NULL,
  plan_id text REFERENCES subscription_plans(plan_id),
  subscription_status text NOT NULL DEFAULT 'active',
  entitlement_ids text[],
  original_purchase_date timestamptz,
  expiration_date timestamptz,
  is_sandbox boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create token usage logs table
CREATE TABLE IF NOT EXISTS token_usage_logs (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE,
  message_id bigint REFERENCES messages(id) ON DELETE CASCADE,
  tokens_used integer NOT NULL DEFAULT 1,
  model_used text,
  usage_type text DEFAULT 'llm_request',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
CREATE POLICY "Anyone can read active plans"
  ON subscription_plans
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can read own subscription"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can manage subscriptions"
  ON user_subscriptions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for token_usage_logs
CREATE POLICY "Users can read own usage logs"
  ON token_usage_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert usage logs"
  ON token_usage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to reset monthly tokens
CREATE OR REPLACE FUNCTION reset_monthly_tokens()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  plan_record RECORD;
BEGIN
  -- Reset tokens for users whose reset date has passed
  FOR user_record IN 
    SELECT p.id, p.plan, p.last_token_reset
    FROM profiles p
    WHERE p.last_token_reset + INTERVAL '1 month' <= now()
  LOOP
    -- Get the plan details
    SELECT tokens_per_month INTO plan_record
    FROM subscription_plans
    WHERE plan_id = user_record.plan;
    
    IF FOUND THEN
      -- Reset tokens and update reset date
      UPDATE profiles
      SET 
        tokens = plan_record.tokens_per_month,
        last_token_reset = now()
      WHERE id = user_record.id;
      
      RAISE NOTICE 'Reset tokens for user % to %', user_record.id, plan_record.tokens_per_month;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to consume tokens
CREATE OR REPLACE FUNCTION consume_tokens(
  p_user_id uuid,
  p_tokens_to_consume integer DEFAULT 1,
  p_chat_id uuid DEFAULT NULL,
  p_message_id bigint DEFAULT NULL,
  p_model_used text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  current_tokens integer;
  result json;
BEGIN
  -- Get current token count
  SELECT tokens INTO current_tokens
  FROM profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
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
  
  -- Consume tokens
  UPDATE profiles
  SET tokens = tokens - p_tokens_to_consume
  WHERE id = p_user_id;
  
  -- Log usage
  INSERT INTO token_usage_logs (
    user_id,
    chat_id,
    message_id,
    tokens_used,
    model_used
  ) VALUES (
    p_user_id,
    p_chat_id,
    p_message_id,
    p_tokens_to_consume,
    p_model_used
  );
  
  RETURN json_build_object(
    'success', true,
    'tokens_consumed', p_tokens_to_consume,
    'tokens_remaining', current_tokens - p_tokens_to_consume
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user subscription from RevenueCat
CREATE OR REPLACE FUNCTION update_user_subscription(
  p_revenuecat_user_id text,
  p_entitlement_ids text[],
  p_subscription_status text DEFAULT 'active',
  p_original_purchase_date timestamptz DEFAULT NULL,
  p_expiration_date timestamptz DEFAULT NULL,
  p_is_sandbox boolean DEFAULT false
)
RETURNS json AS $$
DECLARE
  target_user_id uuid;
  plan_to_assign text;
  plan_tokens integer;
  result json;
BEGIN
  -- Find user by RevenueCat user ID
  SELECT id INTO target_user_id
  FROM profiles
  WHERE revenuecat_user_id = p_revenuecat_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found with RevenueCat ID: ' || p_revenuecat_user_id
    );
  END IF;
  
  -- Determine plan based on entitlements
  IF 'pro_plan' = ANY(p_entitlement_ids) THEN
    plan_to_assign := 'pro_plan';
  ELSIF 'beginner_plan' = ANY(p_entitlement_ids) THEN
    plan_to_assign := 'beginner_plan';
  ELSE
    plan_to_assign := 'free_plan';
  END IF;
  
  -- Get plan token allocation
  SELECT tokens_per_month INTO plan_tokens
  FROM subscription_plans
  WHERE plan_id = plan_to_assign;
  
  -- Update user profile
  UPDATE profiles
  SET 
    plan = plan_to_assign,
    tokens = GREATEST(tokens, plan_tokens), -- Don't reduce tokens if they have more
    subscription_status = p_subscription_status,
    last_token_reset = CASE 
      WHEN plan != plan_to_assign THEN now() -- Reset if plan changed
      ELSE last_token_reset
    END
  WHERE id = target_user_id;
  
  -- Upsert user subscription record
  INSERT INTO user_subscriptions (
    user_id,
    revenuecat_user_id,
    plan_id,
    subscription_status,
    entitlement_ids,
    original_purchase_date,
    expiration_date,
    is_sandbox,
    updated_at
  ) VALUES (
    target_user_id,
    p_revenuecat_user_id,
    plan_to_assign,
    p_subscription_status,
    p_entitlement_ids,
    p_original_purchase_date,
    p_expiration_date,
    p_is_sandbox,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    subscription_status = EXCLUDED.subscription_status,
    entitlement_ids = EXCLUDED.entitlement_ids,
    original_purchase_date = EXCLUDED.original_purchase_date,
    expiration_date = EXCLUDED.expiration_date,
    is_sandbox = EXCLUDED.is_sandbox,
    updated_at = now();
  
  RETURN json_build_object(
    'success', true,
    'user_id', target_user_id,
    'plan_assigned', plan_to_assign,
    'tokens_allocated', plan_tokens
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION reset_monthly_tokens() TO authenticated;
GRANT EXECUTE ON FUNCTION consume_tokens(uuid, integer, uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_subscription(text, text[], text, timestamptz, timestamptz, boolean) TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_revenuecat_user_id ON user_subscriptions(revenuecat_user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_user_id ON token_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_created_at ON token_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_revenuecat_user_id ON profiles(revenuecat_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);

-- Update existing users to have RevenueCat user IDs (use their Supabase user ID)
UPDATE profiles 
SET revenuecat_user_id = id::text 
WHERE revenuecat_user_id IS NULL;