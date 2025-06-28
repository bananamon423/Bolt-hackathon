/*
# Add Gwiz Model to Database

1. New Model Entry
   - `gwiz-hardcoded` model entry in llm_models table
   - Maps to Google Gemini 1.5 Flash API
   - Cost of 1 token per request
   - Active by default

2. Purpose
   - Resolves "Invalid model ID provided" error in ask-llm-with-tokens function
   - Ensures frontend hardcoded Gwiz model has corresponding database entry
*/

-- Insert the Gwiz model that's hardcoded in the frontend
INSERT INTO llm_models (
  id,
  model_name,
  api_identifier,
  cost_per_token,
  is_active
) VALUES (
  'gwiz-hardcoded',
  'Gwiz',
  'google/gemini-1.5-flash',
  1,
  true
) ON CONFLICT (id) DO UPDATE SET
  model_name = EXCLUDED.model_name,
  api_identifier = EXCLUDED.api_identifier,
  cost_per_token = EXCLUDED.cost_per_token,
  is_active = EXCLUDED.is_active;