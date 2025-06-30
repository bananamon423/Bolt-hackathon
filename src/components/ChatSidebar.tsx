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
      backgroundImage: 'url(/Folder.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      
      {/* Main folder content area */}
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between relative">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-amber-700 to-amber-900 p-2 rounded-lg shadow-md">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-amber-900 drop-shadow-sm">AI WORKSPACE</h1>
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
          <div className="px-4 pb-4">
            <div className="flex items-center gap-3 bg-teal-400 p-3 rounded-lg shadow-md">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-teal-600 font-bold text-lg shadow-sm">
                {profile.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white uppercase tracking-wide">
                  {profile.username || 'USERNAME'}
                </p>
                <p className="text-xs text-white font-medium">
                  {profile.credits_balance} CREDITS
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-4 space-y-2">
          {chats.map((chat, index) => (
            <div
              key={chat.id}
              className={`cursor-pointer transition-all duration-200 relative group ${
                deletingChatId === chat.id ? 'opacity-50 pointer-events-none' : ''
              }`}
              onClick={() => onChatSelect(chat)}
              onMouseEnter={() => setHoveredChat(chat.id)}
              onMouseLeave={() => setHoveredChat(null)}
            >
              <div className={`p-3 rounded-lg font-bold text-white text-center uppercase tracking-wide shadow-md border-2 ${
                currentChat?.id === chat.id
                  ? 'bg-yellow-400 border-yellow-600 text-black'
                  : index === 0
                  ? 'bg-green-500 border-green-700'
                  : 'bg-cyan-500 border-cyan-700'
              } ${collapsed ? 'text-xs' : 'text-sm'}`}>
                {!collapsed && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="truncate flex-1">
                        {chat.chat_title.length > 12 ? chat.chat_title.substring(0, 12) + '...' : chat.chat_title}
                      </span>
                      {canDeleteChat(chat) && (
                        <button
                          onClick={(e) => handleChatMenuClick(e, chat.id)}
                          className="ml-2 p-1 hover:bg-black/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={deletingChatId === chat.id}
                        >
                          <MoreVertical className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="text-xs mt-1 opacity-80">
                      {new Date(chat.updated_at).toLocaleDateString()}
                    </div>
                    {onlineUsers.length > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Users className="w-3 h-3" />
                        <span className="text-xs">{onlineUsers.length}</span>
                      </div>
                    )}
                  </>
                )}
                
                {collapsed && (
                  <MessageSquare className="w-4 h-4 mx-auto" />
                )}

                {showChatMenu === chat.id && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-32">
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
            </div>
          ))}

          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            className="w-full p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-bold uppercase tracking-wide shadow-md border-2 border-blue-700 hover:from-blue-600 hover:to-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {!collapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 space-y-3">
          {/* Token Usage Indicator */}
          {subscription && !collapsed && (
            <div className="mb-3">
              <TokenUsageIndicator
                tokens={subscription.tokens}
                plan={subscription.plan}
                maxTokens={subscription.maxTokens}
                onUpgradeClick={onUpgradeClick}
                className="bg-amber-100/90 border border-amber-400/50 shadow-sm backdrop-blur-sm"
              />
            </div>
          )}

          {profile?.role === 'admin' && (
            <button
              onClick={() => window.open('/admin', '_blank')}
              className={`w-full text-amber-900 hover:text-amber-800 hover:bg-amber-200/50 rounded-lg transition-colors flex items-center gap-2 font-medium backdrop-blur-sm ${
                collapsed ? 'p-3 justify-center' : 'py-2 px-3'
              }`}
            >
              <Settings className="w-5 h-5" />
              {!collapsed && <span>Admin</span>}
            </button>
          )}
          
          <button
            onClick={onSignOut}
            className={`w-full text-amber-900 hover:text-amber-800 hover:bg-amber-200/50 rounded-lg transition-colors flex items-center gap-2 font-medium backdrop-blur-sm ${
              collapsed ? 'p-3 justify-center' : 'py-2 px-3'
            }`}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
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