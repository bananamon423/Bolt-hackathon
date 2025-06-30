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
      collapsed ? 'w-20' : 'w-80'
    }`}
    style={{
      backgroundImage: 'url(/image.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'left center',
      backgroundRepeat: 'no-repeat',
      minHeight: '100vh',
      filter: 'contrast(1.1) brightness(1.1) saturate(1.2)',
      imageRendering: 'crisp-edges'
    }}>
      
      {/* Main folder content area - positioned to match the folder's interior */}
      <div className="h-full flex flex-col relative z-10" style={{ 
        paddingLeft: collapsed ? '16px' : '32px', 
        paddingRight: collapsed ? '16px' : '32px',
        paddingTop: '100px' 
      }}>
        
        {/* Header positioned in the folder tab area */}
        <div className="absolute top-6 left-8 right-8 flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-amber-800 to-amber-900 p-3 rounded-xl shadow-xl border-2 border-amber-700">
                <MessageSquare className="w-6 h-6 text-amber-100" />
              </div>
              <h1 className="text-2xl font-black text-amber-900 drop-shadow-xl tracking-wider uppercase">AI WORKSPACE</h1>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-3 hover:bg-amber-200/80 rounded-xl transition-colors text-amber-900 shadow-lg border-2 border-amber-500/70 bg-amber-100/70 backdrop-blur-sm"
          >
            {collapsed ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
          </button>
        </div>

        {/* User Profile */}
        {!collapsed && profile && (
          <div className="px-3 pb-6 mt-6">
            <div className="flex items-center gap-4 bg-gradient-to-r from-teal-600 to-teal-700 p-5 rounded-2xl shadow-2xl border-3 border-teal-800">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-teal-700 font-black text-2xl shadow-xl border-3 border-teal-200">
                {profile.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-black text-white uppercase tracking-wider drop-shadow-lg">
                  {profile.username || 'USERNAME'}
                </p>
                <p className="text-sm text-teal-100 font-bold">
                  {profile.credits_balance} CREDITS
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chat List - positioned within the folder's main area */}
        <div className="flex-1 overflow-y-auto px-3 space-y-4" style={{ maxHeight: 'calc(100vh - 380px)' }}>
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
              <div className={`p-5 rounded-2xl font-black text-white text-center uppercase tracking-wider shadow-2xl border-3 transform hover:scale-105 transition-all duration-200 ${
                currentChat?.id === chat.id
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 border-yellow-600 text-black shadow-yellow-300/80'
                  : index === 0
                  ? 'bg-gradient-to-r from-green-500 to-green-600 border-green-700 shadow-green-300/80'
                  : 'bg-gradient-to-r from-cyan-500 to-cyan-600 border-cyan-700 shadow-cyan-300/80'
              } ${collapsed ? 'text-xs p-4' : 'text-base'}`}>
                {!collapsed && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="truncate flex-1 drop-shadow-lg text-base font-black">
                        {chat.chat_title.length > 12 ? chat.chat_title.substring(0, 12) + '...' : chat.chat_title}
                      </span>
                      {canDeleteChat(chat) && (
                        <button
                          onClick={(e) => handleChatMenuClick(e, chat.id)}
                          className="ml-3 p-2 hover:bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={deletingChatId === chat.id}
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    <div className="text-sm mt-3 opacity-90 font-bold">
                      {new Date(chat.updated_at).toLocaleDateString()}
                    </div>
                    {onlineUsers.length > 0 && (
                      <div className="flex items-center justify-center gap-2 mt-3">
                        <Users className="w-5 h-5" />
                        <span className="text-sm font-bold">{onlineUsers.length}</span>
                      </div>
                    )}
                  </>
                )}
                
                {collapsed && (
                  <MessageSquare className="w-6 h-6 mx-auto" />
                )}

                {showChatMenu === chat.id && (
                  <div className="absolute top-full right-0 mt-2 bg-white border-3 border-gray-300 rounded-xl shadow-2xl z-10 min-w-40">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(chat.id);
                        setShowChatMenu(null);
                      }}
                      className="w-full text-left px-5 py-4 text-base text-red-600 hover:bg-red-50 flex items-center gap-3 rounded-xl font-bold"
                    >
                      <Trash2 className="w-5 h-5" />
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
            className="w-full p-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-black uppercase tracking-wider shadow-2xl border-3 border-blue-800 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-4 shadow-blue-300/80"
          >
            <Plus className="w-7 h-7" />
            {!collapsed && <span className="text-base drop-shadow-lg">New Chat</span>}
          </button>
        </div>

        {/* Bottom Actions - positioned at the bottom of the folder */}
        <div className="p-3 space-y-4" style={{ marginTop: 'auto' }}>
          {/* Token Usage Indicator */}
          {subscription && !collapsed && (
            <div className="mb-4">
              <TokenUsageIndicator
                tokens={subscription.tokens}
                plan={subscription.plan}
                maxTokens={subscription.maxTokens}
                onUpgradeClick={onUpgradeClick}
                className="bg-amber-50/95 border-3 border-amber-500/80 shadow-2xl backdrop-blur-sm rounded-2xl"
              />
            </div>
          )}

          {profile?.role === 'admin' && (
            <button
              onClick={() => window.open('/admin', '_blank')}
              className={`w-full text-amber-900 hover:text-amber-800 hover:bg-amber-200/80 rounded-2xl transition-colors flex items-center gap-3 font-bold backdrop-blur-sm border-2 border-amber-500/70 bg-amber-100/70 shadow-lg ${
                collapsed ? 'p-4 justify-center' : 'py-4 px-5'
              }`}
            >
              <Settings className="w-6 h-6" />
              {!collapsed && <span className="text-base">Admin</span>}
            </button>
          )}
          
          <button
            onClick={onSignOut}
            className={`w-full text-amber-900 hover:text-amber-800 hover:bg-amber-200/80 rounded-2xl transition-colors flex items-center gap-3 font-bold backdrop-blur-sm border-2 border-amber-500/70 bg-amber-100/70 shadow-lg ${
              collapsed ? 'p-4 justify-center' : 'py-4 px-5'
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
          <div className="bg-white rounded-2xl p-10 max-w-md w-full mx-4 shadow-2xl border-3 border-gray-200">
            <div className="flex items-center gap-5 mb-8">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center border-3 border-red-200">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Delete Chat</h3>
                <p className="text-base text-gray-600 font-medium">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-2xl p-5 mb-8 border-2 border-gray-200">
              <p className="text-base text-gray-700 font-semibold">
                <strong>Chat:</strong> {chats.find(c => c.id === showDeleteConfirm)?.chat_title}
              </p>
              <p className="text-sm text-gray-500 mt-3 font-medium">
                All messages, members, and related data will be permanently deleted.
              </p>
            </div>
            
            <div className="flex gap-5 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-8 py-4 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors font-bold border-2 border-gray-300"
                disabled={deletingChatId === showDeleteConfirm}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteChat(showDeleteConfirm)}
                disabled={deletingChatId === showDeleteConfirm}
                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl transition-colors disabled:opacity-50 flex items-center gap-3 font-bold shadow-xl"
              >
                {deletingChatId === showDeleteConfirm ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-6 h-6" />
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