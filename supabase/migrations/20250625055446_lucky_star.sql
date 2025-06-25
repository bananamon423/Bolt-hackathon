/*
  # Add Gwiz model to database

  1. New Models
    - `Gwiz` model entry in llm_models table
      - Uses proper UUID for id field
      - Maps to google/gemini-1.5-flash API identifier
      - Set to 1 credit cost per token
      - Active by default

  2. Changes
    - Ensures the hardcoded Gwiz model from frontend has corresponding database entry
    - Uses api_identifier as unique constraint to prevent duplicates
*/

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