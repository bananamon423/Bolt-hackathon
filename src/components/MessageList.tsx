import React, { useEffect, useRef } from 'react';
import { Bot, User, Sparkles, Clock, Zap, Trash2 } from 'lucide-react';
import { Message } from '../lib/supabase';
import { OPENROUTER_MODELS, OpenRouterModelId } from '../lib/supabase';
import { ThinkingIndicator } from './ThinkingIndicator';
import { MessageActions } from './MessageActions';
import { useMessageActions } from '../hooks/useMessageActions';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isAIThinking?: boolean;
  thinkingModelName?: string;
  chatOwnerId?: string;
}

export function MessageList({ 
  messages, 
  currentUserId, 
  isAIThinking = false,
  thinkingModelName,
  chatOwnerId
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { deleteMessage, canDeleteMessage, deletingMessageId } = useMessageActions();

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

    return {
      name: 'AI Assistant',
      icon: '🤖',
      color: 'from-purple-500 to-pink-500'
    };
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await deleteMessage(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const visibleMessages = messages.filter(message => {
    if (!message.deleted_at) return true;
    return currentUserId === chatOwnerId || message.deleted_by === currentUserId;
  });

  return (
    <div 
      className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-gray-50"
      style={{
        backgroundImage: `
          linear-gradient(rgba(156, 163, 175, 0.15) 1px, transparent 1px),
          linear-gradient(90deg, rgba(156, 163, 175, 0.15) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 0'
      }}
    >
      {visibleMessages.map((message) => {
        const isUser = message.sender_type === 'user';
        const isCurrentUser = message.sender_id === currentUserId;
        const isAI = message.sender_type === 'ai';
        const isSystem = message.sender_type === 'system';
        const isDeleted = !!message.deleted_at;
        const isOwner = currentUserId === chatOwnerId;

        if (isSystem) {
          return (
            <div key={message.id} className="flex justify-center group">
              <div className={`bg-white/95 backdrop-blur-sm text-gray-600 px-4 py-2 rounded-full text-sm relative shadow-sm border border-gray-200 ${
                isDeleted ? 'opacity-50 line-through' : ''
              }`}>
                {message.content}
                {isDeleted && (
                  <span className="ml-2 text-xs text-red-500">(deleted)</span>
                )}
                <div className="absolute top-0 right-0 -mt-2 -mr-2">
                  <MessageActions
                    message={message}
                    canDelete={canDeleteMessage(message, currentUserId, isOwner)}
                    onDelete={handleDeleteMessage}
                    isDeleting={deletingMessageId === message.id}
                  />
                </div>
              </div>
            </div>
          );
        }

        const aiModelInfo = isAI ? getAIModelInfo(message) : null;

        return (
          <div
            key={message.id}
            className={`flex group w-full ${
              isAI ? 'justify-center' : isCurrentUser ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`flex gap-3 ${
                isCurrentUser ? 'flex-row-reverse' : 'flex-row'
              } ${isAI ? 'w-full' : 'max-w-xs lg:max-w-md xl:max-w-lg'}`}
            >

              {/* Message Content */}
              <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} relative w-full`}>
                <div className={'flex flex-row gap-2 items-center px-1 mb-2'}>
                    {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                    isAI 
                      ? `bg-gradient-to-br ${aiModelInfo?.color || 'from-purple-500 to-pink-500'}` 
                      : isCurrentUser
                      ? 'bg-gradient-to-br from-blue-500 to-teal-500'
                      : 'bg-gradient-to-br from-gray-400 to-gray-600'
                  }`}>
                    {isAI ? (
                      <span className="text-m">{aiModelInfo?.icon || '🤖'}</span>
                    ) : (
                      <User className="w-5 h-5 text-white" />
                    )}
                  </div>
                  {/* Author name for AI messages */}
                  {isAI && aiModelInfo && (
                    <div className="text-xs font-medium text-gray-700 mb-1 px-2 py-1 bg-white/80 rounded-full shadow-sm">
                      {aiModelInfo.name}
                    </div>
                  )}
              </div>
                <div
                  className={`px-4 py-3 rounded-2xl relative w-full shadow-sm ${
                    isDeleted 
                      ? 'opacity-50 border-2 border-dashed border-gray-300 bg-white/80'
                      : isAI
                      ? `bg-gradient-to-br from-yellow-200 to-teal-100 border-2 border-teal-300 rounded-bl-none text-gray-800 shadow-md`
                      : isCurrentUser
                      ? 'bg-gradient-to-br from-blue-500 to-teal-500 text-white shadow-md'
                      : 'bg-white/95 text-gray-900 border border-gray-200 shadow-md'
                  }`}
                >
                  <div className={`whitespace-pre-wrap text-sm leading-relaxed w-full ${
                    isDeleted ? 'line-through' : ''
                  }`}>
                    {isDeleted ? (
                      <span className="italic text-gray-500">
                        This message was deleted
                        {message.delete_reason && ` (${message.delete_reason})`}
                      </span>
                    ) : (
                      message.content
                    )}
                  </div>

                  {/* Message Actions */}
                  <div className={`absolute top-2 ${isCurrentUser ? 'left-2' : 'right-2'}`}>
                    <MessageActions
                      message={message}
                      canDelete={canDeleteMessage(message, currentUserId, isOwner)}
                      onDelete={handleDeleteMessage}
                      isDeleting={deletingMessageId === message.id}
                    />
                  </div>
                </div>

                {/* Timestamp and metadata */}
                <div className={`flex items-center gap-2 mt-1 text-xs text-gray-600 ${
                  isCurrentUser ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  <div className="flex items-center gap-1 bg-white/80 rounded-full px-2 py-1 shadow-sm">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(message.created_at)}</span>
                  </div>

                  {isAI && !isDeleted && (
                    <>
                      {message.cost_in_credits && (
                        <div className="flex items-center gap-1 bg-white/80 rounded-full px-2 py-1 shadow-sm">
                          <Zap className="w-3 h-3" />
                          <span>{message.cost_in_credits} credit{message.cost_in_credits > 1 ? 's' : ''}</span>
                        </div>
                      )}

                      {(message.input_tokens || message.output_tokens) && (
                        <div className="flex items-center gap-1 bg-white/80 rounded-full px-2 py-1 shadow-sm">
                          <span>•</span>
                          <span>
                            {message.input_tokens || 0}→{message.output_tokens || 0} tokens
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {!isCurrentUser && !isAI && message.profiles?.username && (
                    <span className="bg-white/80 rounded-full px-2 py-1 shadow-sm">• {message.profiles.username}</span>
                  )}

                  {isDeleted && (
                    <div className="flex items-center gap-1 text-red-500 bg-white/80 rounded-full px-2 py-1 shadow-sm">
                      <Trash2 className="w-3 h-3" />
                      <span>deleted</span>
                    </div>
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