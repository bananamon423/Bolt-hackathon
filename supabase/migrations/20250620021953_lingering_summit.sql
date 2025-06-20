/*
  # OpenRouter Multi-LLM Integration Schema Updates

  1. Database Schema Extensions
    - Update messages table with new fields for LLM metadata
    - Add new llm_models entries for OpenRouter models
    - Update app_config for OpenRouter settings

  2. New Fields
    - messageType: Enum for message classification
    - metadata: JSONB for LLM-specific data
    - llmModelUsed: Reference to model used
    - inputTokens/outputTokens: Token usage tracking
    - costInCredits: Credit cost tracking
    - parentPromptId: Link AI responses to user prompts

  3. New Models
    - Add Gemini 2.5 Pro, GPT-4.1, Claude Sonnet 4 via OpenRouter
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
  -- Add messageType column
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

  -- Add llmModelUsed column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'llm_model_used'
  ) THEN
    ALTER TABLE messages ADD COLUMN llm_model_used text;
  END IF;

  -- Add inputTokens column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'input_tokens'
  ) THEN
    ALTER TABLE messages ADD COLUMN input_tokens integer DEFAULT 0;
  END IF;

  -- Add outputTokens column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'output_tokens'
  ) THEN
    ALTER TABLE messages ADD COLUMN output_tokens integer DEFAULT 0;
  END IF;

  -- Add costInCredits column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'cost_in_credits'
  ) THEN
    ALTER TABLE messages ADD COLUMN cost_in_credits integer DEFAULT 0;
  END IF;

  -- Add parentPromptId column
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
  ('LAST_USED_LLM', 'gemini-2.5-pro', 'Last used LLM model identifier'),
  ('DEFAULT_LLM_COST', '1', 'Default credit cost per LLM request')
ON CONFLICT (config_key) DO NOTHING;

-- Clear existing LLM models and add OpenRouter models
DELETE FROM llm_models;

-- Insert OpenRouter-compatible models
INSERT INTO llm_models (model_name, api_identifier, cost_per_token, is_active) VALUES
  ('Gemini 2.5 Pro', 'google/gemini-2.0-flash-exp', 1, true),
  ('GPT-4.1', 'openai/gpt-4-turbo', 2, true),
  ('Claude Sonnet 4', 'anthropic/claude-3.5-sonnet', 2, true),
  ('GPT-4o Mini', 'openai/gpt-4o-mini', 1, true),
  ('Llama 3.1 70B', 'meta-llama/llama-3.1-70b-instruct', 1, true)
ON CONFLICT DO NOTHING;

-- Create index for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_parent_prompt_id ON messages(parent_prompt_id);
CREATE INDEX IF NOT EXISTS idx_messages_llm_model_used ON messages(llm_model_used);

-- Update RLS policies to handle new message types
-- (Existing policies should still work, but we can add specific ones if needed)

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