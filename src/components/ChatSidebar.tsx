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
      backgroundImage: 'url(/Folder copy copy.png)',
      backgroundSize: '100% 100%',
      backgroundPosition: 'left top',
      backgroundRepeat: 'no-repeat',
      minHeight: '100vh',
      filter: 'contrast(1.05) brightness(1.05)',
      imageRendering: 'crisp-edges'
    }}>
      
      {/* Main folder content area - positioned to match the folder's interior */}
      <div className="h-full flex flex-col relative z-10" style={{ 
        paddingLeft: collapsed ? '12px' : '24px', 
        paddingRight: collapsed ? '12px' : '24px',
        paddingTop: '80px' 
      }}>
        
        {/* Header positioned in the folder tab area */}
        <div className="absolute top-4 left-6 right-6 flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-amber-700 to-amber-800 p-2 rounded-lg shadow-lg border border-amber-600">
                <MessageSquare className="w-5 h-5 text-amber-100" />
              </div>
              <h1 className="text-xl font-black text-amber-900 drop-shadow-lg tracking-wide uppercase">AI WORKSPACE</h1>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-amber-200/70 rounded-lg transition-colors text-amber-800 shadow-md border border-amber-400/60 bg-amber-100/50 backdrop-blur-sm"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* User Profile */}
        {!collapsed && profile && (
          <div className="px-2 pb-4 mt-4">
            <div className="flex items-center gap-3 bg-gradient-to-r from-teal-500 to-teal-600 p-4 rounded-xl shadow-xl border-2 border-teal-700">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-teal-600 font-black text-xl shadow-lg border-2 border-teal-200">
                {profile.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white uppercase tracking-wider drop-shadow-md">
                  {profile.username || 'USERNAME'}
                </p>
                <p className="text-xs text-teal-100 font-bold">
                  {profile.credits_balance} CREDITS
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chat List - positioned within the folder's main area */}
        <div className="flex-1 overflow-y-auto px-2 space-y-3" style={{ maxHeight: 'calc(100vh - 320px)' }}>
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
              <div className={`p-4 rounded-xl font-black text-white text-center uppercase tracking-wider shadow-xl border-2 transform hover:scale-105 transition-all duration-200 ${
                currentChat?.id === chat.id
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 border-yellow-600 text-black shadow-yellow-300/60'
                  : index === 0
                  ? 'bg-gradient-to-r from-green-500 to-green-600 border-green-700 shadow-green-300/60'
                  : 'bg-gradient-to-r from-cyan-500 to-cyan-600 border-cyan-700 shadow-cyan-300/60'
              } ${collapsed ? 'text-xs p-3' : 'text-sm'}`}>
                {!collapsed && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="truncate flex-1 drop-shadow-md text-sm font-black">
                        {chat.chat_title.length > 14 ? chat.chat_title.substring(0, 14) + '...' : chat.chat_title}
                      </span>
                      {canDeleteChat(chat) && (
                        <button
                          onClick={(e) => handleChatMenuClick(e, chat.id)}
                          className="ml-2 p-1 hover:bg-black/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={deletingChatId === chat.id}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-xs mt-2 opacity-90 font-bold">
                      {new Date(chat.updated_at).toLocaleDateString()}
                    </div>
                    {onlineUsers.length > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-2">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-bold">{onlineUsers.length}</span>
                      </div>
                    )}
                  </>
                )}
                
                {collapsed && (
                  <MessageSquare className="w-5 h-5 mx-auto" />
                )}

                {showChatMenu === chat.id && (
                  <div className="absolute top-full right-0 mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-xl z-10 min-w-36">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(chat.id);
                        setShowChatMenu(null);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-lg font-semibold"
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
            className="w-full p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-black uppercase tracking-wider shadow-xl border-2 border-blue-800 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-3 shadow-blue-300/60"
          >
            <Plus className="w-6 h-6" />
            {!collapsed && <span className="text-sm drop-shadow-md">New Chat</span>}
          </button>
        </div>

        {/* Bottom Actions - positioned at the bottom of the folder */}
        <div className="p-2 space-y-3" style={{ marginTop: 'auto' }}>
          {/* Token Usage Indicator */}
          {subscription && !collapsed && (
            <div className="mb-3">
              <TokenUsageIndicator
                tokens={subscription.tokens}
                plan={subscription.plan}
                maxTokens={subscription.maxTokens}
                onUpgradeClick={onUpgradeClick}
                className="bg-amber-50/95 border-2 border-amber-400/70 shadow-xl backdrop-blur-sm rounded-xl"
              />
            </div>
          )}

          {profile?.role === 'admin' && (
            <button
              onClick={() => window.open('/admin', '_blank')}
              className={`w-full text-amber-900 hover:text-amber-800 hover:bg-amber-200/70 rounded-xl transition-colors flex items-center gap-2 font-bold backdrop-blur-sm border border-amber-400/60 bg-amber-100/50 shadow-md ${
                collapsed ? 'p-3 justify-center' : 'py-3 px-4'
              }`}
            >
              <Settings className="w-5 h-5" />
              {!collapsed && <span className="text-sm">Admin</span>}
            </button>
          )}
          
          <button
            onClick={onSignOut}
            className={`w-full text-amber-900 hover:text-amber-800 hover:bg-amber-200/70 rounded-xl transition-colors flex items-center gap-2 font-bold backdrop-blur-sm border border-amber-400/60 bg-amber-100/50 shadow-md ${
              collapsed ? 'p-3 justify-center' : 'py-3 px-4'
            }`}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="text-sm">Sign Out</span>}
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