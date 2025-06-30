import { useState, useRef, RefObject } from 'react';
import { OPENROUTER_MODELS, OpenRouterModelId } from '../lib/supabase';

interface MentionOption {
  id: string;
  type: 'ai' | 'user' | 'channel';
  name: string;
  displayName: string;
  description?: string;
  modelId?: OpenRouterModelId;
  icon?: string;
  color?: string;
  cost?: number;
}

interface UseMentionsProps {
  onlineUsers?: string[];
  creditsBalance: number;
  textareaRef: RefObject<HTMLTextAreaElement>;
  availableModels?: Array<{
    id: string;
    model_name: string;
    api_identifier: string;
    cost_per_token: number;
  }>;
}

export function useMentions({ 
  onlineUsers = [], 
  creditsBalance, 
  textareaRef,
  availableModels = []
}: UseMentionsProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionOptions, setMentionOptions] = useState<MentionOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Define available mention options
  const getAllMentionOptions = (): MentionOption[] => {
    const options: MentionOption[] = [];

    // Add AI models from database - use actual model data
    availableModels.forEach(model => {
      if (creditsBalance >= model.cost_per_token) {
        const modelConfig = OPENROUTER_MODELS[model.api_identifier as OpenRouterModelId];
        
        // For models with OpenRouter config, use that info
        if (modelConfig) {
          options.push({
            id: model.id, // Use actual UUID from database
            type: 'ai',
            name: model.model_name, // Use model_name for matching
            displayName: modelConfig.name,
            description: `${model.cost_per_token} credit${model.cost_per_token > 1 ? 's' : ''}`,
            modelId: model.api_identifier as OpenRouterModelId,
            icon: modelConfig.icon,
            color: modelConfig.color,
            cost: model.cost_per_token
          });
        } else {
          // For models without OpenRouter config (like Gwiz), use basic info
          options.push({
            id: model.id, // Use actual UUID from database
            type: 'ai',
            name: model.model_name, // Use model_name for matching
            displayName: model.model_name,
            description: `${model.cost_per_token} credit${model.cost_per_token > 1 ? 's' : ''}`,
            icon: '🤖',
            color: 'from-purple-500 to-pink-500',
            cost: model.cost_per_token
          });
        }
      }
    });

    // Add online users (if any)
    onlineUsers.forEach((userId, index) => {
      options.push({
        id: userId,
        type: 'user',
        name: `user${index + 1}`,
        displayName: `User ${index + 1}`,
        description: 'Online now',
        icon: '👤',
        color: 'from-blue-500 to-teal-500'
      });
    });

    // Add common channels/commands
    options.push(
      {
        id: 'everyone',
        type: 'channel',
        name: 'everyone',
        displayName: 'everyone',
        description: 'Notify everyone in the chat',
        icon: '📢',
        color: 'from-gray-400 to-gray-600'
      },
      {
        id: 'here',
        type: 'channel',
        name: 'here',
        displayName: 'here',
        description: 'Notify everyone currently online',
        icon: '📍',
        color: 'from-gray-400 to-gray-600'
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
    const top = rect.top - Math.min(250, window.innerHeight * 0.3);
    const left = Math.min(rect.left + (tempRect.width % rect.width), window.innerWidth - 320);
    
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
      case 'Tab':
        e.preventDefault();
        e.stopPropagation();
        if (mentionOptions[selectedIndex]) {
          const selectedOption = mentionOptions[selectedIndex];
          const result = handleMentionSelect(selectedOption, currentText, cursorPosition);
          if (result && textareaRef.current) {
            // Update the textarea value directly first
            textareaRef.current.value = result.newText;
            
            // Set cursor position
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
                textareaRef.current.focus();
                
                // Trigger input event to sync with React state
                const inputEvent = new Event('input', { bubbles: true });
                textareaRef.current.dispatchEvent(inputEvent);
              }
            }, 0);
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
      
      // Use the model name for AI mentions
      const mentionText = option.type === 'ai' 
        ? `@${option.name} `  // Use option.name (which is model_name from database)
        : `@${option.name} `;
      
      const newText = beforeMention + mentionText + afterCursor;
      const newCursorPosition = beforeMention.length + mentionText.length;

      setShowDropdown(false);
      setMentionOptions([]);

      return {
        newText,
        newCursorPosition,
        isAIMention: option.type === 'ai',
        selectedModel: option.type === 'ai' ? {
          id: option.id, // This is now the actual UUID from database
          name: option.name, // This is the model_name from database
          apiIdentifier: option.modelId || option.name,
          cost: option.cost || 1
        } : null
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