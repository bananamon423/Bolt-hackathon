/*
  # OpenRouter Integration Migration

  1. New Features
    - Add message_type enum for categorizing messages
    - Add metadata fields for LLM tracking
    - Add OpenRouter configuration
    - Update LLM models for OpenRouter compatibility

  2. Database Changes
    - Extend messages table with new columns
    - Add unique constraints for proper conflict resolution
    - Migrate existing data safely
    - Add performance indexes

  3. Security
    - Maintain existing RLS policies
    - Add utility functions for LLM management
*/

-- Add enum type for message types
DO $$ BEGIN
    CREATE TYPE message_type AS ENUM ('USER_TO_USER', 'USER_TO_LLM', 'LLM_TO_USER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to messages table
DO $$
BEGIN
  -- Add message_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN message_type message_type DEFAULT 'USER_TO_USER';
  END IF;

  -- Add metadata column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE messages ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;

  -- Add llm_model_used column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'llm_model_used'
  ) THEN
    ALTER TABLE messages ADD COLUMN llm_model_used text;
  END IF;

  -- Add input_tokens column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'input_tokens'
  ) THEN
    ALTER TABLE messages ADD COLUMN input_tokens integer DEFAULT 0;
  END IF;

  -- Add output_tokens column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'output_tokens'
  ) THEN
    ALTER TABLE messages ADD COLUMN output_tokens integer DEFAULT 0;
  END IF;

  -- Add cost_in_credits column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'cost_in_credits'
  ) THEN
    ALTER TABLE messages ADD COLUMN cost_in_credits integer DEFAULT 0;
  END IF;

  -- Add parent_prompt_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'parent_prompt_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN parent_prompt_id bigint REFERENCES messages(id);
  END IF;
END $$;

-- Update existing messages to have proper message_type
UPDATE messages 
SET message_type = CASE 
  WHEN sender_type = 'user' THEN 'USER_TO_USER'::message_type
  WHEN sender_type = 'ai' THEN 'LLM_TO_USER'::message_type
  WHEN sender_type = 'system' THEN 'USER_TO_USER'::message_type
  ELSE 'USER_TO_USER'::message_type
END
WHERE message_type IS NULL;

-- Add OpenRouter configuration
INSERT INTO app_config (config_key, config_value, description)
VALUES 
  ('OPENROUTER_API_KEY', '', 'OpenRouter API key for LLM access'),
  ('LAST_USED_LLM', 'google/gemini-2.0-flash-exp', 'Last used LLM model identifier'),
  ('DEFAULT_LLM_COST', '1', 'Default credit cost per LLM request')
ON CONFLICT (config_key) DO NOTHING;

-- Handle existing LLM models safely
-- First, update any messages that reference existing models to use the new llm_model_used field
UPDATE messages 
SET llm_model_used = (
  SELECT api_identifier 
  FROM llm_models 
  WHERE llm_models.id = messages.model_id
)
WHERE model_id IS NOT NULL AND llm_model_used IS NULL;

-- Remove foreign key constraint temporarily to allow model updates
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_model_id_fkey;

-- Set model_id to NULL for all messages (we now use llm_model_used instead)
UPDATE messages SET model_id = NULL;

-- Add unique constraint on api_identifier if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'llm_models_api_identifier_key' 
    AND table_name = 'llm_models'
  ) THEN
    ALTER TABLE llm_models ADD CONSTRAINT llm_models_api_identifier_key UNIQUE (api_identifier);
  END IF;
END $$;

-- Mark existing models as inactive instead of deleting them
UPDATE llm_models SET is_active = false;

-- Insert OpenRouter-compatible models (handle conflicts properly)
DO $$
BEGIN
  -- Gemini 2.5 Pro
  IF EXISTS (SELECT 1 FROM llm_models WHERE api_identifier = 'google/gemini-2.0-flash-exp') THEN
    UPDATE llm_models 
    SET model_name = 'Gemini 2.5 Pro', cost_per_token = 1, is_active = true
    WHERE api_identifier = 'google/gemini-2.0-flash-exp';
  ELSE
    INSERT INTO llm_models (model_name, api_identifier, cost_per_token, is_active) 
    VALUES ('Gemini 2.5 Pro', 'google/gemini-2.0-flash-exp', 1, true);
  END IF;

  -- GPT-4.1
  IF EXISTS (SELECT 1 FROM llm_models WHERE api_identifier = 'openai/gpt-4-turbo') THEN
    UPDATE llm_models 
    SET model_name = 'GPT-4.1', cost_per_token = 2, is_active = true
    WHERE api_identifier = 'openai/gpt-4-turbo';
  ELSE
    INSERT INTO llm_models (model_name, api_identifier, cost_per_token, is_active) 
    VALUES ('GPT-4.1', 'openai/gpt-4-turbo', 2, true);
  END IF;

  -- Claude Sonnet 4
  IF EXISTS (SELECT 1 FROM llm_models WHERE api_identifier = 'anthropic/claude-3.5-sonnet') THEN
    UPDATE llm_models 
    SET model_name = 'Claude Sonnet 4', cost_per_token = 2, is_active = true
    WHERE api_identifier = 'anthropic/claude-3.5-sonnet';
  ELSE
    INSERT INTO llm_models (model_name, api_identifier, cost_per_token, is_active) 
    VALUES ('Claude Sonnet 4', 'anthropic/claude-3.5-sonnet', 2, true);
  END IF;

  -- GPT-4o Mini
  IF EXISTS (SELECT 1 FROM llm_models WHERE api_identifier = 'openai/gpt-4o-mini') THEN
    UPDATE llm_models 
    SET model_name = 'GPT-4o Mini', cost_per_token = 1, is_active = true
    WHERE api_identifier = 'openai/gpt-4o-mini';
  ELSE
    INSERT INTO llm_models (model_name, api_identifier, cost_per_token, is_active) 
    VALUES ('GPT-4o Mini', 'openai/gpt-4o-mini', 1, true);
  END IF;

  -- Llama 3.1 70B
  IF EXISTS (SELECT 1 FROM llm_models WHERE api_identifier = 'meta-llama/llama-3.1-70b-instruct') THEN
    UPDATE llm_models 
    SET model_name = 'Llama 3.1 70B', cost_per_token = 1, is_active = true
    WHERE api_identifier = 'meta-llama/llama-3.1-70b-instruct';
  ELSE
    INSERT INTO llm_models (model_name, api_identifier, cost_per_token, is_active) 
    VALUES ('Llama 3.1 70B', 'meta-llama/llama-3.1-70b-instruct', 1, true);
  END IF;
END $$;

-- Re-add the foreign key constraint (optional, since we're using llm_model_used now)
ALTER TABLE messages ADD CONSTRAINT messages_model_id_fkey 
  FOREIGN KEY (model_id) REFERENCES llm_models(id);

-- Create indexes for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_parent_prompt_id ON messages(parent_prompt_id);
CREATE INDEX IF NOT EXISTS idx_messages_llm_model_used ON messages(llm_model_used);

-- Function to get last used LLM
CREATE OR REPLACE FUNCTION get_last_used_llm()
RETURNS text AS $$
DECLARE
  last_llm text;
BEGIN
  SELECT config_value INTO last_llm
  FROM app_config
  WHERE config_key = 'LAST_USED_LLM';
  
  RETURN COALESCE(last_llm, 'google/gemini-2.0-flash-exp');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update last used LLM
CREATE OR REPLACE FUNCTION update_last_used_llm(model_identifier text)
RETURNS void AS $$
BEGIN
  UPDATE app_config
  SET config_value = model_identifier,
      updated_at = now()
  WHERE config_key = 'LAST_USED_LLM';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get model cost by identifier
CREATE OR REPLACE FUNCTION get_model_cost(model_identifier text)
RETURNS integer AS $$
DECLARE
  model_cost integer;
BEGIN
  SELECT cost_per_token INTO model_cost
  FROM llm_models
  WHERE api_identifier = model_identifier AND is_active = true;
  
  RETURN COALESCE(model_cost, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;