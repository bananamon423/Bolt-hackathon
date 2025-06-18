/*
  # Fix User Signup Trigger

  1. Database Functions
    - Create or replace the `handle_new_user()` function that automatically creates a profile when a user signs up
    - Extract username from auth metadata and set default values

  2. Triggers
    - Create trigger on `auth.users` table to call `handle_new_user()` on INSERT
    - Ensures every new user gets a corresponding profile entry

  3. Security
    - Maintains existing RLS policies on profiles table
*/

-- Create or replace the function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    email,
    credits_balance,
    role
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.email,
    100,
    'member'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger to automatically create a profile for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();