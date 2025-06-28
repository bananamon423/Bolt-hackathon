import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔐 useAuth: Initializing authentication...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ useAuth: Error getting session:', error);
        setLoading(false);
        return;
      }

      console.log('🔐 useAuth: Initial session:', session ? 'Found' : 'None');
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 useAuth: Auth state changed:', event, session ? 'Session exists' : 'No session');
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      console.log('🔐 useAuth: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('👤 useAuth: Fetching profile for user:', userId);
      
      // Add timeout and better error handling for network issues
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .abortSignal(controller.signal)
        .single();

      clearTimeout(timeoutId);

      if (error) {
        console.error('❌ useAuth: Error fetching profile:', error);
        
        // Check if it's a network error
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          console.warn('⚠️ useAuth: Network connectivity issue detected. Profile will be set to null.');
          setProfile(null);
          setLoading(false);
          return;
        }
        
        throw error;
      }

      console.log('✅ useAuth: Profile fetched successfully:', data?.username || 'No username');
      setProfile(data);
    } catch (error: any) {
      console.error('❌ useAuth: Profile fetch failed:', error);
      
      // Handle AbortError (timeout)
      if (error.name === 'AbortError') {
        console.warn('⚠️ useAuth: Profile fetch timed out. Setting profile to null.');
      }
      
      // Don't throw here, just set profile to null and continue
      setProfile(null);
    } finally {
      console.log('🔐 useAuth: Setting loading to false');
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 useAuth: Attempting sign in for:', email);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('❌ useAuth: Sign in error:', error);
    } else {
      console.log('✅ useAuth: Sign in successful');
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, username: string) => {
    console.log('🔐 useAuth: Attempting sign up for:', email);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });
    
    if (error) {
      console.error('❌ useAuth: Sign up error:', error);
    } else {
      console.log('✅ useAuth: Sign up successful');
    }
    
    return { error };
  };

  const signOut = async () => {
    console.log('🔐 useAuth: Signing out...');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('❌ useAuth: Sign out error:', error);
    } else {
      console.log('✅ useAuth: Sign out successful');
    }
    
    return { error };
  };

  return {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile: () => user && fetchProfile(user.id),
  };
}