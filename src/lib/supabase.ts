import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string | null;
  email: string | null;
  profile_picture_url: string | null;
  credits_balance: number;
  role: string;
  created_at: string;
};

export type Chat = {
  id: string;
  owner_id: string;
  folder_id: string | null;
  chat_title: string;
  active_model_id: string | null;
  share_link: string;
  created_at: string;
  updated_at: string;
};

export type MessageType = 'USER_TO_USER' | 'USER_TO_LLM' | 'LLM_TO_USER';

export type Message = {
  id: number;
  chat_id: string;
  sender_id: string | null;
  sender_type: 'user' | 'ai' | 'system';
  content: string;
  model_id: string | null;
  token_cost: number | null;
  created_at: string;
  profiles?: Profile;
  // New OpenRouter fields
  message_type?: MessageType;
  metadata?: Record<string, any>;
  llm_model_used?: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_in_credits?: number;
  parent_prompt_id?: number;
};

export type LLMModel = {
  id: string;
  model_name: string;
  api_identifier: string;
  cost_per_token: number;
  is_active: boolean;
};

export type ChatMember = {
  chat_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

// OpenRouter model configurations
export const OPENROUTER_MODELS = {
  'google/gemini-2.0-flash-exp': {
    name: 'Gemini 2.5 Pro',
    description: 'Google\'s most capable model',
    icon: '🧠',
    color: 'from-blue-500 to-cyan-500'
  },
  'openai/gpt-4-turbo': {
    name: 'GPT-4.1',
    description: 'OpenAI\'s most advanced model',
    icon: '🤖',
    color: 'from-green-500 to-emerald-500'
  },
  'anthropic/claude-3.5-sonnet': {
    name: 'Claude Sonnet 4',
    description: 'Anthropic\'s reasoning specialist',
    icon: '🎭',
    color: 'from-purple-500 to-pink-500'
  },
  'openai/gpt-4o-mini': {
    name: 'GPT-4o Mini',
    description: 'Fast and efficient OpenAI model',
    icon: '⚡',
    color: 'from-orange-500 to-red-500'
  },
  'meta-llama/llama-3.1-70b-instruct': {
    name: 'Llama 3.1 70B',
    description: 'Meta\'s open-source powerhouse',
    icon: '🦙',
    color: 'from-indigo-500 to-purple-500'
  }
} as const;

export type OpenRouterModelId = keyof typeof OPENROUTER_MODELS;