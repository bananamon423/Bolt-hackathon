import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Supabase Configuration Check:', {
  url: supabaseUrl ? 'Set' : 'Missing',
  key: supabaseAnonKey ? 'Set' : 'Missing',
  urlValue: supabaseUrl,
  keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : 'None'
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

console.log('✅ Supabase client initialized successfully');

// Extend SupabaseClient with custom RPC types
declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    rpc: {
      (functionName: 'get_profile_credits', args: { p_user_id: string }): Promise<{ data: number; error: any }>;
      (functionName: 'update_last_used_llm', args: { model_identifier: string }): Promise<{ data: any; error: any }>;
      (functionName: 'delete_chat', args: { p_chat_id: string }): Promise<{ data: any; error: any }>;
      (functionName: 'join_chat_by_share_link', args: { p_share_link_uuid: string }): Promise<{ data: any; error: any }>;
      (functionName: 'delete_message', args: { p_message_id: number; p_reason: string }): Promise<{ data: any; error: any }>;
      (functionName: 'test_realtime_connection'): Promise<{ data: any; error: any }>;
    };
  }
}

export type Profile = {
  id: string;
  username: string | null;
  email: string | null;
  profile_picture_url: string | null;
  role: string;
  created_at: string;
  plan: string;
  tokens: number;
  subscription_status: string;
  last_token_reset: string;
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
  // Deletion fields
  deleted_at?: string | null;
  delete_reason?: string | null;
  deleted_by?: string | null;
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

export type SubscriptionPlan = {
  id: string;
  plan_id: string;
  name: string;
  tokens_per_month: number;
  price_monthly: number | null;
  revenuecat_entitlement_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// OpenRouter model configurations
export const OPENROUTER_MODELS = {
  'google/gemini-2.0-flash-exp': {
    name: 'Gemini 2.5 Pro',
    description: 'Google\'s most capable model',
    icon: '🧠',
    color: 'from-blue-500 to-cyan-500'
  },
  'google/gemini-1.5-flash': {
    name: 'Gwiz (Gemini)',
    description: 'Hardcoded Gemini model',
    icon: '🤖',
    color: 'from-purple-500 to-pink-500'
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