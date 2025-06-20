import { useState, useEffect, useRef } from 'react';

interface MentionOption {
  id: string;
  type: 'ai' | 'user' | 'channel';
  name: string;
  displayName: string;
  description?: string;
}

interface UseMentionsProps {
  onlineUsers?: string[];
  creditsBalance: number;
}

export function useMentions({ onlineUsers = [], creditsBalance }: UseMentionsProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionOptions, setMentionOptions] = useState<MentionOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Define available mention options
  const getAllMentionOptions = (): MentionOption[] => {
    const options: MentionOption[] = [];

    // Add AI bot option (always available if user has credits)
    if (creditsBalance > 0) {
      options.push({
        id: 'gwiz',
        type: 'ai',
        name: 'Gwiz',
        displayName: 'Gwiz',
        description: 'AI Assistant - Ask me anything!'
      });
    }

    // Add online users (if any)
    onlineUsers.forEach((userId, index) => {
      options.push({
        id: userId,
        type: 'user',
        name: `user${index + 1}`,
        displayName: `User ${index + 1}`,
        description: 'Online now'
      });
    });

    // Add common channels/commands
    options.push(
      {
        id: 'everyone',
        type: 'channel',
        name: 'everyone',
        displayName: 'everyone',
        description: 'Notify everyone in the chat'
      },
      {
        id: 'here',
        type: 'channel',
        name: 'here',
        displayName: 'here',
        description: 'Notify everyone currently online'
      }
    );

    return options;
  };

  const filterOptions = (query: string): MentionOption[] => {
    const allOptions = getAllMentionOptions();
    if (!query) return allOptions;

    return allOptions.filter(option =>
      option.name.toLowerCase().includes(query.toLowerCase()) ||
      option.displayName.toLowerCase().includes(query.toLowerCase())
    );
  };

  const handleTextChange = (text: string, cursorPosition: number) => {
    const beforeCursor = text.substring(0, cursorPosition);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      const filteredOptions = filterOptions(query);
      
      setMentionQuery(query);
      setMentionOptions(filteredOptions);
      setSelectedIndex(0);
      setShowDropdown(true);

      // Calculate dropdown position
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const rect = textarea.getBoundingClientRect();
        const textBeforeMention = beforeCursor.substring(0, mentionMatch.index);
        
        // Approximate position calculation
        const lineHeight = 20;
        const charWidth = 8;
        const lines = textBeforeMention.split('\n');
        const currentLine = lines.length - 1;
        const currentLineLength = lines[lines.length - 1].length;
        
        setDropdownPosition({
          top: rect.top - 200 + (currentLine * lineHeight),
          left: rect.left + (currentLineLength * charWidth)
        });
      }
    } else {
      setShowDropdown(false);
      setMentionQuery('');
      setMentionOptions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentText: string, cursorPosition: number) => {
    if (!showDropdown) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % mentionOptions.length);
        return true;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev === 0 ? mentionOptions.length - 1 : prev - 1);
        return true;
      
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (mentionOptions[selectedIndex]) {
          const selectedOption = mentionOptions[selectedIndex];
          return handleMentionSelect(selectedOption, currentText, cursorPosition);
        }
        return true;
      
      case 'Escape':
        setShowDropdown(false);
        return true;
      
      default:
        return false;
    }
  };

  const handleMentionSelect = (option: MentionOption, currentText: string, cursorPosition: number) => {
    const beforeCursor = currentText.substring(0, cursorPosition);
    const afterCursor = currentText.substring(cursorPosition);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const beforeMention = beforeCursor.substring(0, mentionMatch.index);
      const mentionText = option.type === 'ai' ? `@${option.name} ` : `@${option.name} `;
      const newText = beforeMention + mentionText + afterCursor;
      const newCursorPosition = beforeMention.length + mentionText.length;

      setShowDropdown(false);
      setMentionQuery('');
      setMentionOptions([]);

      return {
        newText,
        newCursorPosition,
        isAIMention: option.type === 'ai'
      };
    }

    return null;
  };

  return {
    showDropdown,
    mentionOptions,
    selectedIndex,
    dropdownPosition,
    textareaRef,
    handleTextChange,
    handleKeyDown,
    handleMentionSelect
  };
}