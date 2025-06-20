import React, { useEffect, useRef } from 'react';
import { Bot, User, Sparkles, Clock, Zap } from 'lucide-react';
import { Message } from '../lib/supabase';
import { OPENROUTER_MODELS, OpenRouterModelId } from '../lib/supabase';
import { ThinkingIndicator } from './ThinkingIndicator';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isAIThinking?: boolean;
  thinkingModelName?: string;
}

export function MessageList({ 
  messages, 
  currentUserId, 
  isAIThinking = false,
  thinkingModelName 
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAIThinking]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getAIModelInfo = (message: Message) => {
    if (message.llm_model_used) {
      const modelConfig = OPENROUTER_MODELS[message.llm_model_used as OpenRouterModelId];
      if (modelConfig) {
        return {
          name: modelConfig.name,
          icon: modelConfig.icon,
          color: modelConfig.color
        };
      }
    }
    
    // Fallback for legacy messages
    return {
      name: 'AI Assistant',
      icon: '🤖',
      color: 'from-purple-500 to-pink-500'
    };
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => {
        const isUser = message.sender_type === 'user';
        const isCurrentUser = message.sender_id === currentUserId;
        const isAI = message.sender_type === 'ai';
        const isSystem = message.sender_type === 'system';

        if (isSystem) {
          return (
            <div key={message.id} className="flex justify-center">
              <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm">
                {message.content}
              </div>
            </div>
          );
        }

        const aiModelInfo = isAI ? getAIModelInfo(message) : null;

        return (
          <div
            key={message.id}
            className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md xl:max-w-lg flex gap-3 ${
                isCurrentUser ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isAI 
                  ? `bg-gradient-to-br ${aiModelInfo?.color || 'from-purple-500 to-pink-500'}` 
                  : isCurrentUser
                  ? 'bg-gradient-to-br from-blue-500 to-teal-500'
                  : 'bg-gradient-to-br from-gray-400 to-gray-600'
              }`}>
                {isAI ? (
                  <span className="text-lg">{aiModelInfo?.icon || '🤖'}</span>
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>

              {/* Message Content */}
              <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                {/* Author name for AI messages */}
                {isAI && aiModelInfo && (
                  <div className="text-xs font-medium text-gray-600 mb-1 px-1">
                    {aiModelInfo.name}
                  </div>
                )}

                <div
                  className={`px-4 py-3 rounded-2xl ${
                    isAI
                      ? `bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200`
                      : isCurrentUser
                      ? 'bg-gradient-to-br from-blue-500 to-teal-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </div>
                </div>
                
                {/* Timestamp and metadata */}
                <div className={`flex items-center gap-2 mt-1 text-xs text-gray-500 ${
                  isCurrentUser ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(message.created_at)}</span>
                  </div>
                  
                  {isAI && (
                    <>
                      {message.cost_in_credits && (
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          <span>{message.cost_in_credits} credit{message.cost_in_credits > 1 ? 's' : ''}</span>
                        </div>
                      )}
                      
                      {(message.input_tokens || message.output_tokens) && (
                        <div className="flex items-center gap-1">
                          <span>•</span>
                          <span>
                            {message.input_tokens || 0}→{message.output_tokens || 0} tokens
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {!isCurrentUser && !isAI && message.profiles?.username && (
                    <span>• {message.profiles.username}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Thinking Indicator */}
      {isAIThinking && (
        <ThinkingIndicator 
          modelName={thinkingModelName}
          visible={isAIThinking}
        />
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}