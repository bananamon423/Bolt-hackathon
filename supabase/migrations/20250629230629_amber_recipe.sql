/*
  # Add RevenueCat product_id to subscription plans

  1. Schema Updates
    - Add revenuecat_product_id column to subscription_plans table
    - Update existing plans with product IDs

  2. Data Updates
    - Set product IDs for existing plans to match RevenueCat configuration
*/

-- Add RevenueCat product ID column to subscription plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'revenuecat_product_id'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN revenuecat_product_id text;
  END IF;
END $$;

-- Update existing plans with RevenueCat product IDs
UPDATE subscription_plans 
SET revenuecat_product_id = plan_id 
WHERE revenuecat_product_id IS NULL;

-- Insert the Gwiz model that's hardcoded in the frontend
-- Use api_identifier as the unique constraint since that's what the frontend logic relies on
INSERT INTO llm_models (
  id,
  model_name,
  api_identifier,
  cost_per_token,
  is_active
) VALUES (
  gen_random_uuid(),
  'Gwiz',
  'google/gemini-1.5-flash',
  1,
  true
) ON CONFLICT (api_identifier) DO UPDATE SET
  model_name = EXCLUDED.model_name,
  cost_per_token = EXCLUDED.cost_per_token,
  is_active = EXCLUDED.is_active;