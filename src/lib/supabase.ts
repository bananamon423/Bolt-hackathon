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