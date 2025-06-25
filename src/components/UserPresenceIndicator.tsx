import React from 'react';
import { Users } from 'lucide-react';

interface UserPresenceIndicatorProps {
  onlineUsers: string[];
  currentUserId?: string;
  className?: string;
}

export function UserPresenceIndicator({ 
  onlineUsers, 
  currentUserId,
  className = '' 
}: UserPresenceIndicatorProps) {
  // Filter out the current user from the online users list
  const otherUsers = onlineUsers.filter(userId => userId !== currentUserId);
  
  if (otherUsers.length === 0) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg ${className}`}>
        <Users className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">Just you</span>
      </div>
    );
  }

  const displayUsers = otherUsers.slice(0, 3);
  const remainingCount = otherUsers.length - 3;

  // Generate user initials and colors
  const getUserInitial = (userId: string) => {
    // Extract a letter from the user ID or use a default
    return userId.charAt(0).toUpperCase() || 'U';
  };

  const getUserColor = (userId: string) => {
    // Generate a consistent color based on user ID
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500'
    ];
    
    // Simple hash function to get consistent color
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg ${className}`}>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm font-medium text-green-700">
          {otherUsers.length === 1 ? '1 other' : `${otherUsers.length} others`}
        </span>
      </div>
      
      <div className="flex items-center -space-x-1">
        {displayUsers.map((userId, index) => (
          <div
            key={userId}
            className={`w-7 h-7 rounded-full ${getUserColor(userId)} flex items-center justify-center text-white text-xs font-semibold border-2 border-white shadow-sm`}
            style={{ zIndex: displayUsers.length - index }}
            title={`User ${userId.slice(0, 8)}`}
          >
            {getUserInitial(userId)}
          </div>
        ))}
        
        {remainingCount > 0 && (
          <div
            className="w-7 h-7 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-semibold border-2 border-white shadow-sm"
            style={{ zIndex: 0 }}
            title={`${remainingCount} more user${remainingCount > 1 ? 's' : ''} online`}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    </div>
  );
}