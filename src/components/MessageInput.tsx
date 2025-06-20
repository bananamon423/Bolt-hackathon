import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, AlertCircle } from 'lucide-react';
import { MentionDropdown } from './MentionDropdown';
import { useMentions } from '../hooks/useMentions';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onSendAIMessage: (content: string) => Promise<void>;
  disabled?: boolean;
  creditsBalance: number;
  onlineUsers?: string[];
}

export function MessageInput({ 
  onSendMessage, 
  onSendAIMessage, 
  disabled = false,
  creditsBalance,
  onlineUsers = []
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCreditsWarning, setShowCreditsWarning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    showDropdown,
    mentionOptions,
    selectedIndex,
    dropdownPosition,
    handleTextChange,
    handleKeyDown,
    handleMentionSelect
  } = useMentions({ onlineUsers, creditsBalance, textareaRef });

  // Check if message is for AI (starts with @Gwiz)
  const isAIMessage = message.startsWith('@Gwiz ');

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart || 0;
    
    setMessage(newValue);
    handleTextChange(newValue, newCursorPosition);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.target as HTMLTextAreaElement;
    const currentCursorPosition = textarea.selectionStart || 0;
    
    // Handle mention dropdown navigation
    const mentionHandled = handleKeyDown(e, message, currentCursorPosition);
    if (mentionHandled) return;

    // Handle regular Enter key for sending message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleMentionClick = (option: any) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart || 0;
    const result = handleMentionSelect(option, message, cursorPosition);
    
    if (result) {
      setMessage(result.newText);
      
      // Set cursor position after the mention
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

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
    if (!message.trim() || disabled || isLoading) {
      // If no message, insert @Gwiz mention
      if (!message.trim()) {
        setMessage('@Gwiz ');
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(6, 6); // Position cursor after "@Gwiz "
          }
        }, 0);
        return;
      }
      return;
    }

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
    <div className="border-t border-gray-200 p-4 relative">
      {showCreditsWarning && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700 text-sm">
            Insufficient credits. Please purchase a package to continue.
          </p>
        </div>
      )}
      
      {/* Mention Dropdown */}
      <MentionDropdown
        options={mentionOptions}
        selectedIndex={selectedIndex}
        onSelect={handleMentionClick}
        position={dropdownPosition}
        visible={showDropdown}
      />
      
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={
              isAIMessage 
                ? "Ask Gwiz anything..." 
                : "Type your message... (Use @ to mention)"
            }
            className={`w-full resize-none rounded-lg px-4 py-3 focus:ring-2 focus:border-transparent transition-all duration-200 ${
              isAIMessage
                ? 'border-2 border-green-300 bg-green-50 focus:ring-green-500 focus:bg-green-100'
                : 'border border-gray-300 bg-white focus:ring-blue-500'
            }`}
            rows={1}
            disabled={disabled || isLoading}
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
          
          {/* AI Mode Indicator */}
          {isAIMessage && (
            <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Bot className="w-3 h-3" />
              AI Mode
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleGwizClick}
            disabled={disabled || isLoading || (message.trim() && creditsBalance < 1)}
            className={`px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 ${
              isAIMessage
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 focus:ring-green-500'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 focus:ring-purple-500'
            }`}
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
            className={`px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 ${
              isAIMessage
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 focus:ring-green-500'
                : 'bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 focus:ring-blue-500'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
      
      <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
        <span>
          {isAIMessage 
            ? "🤖 AI Mode Active - Press Enter to ask Gwiz" 
            : "Press Enter to send, Shift+Enter for new line, @ to mention"
          }
        </span>
        <span>{creditsBalance} credits remaining</span>
      </div>
    </div>
  );
}