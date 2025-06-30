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
        backgroundImage: `
          radial-gradient(circle at 20% 50%, rgba(139, 69, 19, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(160, 82, 45, 0.2) 0%, transparent 50%),
          radial-gradient(circle at 40% 80%, rgba(101, 67, 33, 0.2) 0%, transparent 50%),
          linear-gradient(135deg, #8B4513 0%, #A0522D 25%, #CD853F 50%, #D2B48C 75%, #F5DEB3 100%)
        `,
        backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="max-w-md w-full">
        {/* Torn Paper Container */}
        <div 
          className="relative bg-white shadow-2xl"
          style={{
            clipPath: `polygon(
              0% 8%, 3% 4%, 8% 6%, 12% 2%, 18% 5%, 22% 1%, 28% 4%, 32% 0%, 38% 3%, 42% 1%, 48% 4%, 52% 0%, 58% 3%, 62% 1%, 68% 4%, 72% 0%, 78% 3%, 82% 1%, 88% 4%, 92% 0%, 98% 3%, 100% 8%,
              100% 92%, 97% 96%, 92% 94%, 88% 98%, 82% 95%, 78% 99%, 72% 96%, 68% 100%, 62% 97%, 58% 99%, 52% 96%, 48% 100%, 42% 97%, 38% 99%, 32% 96%, 28% 100%, 22% 97%, 18% 99%, 12% 96%, 8% 100%, 3% 97%, 0% 92%
            )`,
            filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.3))',
            transform: 'rotate(-1deg)'
          }}
        >
          {/* Paper texture overlay */}
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `
                radial-gradient(circle at 25% 25%, #000 1px, transparent 1px),
                radial-gradient(circle at 75% 75%, #000 0.5px, transparent 0.5px),
                linear-gradient(45deg, transparent 48%, rgba(0,0,0,0.02) 49%, rgba(0,0,0,0.02) 51%, transparent 52%)
              `,
              backgroundSize: '20px 20px, 15px 15px, 10px 10px'
            }}
          />
          
          <div className="relative p-8 pt-12">
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

            {/* Form */}
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
            <div className="mt-6 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-blue-600 hover:text-blue-700 font-bold transition-colors text-lg transform rotate-1 hover:rotate-0 inline-block"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>

            {/* Decorative elements */}
            <div className="absolute top-4 right-4 w-6 h-6 bg-yellow-200 rounded-full opacity-60 transform rotate-45"></div>
            <div className="absolute bottom-6 left-4 w-4 h-4 bg-blue-200 rounded-full opacity-40 transform -rotate-12"></div>
            <div className="absolute top-1/2 left-2 w-2 h-8 bg-red-200 opacity-30 transform -rotate-45"></div>
          </div>
        </div>

        {/* Paper shadow */}
        <div 
          className="absolute inset-0 bg-black opacity-10 -z-10"
          style={{
            clipPath: `polygon(
              0% 8%, 3% 4%, 8% 6%, 12% 2%, 18% 5%, 22% 1%, 28% 4%, 32% 0%, 38% 3%, 42% 1%, 48% 4%, 52% 0%, 58% 3%, 62% 1%, 68% 4%, 72% 0%, 78% 3%, 82% 1%, 88% 4%, 92% 0%, 98% 3%, 100% 8%,
              100% 92%, 97% 96%, 92% 94%, 88% 98%, 82% 95%, 78% 99%, 72% 96%, 68% 100%, 62% 97%, 58% 99%, 52% 96%, 48% 100%, 42% 97%, 38% 99%, 32% 96%, 28% 100%, 22% 97%, 18% 99%, 12% 96%, 8% 100%, 3% 97%, 0% 92%
            )`,
            transform: 'translate(4px, 6px) rotate(-1deg)'
          }}
        />
      </div>
    </div>
  );
}