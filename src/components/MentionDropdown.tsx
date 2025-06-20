import React from 'react';
import { Bot, Users, Hash } from 'lucide-react';

interface MentionOption {
  id: string;
  type: 'ai' | 'user' | 'channel';
  name: string;
  displayName: string;
  description?: string;
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

  return (
    <div 
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto min-w-64"
      style={{ 
        top: position.top, 
        left: position.left 
      }}
    >
      <div className="p-2">
        <div className="text-xs font-medium text-gray-500 mb-2 px-2">
          Select a mention:
        </div>
        {options.map((option, index) => (
          <button
            key={option.id}
            onClick={() => onSelect(option)}
            className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-50 rounded-md transition-colors ${
              index === selectedIndex ? 'bg-blue-50 border border-blue-200' : ''
            }`}
          >
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                option.type === 'ai' 
                  ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                  : option.type === 'user'
                  ? 'bg-gradient-to-br from-blue-500 to-teal-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {option.type === 'ai' ? (
                  <Bot className="w-4 h-4" />
                ) : option.type === 'user' ? (
                  <Users className="w-4 h-4" />
                ) : (
                  <Hash className="w-4 h-4" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                @{option.displayName}
              </div>
              {option.description && (
                <div className="text-xs text-gray-500 truncate">
                  {option.description}
                </div>
              )}
            </div>
            {option.type === 'ai' && (
              <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                AI
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}