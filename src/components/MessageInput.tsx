import React, { useState } from 'react';
import { Send, Bot, AlertCircle } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onSendAIMessage: (content: string) => Promise<void>;
  disabled?: boolean;
  creditsBalance: number;
}

export function MessageInput({ 
  onSendMessage, 
  onSendAIMessage, 
  disabled = false,
  creditsBalance 
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCreditsWarning, setShowCreditsWarning] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled || isLoading) return;

    const trimmedMessage = message.trim();
    setMessage('');

    // Check if message starts with @Gwiz
    if (trimmedMessage.startsWith('@Gwiz ')) {
      if (creditsBalance < 1) {
        setShowCreditsWarning(true);
        setTimeout(() => setShowCreditsWarning(false), 3000);
        setMessage(trimmedMessage); // Restore message
        return;
      }

      setIsLoading(true);
      try {
        const aiMessage = trimmedMessage.replace('@Gwiz ', '');
        // First send the user message
        onSendMessage(trimmedMessage);
        // Then send to AI (with timeout for better UX)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        );
        
        await Promise.race([
          onSendAIMessage(aiMessage),
          timeoutPromise
        ]);
      } catch (error) {
        console.error('AI message failed:', error);
        // Show user-friendly error
        if (error.message.includes('timeout')) {
          alert('AI response is taking longer than expected. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      onSendMessage(trimmedMessage);
    }
  };

  const handleGwizClick = async () => {
    if (!message.trim() || disabled || isLoading) return;

    if (creditsBalance < 1) {
      setShowCreditsWarning(true);
      setTimeout(() => setShowCreditsWarning(false), 3000);
      return;
    }

    const userMessage = message.trim();
    setMessage(''); // Clear input immediately
    setIsLoading(true);
    
    try {
      // First send the user message
      onSendMessage(userMessage);
      // Then send to AI with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      await Promise.race([
        onSendAIMessage(userMessage),
        timeoutPromise
      ]);
    } catch (error) {
      console.error('AI message failed:', error);
      if (error.message.includes('timeout')) {
        alert('AI response is taking longer than expected. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-t border-gray-200 p-4">
      {showCreditsWarning && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700 text-sm">
            Insufficient credits. Please purchase a package to continue.
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message... (Use @Gwiz to ask the AI)"
            className="w-full resize-none border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            rows={1}
            disabled={disabled || isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            style={{
              minHeight: '44px',
              maxHeight: '120px',
              height: 'auto',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
        </div>
        
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleGwizClick}
            disabled={!message.trim() || disabled || isLoading || creditsBalance < 1}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {isLoading ? 'Thinking...' : 'Gwiz'}
            </span>
          </button>
          
          <button
            type="submit"
            disabled={!message.trim() || disabled || isLoading}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
      
      <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
        <span>Press Enter to send, Shift+Enter for new line</span>
        <span>{creditsBalance} credits remaining</span>
      </div>
    </div>
  );
}