import React, { useState } from 'react';
import { Edit3, Check, X, ChevronDown, Share2, Copy, ExternalLink } from 'lucide-react';
import { Chat, LLMModel } from '../lib/supabase';
import { LastUsedLLMIndicator } from './LastUsedLLMIndicator';
import { UserPresenceIndicator } from './UserPresenceIndicator';
import { RealtimeStatus } from './RealtimeStatus';

interface ChatHeaderProps {
  chat: Chat | null;
  models: LLMModel[];
  selectedModel: LLMModel | null;
  onUpdateTitle: (title: string) => void;
  onModelChange: (model: LLMModel) => void;
  onlineUsers: string[];
}

export function ChatHeader({ 
  chat, 
  models, 
  selectedModel, 
  onUpdateTitle, 
  onModelChange,
  onlineUsers 
}: ChatHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(chat?.chat_title || '');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleSaveTitle = () => {
    if (title.trim() && title !== chat?.chat_title) {
      onUpdateTitle(title.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setTitle(chat?.chat_title || '');
    setIsEditing(false);
  };

  const handleModelSelect = (model: LLMModel) => {
    onModelChange(model);
    setShowModelDropdown(false);
  };

  const getShareUrl = () => {
    if (!chat) return '';
    return `${window.location.origin}/shared/${chat.share_link}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleShareClick = () => {
    setShowShareModal(true);
  };

  if (!chat) {
    return (
      <div className="h-16 border-b border-gray-200 flex items-center justify-center">
        <p className="text-gray-500">Select a chat to start messaging</p>
      </div>
    );
  }

  return (
    <>
      <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {/* Chat Title */}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="text-lg font-semibold bg-transparent border-b border-blue-500 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1 hover:bg-green-100 rounded"
                >
                  <Check className="w-4 h-4 text-green-600" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1 hover:bg-red-100 rounded"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-lg font-semibold text-gray-900">{chat.chat_title}</h1>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit3 className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            )}
          </div>

          {/* Real-time Status */}
          <RealtimeStatus className="hidden lg:flex" />
        </div>

        <div className="flex items-center gap-3">
          {/* User Presence Indicator - Replaces Last Used LLM */}
          <UserPresenceIndicator 
            onlineUsers={onlineUsers}
            className="hidden lg:flex" 
          />

          {/* Share Button */}
          <button
            onClick={handleShareClick}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Share</span>
          </button>

          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <span className="text-sm font-medium">
                {selectedModel?.model_name || 'Select Model'}
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showModelDropdown && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-10">
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 mb-2 px-2">
                    Available AI Models:
                  </div>
                  {models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model)}
                      className={`w-full text-left px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors ${
                        selectedModel?.id === model.id ? 'bg-blue-50 border border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            {model.model_name}
                            {model.id === 'gwiz-hardcoded' && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                🤖 Hardcoded
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{model.api_identifier}</div>
                        </div>
                        <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                          {model.cost_per_token} credit{model.cost_per_token > 1 ? 's' : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Share Chat</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <p className="text-gray-600 mb-4">
              Share this link to invite others to join this chat:
            </p>
            
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={getShareUrl()}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  copySuccess 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                <Copy className="w-4 h-4" />
                {copySuccess ? 'Copied!' : 'Copy'}
              </button>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ExternalLink className="w-4 h-4" />
              <span>Anyone with this link can join and participate in the chat</span>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}