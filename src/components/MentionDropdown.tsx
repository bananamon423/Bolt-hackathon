import React from 'react';
import { Bot, Users, Hash, Zap, Clock } from 'lucide-react';

interface MentionOption {
  id: string;
  type: 'ai' | 'user' | 'channel';
  name: string;
  displayName: string;
  description?: string;
  modelId?: string;
  icon?: string;
  color?: string;
  cost?: number;
}

interface MentionDropdownProps {
  options: MentionOption[];
  selectedIndex: number;
  onSelect: (option: MentionOption) => void;
  position: { top: number; left: number };
  visible: boolean;
}

export function MentionDropdown({ 
  options, 
  selectedIndex, 
  onSelect, 
  position, 
  visible 
}: MentionDropdownProps) {
  if (!visible || options.length === 0) return null;

  const getOptionIcon = (option: MentionOption) => {
    if (option.icon) {
      return <span className="text-lg">{option.icon}</span>;
    }
    
    switch (option.type) {
      case 'ai':
        return <Bot className="w-4 h-4" />;
      case 'user':
        return <Users className="w-4 h-4" />;
      default:
        return <Hash className="w-4 h-4" />;
    }
  };

  const getOptionBadge = (option: MentionOption) => {
    if (option.type === 'ai') {
      return (
        <div className="flex items-center gap-1">
          <div className="text-xs bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {option.cost || 1}
          </div>
        </div>
      );
    }
    
    if (option.type === 'user') {
      return (
        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          Online
        </div>
      );
    }
    
    return null;
  };

  return (
    <div 
      className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto min-w-80"
      style={{ 
        top: position.top, 
        left: position.left 
      }}
    >
      <div className="p-3">
        <div className="text-xs font-semibold text-gray-500 mb-3 px-2 flex items-center gap-2">
          <Hash className="w-3 h-3" />
          Select a mention:
        </div>
        
        <div className="space-y-1">
          {options.map((option, index) => (
            <button
              key={option.id}
              onClick={() => onSelect(option)}
              className={`w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg transition-all duration-200 ${
                index === selectedIndex 
                  ? 'bg-blue-50 border-2 border-blue-200 shadow-sm' 
                  : 'border-2 border-transparent'
              }`}
            >
              <div className="flex-shrink-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium bg-gradient-to-br text-white ${
                  option.color || 'from-gray-400 to-gray-600'
                }`}>
                  {getOptionIcon(option)}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate text-sm">
                  @{option.displayName}
                </div>
                {option.description && (
                  <div className="text-xs text-gray-500 truncate mt-0.5">
                    {option.description}
                  </div>
                )}
              </div>
              
              <div className="flex-shrink-0">
                {getOptionBadge(option)}
              </div>
            </button>
          ))}
        </div>
        
        {options.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No mentions available</p>
          </div>
        )}
      </div>
    </div>
  );
}