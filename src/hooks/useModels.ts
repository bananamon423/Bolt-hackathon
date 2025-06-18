import { useState, useEffect } from 'react';
import { supabase, LLMModel } from '../lib/supabase';

export function useModels() {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const { data, error } = await supabase
        .from('llm_models')
        .select('*')
        .eq('is_active', true)
        .order('model_name');

      if (error) throw error;
      setModels(data || []);
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  return { models, loading };
}