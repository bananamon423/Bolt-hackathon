/*
  # Unified AI Workspace Database Schema

  1. New Tables
    - `profiles` - User profiles linked to Supabase Auth
    - `app_config` - Application-wide configuration settings
    - `token_packages` - Credit packages for purchase
    - `credit_transactions` - Credit usage audit log
    - `llm_models` - Available AI models
    - `folders` - Organizational folders for chats
    - `chats` - Individual conversation threads
    - `chat_members` - User membership in chats
    - `messages` - All chat messages
    - `error_logs` - Application error logging

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for user access control
    - Admin-only access for configuration tables

  3. Initial Data
    - Default configuration values
    - Sample LLM models
    - Admin user setup
*/

-- This table stores public profile information linked to each Supabase Auth user.
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id),
    username text,
    email text,
    profile_picture_url text,
    credits_balance integer DEFAULT 100,
    role text DEFAULT 'member',
    created_at timestamp with time zone DEFAULT now()
);

-- This table stores application-wide configuration settings that can be changed by admins.
CREATE TABLE IF NOT EXISTS app_config (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    config_key text UNIQUE NOT NULL,
    config_value text,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);

-- This table defines the one-time credit packages users can buy.
CREATE TABLE IF NOT EXISTS token_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    credits_granted integer,
    price numeric,
    stripe_product_id text,
    is_active boolean DEFAULT true
);

-- This table logs all credit transactions for auditing.
CREATE TABLE IF NOT EXISTS credit_transactions (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id uuid REFERENCES profiles(id),
    amount integer,
    description text,
    package_id uuid REFERENCES token_packages(id),
    chat_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- This table stores info about available AI models.
CREATE TABLE IF NOT EXISTS llm_models (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name text,
    api_identifier text,
    cost_per_token numeric DEFAULT 1,
    is_active boolean DEFAULT true
);

-- This table stores organizational folders.
CREATE TABLE IF NOT EXISTS folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid REFERENCES profiles(id),
    name text,
    created_at timestamp with time zone DEFAULT now()
);

-- This table represents a single conversation thread.
CREATE TABLE IF NOT EXISTS chats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid REFERENCES profiles(id),
    folder_id uuid REFERENCES folders(id),
    chat_title text DEFAULT 'New Chat',
    active_model_id uuid REFERENCES llm_models(id),
    share_link uuid DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add the pending foreign key constraint now that the chats table exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_chat_id' AND table_name = 'credit_transactions'
  ) THEN
    ALTER TABLE credit_transactions ADD CONSTRAINT fk_chat_id FOREIGN KEY (chat_id) REFERENCES chats(id);
  END IF;
END $$;

-- This table manages user roles in each chat.
CREATE TABLE IF NOT EXISTS chat_members (
    chat_id uuid REFERENCES chats(id),
    user_id uuid REFERENCES profiles(id),
    role text DEFAULT 'member',
    joined_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (chat_id, user_id)
);

-- This table stores every message in every chat.
CREATE TABLE IF NOT EXISTS messages (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    chat_id uuid REFERENCES chats(id),
    sender_id uuid REFERENCES profiles(id),
    sender_type text DEFAULT 'user',
    content text,
    model_id uuid REFERENCES llm_models(id),
    token_cost integer,
    created_at timestamp with time zone DEFAULT now()
);

-- This table logs detailed application errors for permanent storage and analysis.
CREATE TABLE IF NOT EXISTS error_logs (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id uuid REFERENCES profiles(id),
    chat_id uuid REFERENCES chats(id),
    error_source text,
    error_details jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can read other profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- App config policies (admin only)
CREATE POLICY "Admins can read config"
  ON app_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update config"
  ON app_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Token packages policies
CREATE POLICY "Users can read active packages"
  ON token_packages FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Credit transactions policies
CREATE POLICY "Users can read own transactions"
  ON credit_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert transactions"
  ON credit_transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- LLM models policies
CREATE POLICY "Users can read active models"
  ON llm_models FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Folders policies
CREATE POLICY "Users can manage own folders"
  ON folders FOR ALL
  TO authenticated
  USING (owner_id = auth.uid());

-- Chats policies
CREATE POLICY "Users can read chats they're members of"
  ON chats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update chats they own"
  ON chats FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create chats"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Chat members policies
CREATE POLICY "Users can read chat members for their chats"
  ON chat_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members cm2 
      WHERE cm2.chat_id = chat_members.chat_id AND cm2.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage members of their chats"
  ON chat_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = chat_members.chat_id AND chats.owner_id = auth.uid()
    )
  );

-- Messages policies
CREATE POLICY "Users can read messages from their chats"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their chats"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()
    )
  );

-- Error logs policies
CREATE POLICY "Users can read own error logs"
  ON error_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert error logs"
  ON error_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Seed initial data
INSERT INTO app_config (config_key, config_value, description)
VALUES ('CONTEXT_MESSAGE_LIMIT', '10', 'The number of recent messages to send to the AI for context.')
ON CONFLICT (config_key) DO NOTHING;

-- Insert sample LLM models
INSERT INTO llm_models (model_name, api_identifier, cost_per_token, is_active)
VALUES 
  ('Gemini Pro', 'gemini-pro', 1, true),
  ('Gemini Pro Vision', 'gemini-pro-vision', 1, true)
ON CONFLICT DO NOTHING;

-- Insert sample token packages
INSERT INTO token_packages (name, credits_granted, price, is_active)
VALUES 
  ('Starter Pack', 100, 9.99, true),
  ('Power User', 500, 39.99, true),
  ('Enterprise', 2000, 149.99, true)
ON CONFLICT DO NOTHING;

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, username, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update chat updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS trigger AS $$
BEGIN
  UPDATE chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for message insert to update chat timestamp
DROP TRIGGER IF EXISTS on_message_insert ON messages;
CREATE TRIGGER on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_timestamp();