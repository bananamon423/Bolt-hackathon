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
    <div className={`h-screen flex flex-col transition-all duration-300 relative ${
      collapsed ? 'w-20' : 'w-96'
    }`}
    style={{
      backgroundImage: 'url(/Folder copy.png)',
      backgroundSize: collapsed ? '100% 100%' : '120% 100%',
      backgroundPosition: collapsed ? 'center center' : 'left center',
      backgroundRepeat: 'no-repeat',
      minHeight: '100vh',
      filter: 'contrast(1.1) brightness(1.05)',
      imageRendering: 'crisp-edges'
    }}>
      
      {/* Overlay to enhance folder visibility */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-50/20 to-amber-100/30 pointer-events-none"></div>
      
      {/* Main folder content area */}
      <div className="h-full flex flex-col relative z-10">
        {/* Header */}
        <div className="p-6 flex items-center justify-between relative">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-amber-800 to-amber-900 p-3 rounded-xl shadow-lg border border-amber-700">
                <MessageSquare className="w-6 h-6 text-amber-100" />
              </div>
              <h1 className="text-xl font-black text-amber-900 drop-shadow-md tracking-wide">AI WORKSPACE</h1>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-3 hover:bg-amber-200/60 rounded-xl transition-colors text-amber-800 shadow-sm border border-amber-300/50 bg-amber-100/40"
          >
            {collapsed ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
          </button>
        </div>

        {/* User Profile */}
        {!collapsed && profile && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-4 bg-teal-500 p-4 rounded-xl shadow-lg border-2 border-teal-600">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-teal-600 font-black text-xl shadow-md border-2 border-teal-200">
                {profile.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-black text-white uppercase tracking-wider drop-shadow-sm">
                  {profile.username || 'USERNAME'}
                </p>
                <p className="text-sm text-teal-100 font-bold">
                  {profile.credits_balance} CREDITS
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-6 space-y-3">
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
              <div className={`p-4 rounded-xl font-black text-white text-center uppercase tracking-wider shadow-lg border-3 transform hover:scale-105 transition-transform ${
                currentChat?.id === chat.id
                  ? 'bg-yellow-400 border-yellow-600 text-black shadow-yellow-300/50'
                  : index === 0
                  ? 'bg-green-500 border-green-700 shadow-green-300/50'
                  : 'bg-cyan-500 border-cyan-700 shadow-cyan-300/50'
              } ${collapsed ? 'text-xs p-3' : 'text-base'}`}>
                {!collapsed && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="truncate flex-1 drop-shadow-sm">
                        {chat.chat_title.length > 10 ? chat.chat_title.substring(0, 10) + '...' : chat.chat_title}
                      </span>
                      {canDeleteChat(chat) && (
                        <button
                          onClick={(e) => handleChatMenuClick(e, chat.id)}
                          className="ml-2 p-2 hover:bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={deletingChatId === chat.id}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-sm mt-2 opacity-90 font-bold">
                      {new Date(chat.updated_at).toLocaleDateString()}
                    </div>
                    {onlineUsers.length > 0 && (
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-bold">{onlineUsers.length}</span>
                      </div>
                    )}
                  </>
                )}
                
                {collapsed && (
                  <MessageSquare className="w-5 h-5 mx-auto" />
                )}

                {showChatMenu === chat.id && (
                  <div className="absolute top-full right-0 mt-2 bg-white border-2 border-gray-300 rounded-xl shadow-xl z-10 min-w-36">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(chat.id);
                        setShowChatMenu(null);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-xl font-semibold"
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
            className="w-full p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-black uppercase tracking-wider shadow-lg border-3 border-blue-800 hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 flex items-center justify-center gap-3 shadow-blue-300/50"
          >
            <Plus className="w-6 h-6" />
            {!collapsed && <span className="text-base drop-shadow-sm">New Chat</span>}
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="p-6 space-y-4">
          {/* Token Usage Indicator */}
          {subscription && !collapsed && (
            <div className="mb-4">
              <TokenUsageIndicator
                tokens={subscription.tokens}
                plan={subscription.plan}
                maxTokens={subscription.maxTokens}
                onUpgradeClick={onUpgradeClick}
                className="bg-amber-50/95 border-2 border-amber-400/70 shadow-lg backdrop-blur-sm rounded-xl"
              />
            </div>
          )}

          {profile?.role === 'admin' && (
            <button
              onClick={() => window.open('/admin', '_blank')}
              className={`w-full text-amber-900 hover:text-amber-800 hover:bg-amber-200/60 rounded-xl transition-colors flex items-center gap-3 font-bold backdrop-blur-sm border border-amber-300/50 bg-amber-100/40 shadow-sm ${
                collapsed ? 'p-3 justify-center' : 'py-3 px-4'
              }`}
            >
              <Settings className="w-6 h-6" />
              {!collapsed && <span className="text-base">Admin</span>}
            </button>
          )}
          
          <button
            onClick={onSignOut}
            className={`w-full text-amber-900 hover:text-amber-800 hover:bg-amber-200/60 rounded-xl transition-colors flex items-center gap-3 font-bold backdrop-blur-sm border border-amber-300/50 bg-amber-100/40 shadow-sm ${
              collapsed ? 'p-3 justify-center' : 'py-3 px-4'
            }`}
          >
            <LogOut className="w-6 h-6" />
            {!collapsed && <span className="text-base">Sign Out</span>}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl border-2 border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center border-2 border-red-200">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Chat</h3>
                <p className="text-sm text-gray-600 font-medium">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
              <p className="text-sm text-gray-700 font-semibold">
                <strong>Chat:</strong> {chats.find(c => c.id === showDeleteConfirm)?.chat_title}
              </p>
              <p className="text-xs text-gray-500 mt-2 font-medium">
                All messages, members, and related data will be permanently deleted.
              </p>
            </div>
            
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-semibold border border-gray-300"
                disabled={deletingChatId === showDeleteConfirm}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteChat(showDeleteConfirm)}
                disabled={deletingChatId === showDeleteConfirm}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 font-semibold shadow-lg"
              >
                {deletingChatId === showDeleteConfirm ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
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