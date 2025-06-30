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

  // Post-it note colors - realistic sticky note palette
  const postItColors = [
    'bg-yellow-200 border-yellow-300', // Classic yellow
    'bg-pink-200 border-pink-300',     // Pink
    'bg-blue-200 border-blue-300',     // Blue
    'bg-green-200 border-green-300',   // Green
    'bg-orange-200 border-orange-300', // Orange
    'bg-purple-200 border-purple-300', // Purple
    'bg-teal-200 border-teal-300',     // Teal
    'bg-red-200 border-red-300',       // Red
  ];

  // Slight rotation angles for natural post-it look
  const rotations = [
    'rotate-1', '-rotate-1', 'rotate-2', '-rotate-2', 
    'rotate-0', '-rotate-1', 'rotate-1', '-rotate-2'
  ];

  const getPostItStyle = (index: number, isSelected: boolean) => {
    const colorClass = postItColors[index % postItColors.length];
    const rotationClass = rotations[index % rotations.length];
    
    return {
      colorClass: isSelected ? 'bg-yellow-300 border-yellow-400' : colorClass,
      rotationClass: isSelected ? 'rotate-0' : rotationClass
    };
  };

  return (
    <div className={`h-screen flex flex-col transition-all duration-300 relative ${
      collapsed ? 'w-20' : 'w-80'
    }`}
    style={{
      backgroundImage: 'url(/Folder.png)',
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
              <div className="bg-gradient-to-br from-blue-500 to-teal-500 p-2 rounded-lg">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-gray-900">AI Workspace</h1>
                {profile && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {profile.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm text-gray-600">{profile.username || 'User'}</span>
                    <span className="text-xs text-gray-500">• {profile.credits_balance} credits</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Chat List - Post-it Notes Style */}
        <div className="flex-1 overflow-y-auto px-3 space-y-3 mt-6" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {chats.map((chat, index) => {
            const { colorClass, rotationClass } = getPostItStyle(index, currentChat?.id === chat.id);
            
            return (
              <div
                key={chat.id}
                className={`cursor-pointer transition-all duration-200 relative group ${
                  deletingChatId === chat.id ? 'opacity-50 pointer-events-none' : ''
                }`}
                onClick={() => onChatSelect(chat)}
                onMouseEnter={() => setHoveredChat(chat.id)}
                onMouseLeave={() => setHoveredChat(null)}
              >
                {/* Post-it Note */}
                <div className={`
                  ${colorClass} 
                  ${rotationClass}
                  p-4 
                  border-2 
                  shadow-md 
                  hover:shadow-lg 
                  transition-all 
                  duration-200 
                  transform 
                  hover:scale-105 
                  hover:rotate-0
                  relative
                  min-h-[80px]
                  ${currentChat?.id === chat.id ? 'shadow-lg scale-105 z-10' : ''}
                `}
                style={{
                  background: `linear-gradient(135deg, ${colorClass.includes('yellow') ? '#fef3c7' : 
                    colorClass.includes('pink') ? '#fce7f3' :
                    colorClass.includes('blue') ? '#dbeafe' :
                    colorClass.includes('green') ? '#d1fae5' :
                    colorClass.includes('orange') ? '#fed7aa' :
                    colorClass.includes('purple') ? '#e9d5ff' :
                    colorClass.includes('teal') ? '#ccfbf1' :
                    '#fecaca'} 0%, ${colorClass.includes('yellow') ? '#fde68a' : 
                    colorClass.includes('pink') ? '#f9a8d4' :
                    colorClass.includes('blue') ? '#93c5fd' :
                    colorClass.includes('green') ? '#6ee7b7' :
                    colorClass.includes('orange') ? '#fdba74' :
                    colorClass.includes('purple') ? '#c4b5fd' :
                    colorClass.includes('teal') ? '#5eead4' :
                    '#fca5a5'} 100%)`,
                  boxShadow: currentChat?.id === chat.id 
                    ? '0 8px 25px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.1)' 
                    : '0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
                }}
              >
                {/* Tape effect at top */}
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-8 h-4 bg-white bg-opacity-60 rounded-sm shadow-sm border border-gray-200"></div>
                
                {!collapsed && (
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 pr-2">
                        <h3 className="text-sm font-bold text-gray-800 leading-tight mb-1 font-handwriting">
                          {chat.chat_title.length > 25 ? chat.chat_title.substring(0, 25) + '...' : chat.chat_title}
                        </h3>
                        <div className="text-xs text-gray-600 font-medium">
                          {new Date(chat.updated_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </div>
                      </div>
                      
                      {canDeleteChat(chat) && (
                        <button
                          onClick={(e) => handleChatMenuClick(e, chat.id)}
                          className="p-1 hover:bg-black hover:bg-opacity-10 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0"
                          disabled={deletingChatId === chat.id}
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>
                      )}
                    </div>
                    
                    {onlineUsers.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <Users className="w-3 h-3 text-gray-600" />
                        <span className="text-xs text-gray-600 font-medium">{onlineUsers.length} online</span>
                      </div>
                    )}
                  </>
                )}

                {showChatMenu === chat.id && (
                  <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-20 min-w-36">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(chat.id);
                        setShowChatMenu(null);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-lg font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Chat
                    </button>
                  </div>
                )}
              </div>
            </div>
          );})}

          {/* New Chat Button - Special Post-it Style */}
          <button
            onClick={onNewChat}
            className="w-full p-4 bg-gradient-to-br from-emerald-200 to-emerald-300 border-2 border-emerald-400 text-emerald-800 rounded-sm shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 hover:rotate-0 rotate-1 min-h-[80px] flex flex-col items-center justify-center gap-2 relative"
            style={{
              background: 'linear-gradient(135deg, #d1fae5 0%, #6ee7b7 100%)',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
            }}
          >
            {/* Tape effect */}
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-8 h-4 bg-white bg-opacity-60 rounded-sm shadow-sm border border-gray-200"></div>
            
            <Plus className="w-6 h-6 text-emerald-700" />
            {!collapsed && <span className="text-sm font-bold text-emerald-800">New Chat</span>}
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="p-3 space-y-3" style={{ marginTop: 'auto' }}>
          {/* Token Usage Indicator */}
          {subscription && !collapsed && (
            <div className="mb-4">
              <TokenUsageIndicator
                tokens={subscription.tokens}
                plan={subscription.plan}
                maxTokens={subscription.maxTokens}
                onUpgradeClick={onUpgradeClick}
              />
            </div>
          )}

          {profile?.role === 'admin' && (
            <button
              onClick={() => window.open('/admin', '_blank')}
              className={`w-full text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 ${
                collapsed ? 'p-2 justify-center' : 'py-2 px-3'
              }`}
            >
              <Settings className="w-5 h-5" />
              {!collapsed && <span>Admin</span>}
            </button>
          )}
          
          <button
            onClick={onSignOut}
            className={`w-full text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 ${
              collapsed ? 'p-2 justify-center' : 'py-2 px-3'
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
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