import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, Clock } from 'lucide-react';
import { OPENROUTER_MODELS, OpenRouterModelId } from '../lib/supabase';
import { supabase } from '../lib/supabase';

interface LastUsedLLMIndicatorProps {
  className?: string;
}

export function LastUsedLLMIndicator({ className = '' }: LastUsedLLMIndicatorProps) {
  const [lastUsedModel, setLastUsedModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLastUsedModel();
    
    // Subscribe to config changes
    const subscription = supabase
      .channel('last_used_llm')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'app_config',
          filter: 'config_key=eq.LAST_USED_LLM'
        },
        (payload) => {
          setLastUsedModel(payload.new.config_value);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchLastUsedModel = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'LAST_USED_LLM');

      if (error) throw error;
      
      // Handle the case where no configuration exists
      if (!data || data.length === 0) {
        setLastUsedModel(null);
      } else {
        setLastUsedModel(data[0].config_value);
      }
    } catch (error) {
      console.error('Error fetching last used model:', error);
      setLastUsedModel(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg ${className}`}>
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  if (!lastUsedModel) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg ${className}`}>
        <Bot className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">No AI used yet</span>
      </div>
    );
  }

  // Special handling for Gwiz (hardcoded model)
  if (lastUsedModel === 'google/gemini-1.5-flash') {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg shadow-sm ${className}`}>
        <div className="flex items-center gap-1">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">🤖</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Gwiz</span>
          <div className="flex items-center gap-1 text-xs opacity-90">
            <Clock className="w-3 h-3" />
            <span>Last used</span>
          </div>
        </div>
      </div>
    );
  }

  // Handle OpenRouter models
  const modelConfig = OPENROUTER_MODELS[lastUsedModel as OpenRouterModelId];
  
  if (!modelConfig) {
    // Fallback for unknown models
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg ${className}`}>
        <Bot className="w-4 h-4 text-gray-500" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-700">Unknown Model</span>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>Last used</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r ${modelConfig.color} text-white rounded-lg shadow-sm ${className}`}>
      <div className="flex items-center gap-1">
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">{modelConfig.icon}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{modelConfig.name}</span>
        <div className="flex items-center gap-1 text-xs opacity-90">
          <Clock className="w-3 h-3" />
          <span>Last used</span>
        </div>
      </div>
    </div>
  );
}