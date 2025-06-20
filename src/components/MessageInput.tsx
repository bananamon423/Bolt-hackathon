import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, AlertCircle, Sparkles } from 'lucide-react';
import { MentionDropdown } from './MentionDropdown';
import { useMentions } from '../hooks/useMentions';
import { LLMModel } from '../lib/supabase';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onSendAIMessage: (content: string, modelId?: string, modelName?: string) => Promise<void>;
  disabled?: boolean;
  creditsBalance: number;
  onlineUsers?: string[];
  availableModels?: LLMModel[];
}

export function MessageInput({ 
  onSendMessage, 
  onSendAIMessage, 
  disabled = false,
  creditsBalance,
  onlineUsers = [],
  availableModels = []
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCreditsWarning, setShowCreditsWarning] = useState(false);
  const [selectedAIModel, setSelectedAIModel] = useState<{
    id: string;
    name: string;
    apiIdentifier: string;
    cost: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    showDropdown,
    mentionOptions,
    selectedIndex,
    dropdownPosition,
    handleTextChange,
    handleKeyDown,
    handleMentionSelect
  } = useMentions({ 
    onlineUsers, 
    creditsBalance, 
    textareaRef,
    availableModels 
  });

  // Enhanced AI mention detection
  const getAIMentionFromMessage = (text: string) => {
    // Check for @Gwiz first (case-insensitive)
    if (text.toLowerCase().includes('@gwiz')) {
      return {
        id: 'gwiz-hardcoded',
        name: 'Gwiz',
        apiIdentifier: 'google/gemini-1.5-flash',
        cost: 1
      };
    }

    // Check for other AI models from database
    const aiModels = availableModels.map(model => model.model_name);
    for (const modelName of aiModels) {
      if (text.includes(`@${modelName}`)) {
        const model = availableModels.find(m => m.model_name === modelName);
        return model ? {
          id: model.id,
          name: model.model_name,
          apiIdentifier: model.api_identifier,
          cost: model.cost_per_token
        } : null;
      }
    }
    
    return null;
  };

  const aiMention = getAIMentionFromMessage(message);
  const isAIMessage = !!aiMention;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart || 0;
    
    setMessage(newValue);
    handleTextChange(newValue, newCursorPosition);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.target as HTMLTextAreaElement;
    const currentCursorPosition = textarea.selectionStart || 0;
    
    // Handle mention dropdown navigation first
    const mentionHandled = handleKeyDown(e, message, currentCursorPosition);
    if (mentionHandled) {
      // Update React state after mention is handled
      setTimeout(() => {
        if (textareaRef.current) {
          setMessage(textareaRef.current.value);
        }
      }, 10);
      return;
    }

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
      // Update textarea value directly
      textarea.value = result.newText;
      setMessage(result.newText);
      
      // Store selected AI model if it's an AI mention
      if (result.selectedModel) {
        setSelectedAIModel(result.selectedModel);
      }
      
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
    const currentAIMention = getAIMentionFromMessage(trimmedMessage);

    if (currentAIMention) {
      if (creditsBalance < currentAIMention.cost) {
        setShowCreditsWarning(true);
        setTimeout(() => setShowCreditsWarning(false), 3000);
        return;
      }

      setIsLoading(true);
      try {
        // Extract the actual message content (remove the @mention)
        let aiMessage = trimmedMessage;
        if (currentAIMention.name === 'Gwiz') {
          aiMessage = trimmedMessage.replace(/@gwiz/gi, '').trim();
        } else {
          aiMessage = trimmedMessage.replace(`@${currentAIMention.name}`, '').trim();
        }
        
        // First send the user message with the mention
        onSendMessage(trimmedMessage);
        
        // Then send to AI with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        );
        
        console.log('🚀 Sending to AI:', {
          message: aiMessage,
          modelId: currentAIMention.id,
          modelName: currentAIMention.name
        });
        
        await Promise.race([
          onSendAIMessage(aiMessage, currentAIMention.id, currentAIMention.name),
          timeoutPromise
        ]);
        
        setMessage('');
        setSelectedAIModel(null);
      } catch (error) {
        console.error('AI message failed:', error);
        if (error.message.includes('timeout')) {
          alert('AI response is taking longer than expected. Please try again.');
        } else {
          alert('Failed to get AI response. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      onSendMessage(trimmedMessage);
      setMessage('');
    }
  };

  const handleQuickAIClick = async () => {
    if (!message.trim() || disabled || isLoading) {
      // If no message, insert default AI mention
      if (!message.trim() && availableModels.length > 0) {
        const defaultModel = availableModels[0];
        const newMessage = `@${defaultModel.model_name} `;
        setMessage(newMessage);
        if (textareaRef.current) {
          textareaRef.current.value = newMessage;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newMessage.length, newMessage.length);
        }
        return;
      }
      return;
    }

    // Use the first available model as default
    const defaultModel = availableModels[0];
    if (!defaultModel) return;

    if (creditsBalance < defaultModel.cost_per_token) {
      setShowCreditsWarning(true);
      setTimeout(() => setShowCreditsWarning(false), 3000);
      return;
    }

    const userMessage = message.trim();
    setMessage('');
    setIsLoading(true);
    
    try {
      // Send user message first
      onSendMessage(userMessage);
      
      // Then send to AI
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );
      
      await Promise.race([
        onSendAIMessage(userMessage, defaultModel.id, defaultModel.model_name),
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
            Insufficient credits for this AI model. Please purchase more credits to continue.
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
                ? `Ask ${aiMention?.name} anything...` 
                : "Type your message... (Use @ to mention AI models or users)"
            }
            className={`w-full resize-none rounded-lg px-4 py-3 focus:ring-2 focus:border-transparent transition-all duration-200 ${
              isAIMessage
                ? 'border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 focus:ring-purple-500'
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
          {isAIMessage && aiMention && (
            <div className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {aiMention.name} • {aiMention.cost} credit{aiMention.cost > 1 ? 's' : ''}
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleQuickAIClick}
            disabled={disabled || isLoading || (message.trim() && creditsBalance < 1)}
            className={`px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 ${
              isAIMessage
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 focus:ring-purple-500'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 focus:ring-indigo-500'
            }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {isLoading ? 'Thinking...' : 'AI'}
            </span>
          </button>
          
          <button
            type="submit"
            disabled={!message.trim() || disabled || isLoading}
            className={`px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 ${
              isAIMessage
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 focus:ring-purple-500'
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
            ? `🤖 AI Mode: ${aiMention?.name} - Press Enter to send` 
            : "Press Enter to send, Shift+Enter for new line, @ to mention"
          }
        </span>
        <span className="flex items-center gap-2">
          <span>{creditsBalance} credits remaining</span>
          {isLoading && (
            <div className="flex items-center gap-1 text-purple-600">
              <div className="w-3 h-3 border border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <span>AI thinking...</span>
            </div>
          )}
        </span>
      </div>
    </div>
  );
}