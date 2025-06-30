import React, { useState } from 'react';
import { LogIn, UserPlus, MessageSquare } from 'lucide-react';

interface AuthFormProps {
  onSignIn: (email: string, password: string) => Promise<{ error: any }>;
  onSignUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
}

export function AuthForm({ onSignIn, onSignUp }: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = isSignUp 
        ? await onSignUp(email, password, username)
        : await onSignIn(email, password);

      if (result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 font-patrick"
      style={{
        backgroundImage: 'url(/CorkBoard.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="max-w-lg w-full">
        {/* Torn Paper Container - Dynamic height based on form type */}
        <div 
          className="relative transition-all duration-500 ease-in-out"
          style={{
            backgroundImage: 'url(/TornPaper.png)',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'drop-shadow(0 15px 35px rgba(0,0,0,0.4))',
            transform: isSignUp 
            ? 'rotate(-1deg) translate(0px, 100px)'  // transform for sign-up
            : 'rotate(-1deg) translate(0px, 2px)',   // transform for other case
            aspectRatio: isSignUp ? '3/5' : '3/4.2', // Taller for sign-up
            minHeight: isSignUp ? '850px' : '750px', // More height for sign-up
            width: '100%'
          }}
        >
          {/* Content overlay with dynamic padding */}
          <div 
            className="absolute inset-0 transition-all duration-500 ease-in-out"
            style={{
              padding: isSignUp ? '48px 48px 64px 48px' : '48px 48px 64px 48px', // Consistent padding
              paddingTop: isSignUp ? '80px' : '80px', // Consistent top padding
              margin: isSignUp ? '4% 6% 8% 6%' : '4% 6% 6% 6%' // More bottom margin for sign-up
            }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="bg-gradient-to-br from-blue-500 to-teal-500 p-3 rounded-2xl transform rotate-3 shadow-lg">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2 transform -rotate-1">
                Unified AI Workspace
              </h2>
              <p className="text-gray-600 text-lg">
                {isSignUp ? 'Create your account' : 'Sign in to your account'}
              </p>
            </div>

            {/* Form with consistent spacing */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {isSignUp && (
                <div className="transform rotate-1">
                  <label htmlFor="username" className="block text-sm font-bold text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-lg font-patrick transform -rotate-1 hover:rotate-0 focus:rotate-0"
                    placeholder="Enter your username"
                    style={{
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.8)'
                    }}
                  />
                </div>
              )}

              <div className="transform -rotate-1">
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-lg font-patrick transform rotate-1 hover:rotate-0 focus:rotate-0"
                  placeholder="Enter your email"
                  style={{
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.8)'
                  }}
                />
              </div>

              <div className="transform rotate-1">
                <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-lg font-patrick transform -rotate-1 hover:rotate-0 focus:rotate-0"
                  placeholder="Enter your password"
                  style={{
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.8)'
                  }}
                />
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 transform rotate-1">
                  <p className="text-red-600 text-sm font-bold">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-teal-500 text-white py-3 px-4 rounded-lg font-bold text-lg hover:from-blue-600 hover:to-teal-600 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 transform -rotate-1 hover:rotate-0 shadow-lg"
                style={{
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                    {isSignUp ? 'Create Account' : 'Sign In'}
                  </>
                )}
              </button>
            </form>

            {/* Toggle Sign Up/Sign In */}
            <div className="mt-8 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-blue-600 hover:text-blue-700 font-bold transition-colors text-lg transform rotate-1 hover:rotate-0 inline-block"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>

            <div 
              className="absolute w-4 h-4 bg-blue-200 rounded-full opacity-40 transform -rotate-12 transition-all duration-500"
              style={{
                bottom: isSignUp ? '80px' : '64px',
                left: isSignUp ? '48px' : '48px'
              }}
            ></div>
            <div 
              className="absolute w-2 h-8 bg-red-200 opacity-30 transform -rotate-45 transition-all duration-500"
              style={{
                top: isSignUp ? '40%' : '33%',
                left: '24px'
              }}
            ></div>
            
            {/* Small doodles - positioned dynamically */}
            <div 
              className="absolute text-gray-300 text-xs transform rotate-12 font-patrick transition-all duration-500"
              style={{
                top: isSignUp ? '50%' : '50%',
                right: isSignUp ? '32px' : '32px'
              }}
            >
              ✓
            </div>
            <div 
              className="absolute text-gray-300 text-xs transform -rotate-6 font-patrick transition-all duration-500"
              style={{
                bottom: isSignUp ? '30%' : '25%',
                right: isSignUp ? '40px' : '40px'
              }}
            >
              ★
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}