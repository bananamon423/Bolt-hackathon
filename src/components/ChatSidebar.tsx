import React, { useState } from 'react';
import { Plus, MessageSquare, ChevronLeft, ChevronRight, Settings, LogOut, Users, MoreVertical, Trash2, AlertTriangle } from 'lucide-react';
import { Chat, Profile } from '../lib/supabase';
import { TokenUsageIndicator } from './TokenUsageIndicator';

interface SubscriptionData {
  plan: string;
  tokens: number;
  maxTokens: number;
  subscriptionStatus: string;
  lastTokenReset: string;
}

interface ChatSidebarProps {
  chats: Chat[];
  currentChat: Chat | null;
  onChatSelect: (chat: Chat) => void;
  onNewChat: () => void;
  onSignOut: () => void;
  onDeleteChat: (chatId: string) => Promise<void>;
  canDeleteChat: (chat: Chat) => boolean;
  profile: Profile | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onlineUsers: string[];
  deletingChatId: string | null;
  subscription?: SubscriptionData | null;
  onUpgradeClick?: () => void;
}

export function ChatSidebar({ 
  chats, 
  currentChat, 
  onChatSelect, 
  onNewChat, 
  onSignOut,
  onDeleteChat,
  canDeleteChat,
  profile,
  collapsed,
  onToggleCollapse,
  onlineUsers,
  deletingChatId,
  subscription,
  onUpgradeClick
}: ChatSidebarProps) {
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showChatMenu, setShowChatMenu] = useState<string | null>(null);

  const handleDeleteChat = async (chatId: string) => {
    try {
      await onDeleteChat(chatId);
      setShowDeleteConfirm(null);
      setShowChatMenu(null);
    } catch (error) {
      console.error('Failed to delete chat:', error);
      alert('Failed to delete chat. Please try again.');
    }
  };

  const handleChatMenuClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setShowChatMenu(showChatMenu === chatId ? null : chatId);
  };

  return (
    <div className={`flex flex-col transition-all duration-300 relative ${
      collapsed ? 'w-16' : 'w-80'
    }`}
    style={{
      background: 'linear-gradient(135deg, #f4e4bc 0%, #e8d5a6 50%, #dcc896 100%)',
      boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.1), 2px 0 8px rgba(0,0,0,0.15)'
    }}>
      {/* Folder tab effect at the top */}
      <div className="absolute -top-4 left-4 w-20 h-6 rounded-t-lg"
           style={{
             background: 'linear-gradient(135deg, #f4e4bc 0%, #e8d5a6 100%)',
             boxShadow: '0 -2px 4px rgba(0,0,0,0.1)'
           }}>
      </div>
      
      {/* Folder edge line */}
      <div className="absolute top-0 left-0 w-full h-1"
           style={{
             background: 'linear-gradient(90deg, transparent 0%, #d4b896 20%, #d4b896 80%, transparent 100%)'
           }}>
      </div>

      {/* Header */}
      <div className="p-4 flex items-center justify-between relative">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-amber-600 to-amber-800 p-2 rounded-lg shadow-md">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-amber-900 drop-shadow-sm">AI Workspace</h1>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-amber-200/50 rounded-lg transition-colors text-amber-800"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* User Profile */}
      {!collapsed && profile && (
        <div className="p-4 border-b border-amber-300/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full flex items-center justify-center text-white font-medium shadow-md">
              {profile.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900 truncate">
                {profile.username || 'User'}
              </p>
              <p className="text-xs text-amber-700">
                {profile.credits_balance} credits
              </p>
            </div>
          </div>
        </div>
      )}

      {/* New Chat Button */}
      <div className="p-4">
        <button
          onClick={onNewChat}
          className={`w-full bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg hover:from-amber-700 hover:to-amber-800 transition-colors flex items-center justify-center gap-2 shadow-md border border-amber-800/20 ${
            collapsed ? 'p-3' : 'py-3 px-4'
          }`}
        >
          <Plus className="w-5 h-5" />
          {!collapsed && <span className="font-medium">New Chat</span>}
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`mx-2 mb-2 rounded-lg cursor-pointer transition-all duration-200 relative group ${
              currentChat?.id === chat.id
                ? 'bg-amber-200/60 border border-amber-400/50 shadow-sm'
                : 'hover:bg-amber-200/30'
            } ${deletingChatId === chat.id ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => onChatSelect(chat)}
            onMouseEnter={() => setHoveredChat(chat.id)}
            onMouseLeave={() => setHoveredChat(null)}
          >
            <div className={`p-3 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 bg-amber-300/60 rounded-lg flex items-center justify-center flex-shrink-0 border border-amber-400/30">
                {deletingChatId === chat.id ? (
                  <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4 text-amber-800" />
                )}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-900 truncate">
                      {chat.chat_title}
                    </p>
                    <p className="text-xs text-amber-700">
                      {new Date(chat.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  {onlineUsers.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">{onlineUsers.length}</span>
                    </div>
                  )}
                  {canDeleteChat(chat) && (
                    <div className="relative">
                      <button
                        onClick={(e) => handleChatMenuClick(e, chat.id)}
                        className="p-1 hover:bg-amber-300/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-amber-700"
                        disabled={deletingChatId === chat.id}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {showChatMenu === chat.id && (
                        <div className="absolute top-full right-0 mt-1 bg-white border border-amber-300 rounded-lg shadow-lg z-10 min-w-32">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(chat.id);
                              setShowChatMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Chat
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-amber-300/30 space-y-2">
        {/* Token Usage Indicator */}
        {subscription && !collapsed && (
          <div className="mb-3">
            <TokenUsageIndicator
              tokens={subscription.tokens}
              plan={subscription.plan}
              maxTokens={subscription.maxTokens}
              onUpgradeClick={onUpgradeClick}
              className="bg-amber-100/60 border border-amber-300/50 shadow-sm"
            />
          </div>
        )}

        {profile?.role === 'admin' && (
          <button
            onClick={() => window.open('/admin', '_blank')}
            className={`w-full text-amber-800 hover:text-amber-900 hover:bg-amber-200/50 rounded-lg transition-colors flex items-center gap-2 ${
              collapsed ? 'p-3 justify-center' : 'py-2 px-3'
            }`}
          >
            <Settings className="w-5 h-5" />
            {!collapsed && <span>Admin</span>}
          </button>
        )}
        <button
          onClick={onSignOut}
          className={`w-full text-amber-800 hover:text-amber-900 hover:bg-amber-200/50 rounded-lg transition-colors flex items-center gap-2 ${
            collapsed ? 'p-3 justify-center' : 'py-2 px-3'
          }`}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Chat</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                <strong>Chat:</strong> {chats.find(c => c.id === showDeleteConfirm)?.chat_title}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                All messages, members, and related data will be permanently deleted.
              </p>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={deletingChatId === showDeleteConfirm}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteChat(showDeleteConfirm)}
                disabled={deletingChatId === showDeleteConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deletingChatId === showDeleteConfirm ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {showChatMenu && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setShowChatMenu(null)}
        />
      )}
    </div>
  );
}