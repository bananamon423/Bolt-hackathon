import React, { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import { Message } from '../lib/supabase';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
}

export function MessageList({ messages, currentUserId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isAI 
                  ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                  : isCurrentUser
                  ? 'bg-gradient-to-br from-blue-500 to-teal-500'
                  : 'bg-gradient-to-br from-gray-400 to-gray-600'
              }`}>
                {isAI ? (
                  <Bot className="w-4 h-4 text-white" />
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </div>

              {/* Message Content */}
              <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-2 rounded-2xl ${
                    isAI
                      ? 'bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200'
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
                  <span>{formatTime(message.created_at)}</span>
                  {isAI && message.token_cost && (
                    <span>• {message.token_cost} credit</span>
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
      <div ref={messagesEndRef} />
    </div>
  );
}