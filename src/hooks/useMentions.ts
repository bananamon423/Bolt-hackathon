import { useState, useRef, RefObject } from 'react';

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
  textareaRef: RefObject<HTMLTextAreaElement>;
}

export function useMentions({ onlineUsers = [], creditsBalance, textareaRef }: UseMentionsProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionOptions, setMentionOptions] = useState<MentionOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

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

  const calculateDropdownPosition = (textarea: HTMLTextAreaElement, cursorPosition: number, text: string) => {
    const rect = textarea.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);
    
    // Create a temporary div to measure text
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.whiteSpace = 'pre-wrap';
    tempDiv.style.font = style.font;
    tempDiv.style.width = style.width;
    tempDiv.style.padding = style.padding;
    tempDiv.style.border = style.border;
    tempDiv.style.boxSizing = style.boxSizing;
    
    document.body.appendChild(tempDiv);
    
    const textBeforeCursor = text.substring(0, cursorPosition);
    tempDiv.textContent = textBeforeCursor;
    
    const tempRect = tempDiv.getBoundingClientRect();
    document.body.removeChild(tempDiv);
    
    // Calculate position - show above the textarea
    const top = rect.top - 200;
    const left = Math.min(rect.left + (tempRect.width % rect.width), window.innerWidth - 250);
    
    return { top, left };
  };

  const handleTextChange = (text: string, cursorPosition: number) => {
    const beforeCursor = text.substring(0, cursorPosition);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);

    if (mentionMatch && textareaRef.current) {
      const query = mentionMatch[1];
      const filteredOptions = filterOptions(query);
      
      setMentionOptions(filteredOptions);
      setSelectedIndex(0);
      setShowDropdown(true);

      // Calculate dropdown position
      const position = calculateDropdownPosition(textareaRef.current, cursorPosition, text);
      setDropdownPosition(position);
    } else {
      setShowDropdown(false);
      setMentionOptions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentText: string, cursorPosition: number) => {
    if (!showDropdown || mentionOptions.length === 0) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => (prev + 1) % mentionOptions.length);
        return true;
      
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => prev === 0 ? mentionOptions.length - 1 : prev - 1);
        return true;
      
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (mentionOptions[selectedIndex]) {
          const selectedOption = mentionOptions[selectedIndex];
          const result = handleMentionSelect(selectedOption, currentText, cursorPosition);
          if (result && textareaRef.current) {
            // Update the textarea value and cursor position
            textareaRef.current.value = result.newText;
            textareaRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
            textareaRef.current.focus();
            
            // Trigger change event to update React state
            const event = new Event('input', { bubbles: true });
            textareaRef.current.dispatchEvent(event);
          }
        }
        return true;
      
      case 'Tab':
        e.preventDefault();
        e.stopPropagation();
        if (mentionOptions[selectedIndex]) {
          const selectedOption = mentionOptions[selectedIndex];
          const result = handleMentionSelect(selectedOption, currentText, cursorPosition);
          if (result && textareaRef.current) {
            // Update the textarea value and cursor position
            textareaRef.current.value = result.newText;
            textareaRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
            textareaRef.current.focus();
            
            // Trigger change event to update React state
            const event = new Event('input', { bubbles: true });
            textareaRef.current.dispatchEvent(event);
          }
        }
        return true;
      
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
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
      const mentionText = `@${option.name} `;
      const newText = beforeMention + mentionText + afterCursor;
      const newCursorPosition = beforeMention.length + mentionText.length;

      setShowDropdown(false);
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
    handleTextChange,
    handleKeyDown,
    handleMentionSelect
  };
}