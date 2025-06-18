import React, { useState, useEffect } from 'react';
import { Settings, Save, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function AdminPanel() {
  const [contextLimit, setContextLimit] = useState('10');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'CONTEXT_MESSAGE_LIMIT')
        .single();

      if (error) throw error;
      setContextLimit(data.config_value || '10');
    } catch (err) {
      console.error('Error loading config:', err);
      setError('Failed to load configuration');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('app_config')
        .update({ config_value: contextLimit })
        .eq('config_key', 'CONTEXT_MESSAGE_LIMIT');

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.close()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-teal-500 p-2 rounded-lg">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
                <p className="text-gray-600">Manage application settings</p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">AI Configuration</h2>
          
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label htmlFor="contextLimit" className="block text-sm font-medium text-gray-700 mb-2">
                Context Message Limit
              </label>
              <input
                id="contextLimit"
                type="number"
                min="1"
                max="100"
                value={contextLimit}
                onChange={(e) => setContextLimit(e.target.value)}
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Number of recent messages to send to the AI for context (1-100)
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-600 text-sm">Configuration saved successfully!</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-teal-500 text-white px-6 py-2 rounded-lg hover:from-blue-600 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Configuration
            </button>
          </form>
        </div>

        {/* Additional Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h3 className="font-medium text-blue-900 mb-2">About Context Limit</h3>
          <p className="text-blue-800 text-sm leading-relaxed">
            This setting controls how many recent messages are sent to the AI for context when generating responses. 
            Higher values provide more context but may increase API costs and response times. The recommended range is 5-20 messages.
          </p>
        </div>
      </div>
    </div>
  );
}