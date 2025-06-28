/*
  # Add Gwiz model to llm_models table

  1. New Models
    - `Gwiz` (Google Gemini 1.5 Flash)
      - Uses proper UUID for id field
      - API identifier: google/gemini-1.5-flash
      - Cost: 1 token per request
      - Active by default

  2. Notes
    - Uses gen_random_uuid() to generate a proper UUID for the id field
    - Includes ON CONFLICT handling for safe re-runs
*/

-- Insert the Gwiz model with a proper UUID
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