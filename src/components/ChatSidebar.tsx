import React, { useState } from 'react';
import { Plus, MessageSquare, ChevronLeft, ChevronRight, Settings, LogOut, Users } from 'lucide-react';
import { Chat, Profile } from '../lib/supabase';

interface ChatSidebarProps {
  chats: Chat[];
  currentChat: Chat | null;
  onChatSelect: (chat: Chat) => void;
  onNewChat: () => void;
  onSignOut: () => void;
  profile: Profile | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onlineUsers: string[];
}

export function ChatSidebar({ 
  chats, 
  currentChat, 
  onChatSelect, 
  onNewChat, 
  onSignOut, 
  profile,
  collapsed,
  onToggleCollapse,
  onlineUsers
}: ChatSidebarProps) {
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);

  return (
    <div className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-80'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-teal-500 p-2 rounded-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">AI Workspace</h1>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* User Profile */}
      {!collapsed && profile && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center text-white font-medium">
              {profile.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profile.username || 'User'}
              </p>
              <p className="text-xs text-gray-500">
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
          className={`w-full bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-colors flex items-center justify-center gap-2 ${
            collapsed ? 'p-3' : 'py-3 px-4'
          }`}
        >
          <Plus className="w-5 h-5" />
          {!collapsed && <span className="font-medium">New Chat</span>}
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`mx-2 mb-1 rounded-lg cursor-pointer transition-all duration-200 ${
              currentChat?.id === chat.id
                ? 'bg-blue-50 border border-blue-200'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => onChatSelect(chat)}
            onMouseEnter={() => setHoveredChat(chat.id)}
            onMouseLeave={() => setHoveredChat(null)}
          >
            <div className={`p-3 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-gray-600" />
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {chat.chat_title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(chat.updated_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              {!collapsed && onlineUsers.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-500">{onlineUsers.length}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        {profile?.role === 'admin' && (
          <button
            onClick={() => window.open('/admin', '_blank')}
            className={`w-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 ${
              collapsed ? 'p-3 justify-center' : 'py-2 px-3'
            }`}
          >
            <Settings className="w-5 h-5" />
            {!collapsed && <span>Admin</span>}
          </button>
        )}
        <button
          onClick={onSignOut}
          className={`w-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 ${
            collapsed ? 'p-3 justify-center' : 'py-2 px-3'
          }`}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
}