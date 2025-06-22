/*
  # Add Last Used LLM Tracking Function

  1. New Features
    - Function to update last used LLM model
    - Automatic config table management
    - Proper error handling

  2. Security
    - Only authenticated users can update
    - Validates model identifiers
*/

-- Function to update the last used LLM model
CREATE OR REPLACE FUNCTION public.update_last_used_llm(model_identifier text)
RETURNS void AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate model identifier is not empty
  IF model_identifier IS NULL OR trim(model_identifier) = '' THEN
    RAISE EXCEPTION 'Model identifier cannot be empty';
  END IF;

  -- Insert or update the last used LLM configuration
  INSERT INTO app_config (id, config_key, config_value, description, updated_at)
  VALUES (
    1, 
    'LAST_USED_LLM', 
    model_identifier, 
    'The last LLM model used in the application',
    now()
  )
  ON CONFLICT (config_key) 
  DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = now();

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the main operation
    RAISE WARNING 'Failed to update last used LLM: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_last_used_llm(text) TO authenticated;