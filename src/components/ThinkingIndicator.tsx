import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, Clock } from 'lucide-react';

interface ThinkingIndicatorProps {
  modelName?: string;
  visible: boolean;
  className?: string;
}

export function ThinkingIndicator({ 
  modelName = 'AI', 
  visible, 
  className = '' 
}: ThinkingIndicatorProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!visible) {
      setElapsedTime(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  return (
    <div className={`flex items-center justify-center p-6 ${className}`}>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 max-w-sm w-full">
        <div className="flex flex-col items-center space-y-4">
          {/* Animated thinking indicator */}
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Bot className="w-8 h-8 text-white" />
            </div>
            
            {/* Pulsing rings */}
            <div className="absolute inset-0 rounded-full border-4 border-purple-300 animate-ping opacity-20"></div>
            <div className="absolute inset-2 rounded-full border-2 border-purple-400 animate-pulse opacity-40"></div>
            
            {/* Sparkles */}
            <div className="absolute -top-1 -right-1">
              <Sparkles className="w-5 h-5 text-yellow-400 animate-bounce" />
            </div>
          </div>

          {/* Model name and status */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {modelName} is thinking...
            </h3>
            <p className="text-sm text-gray-600">
              Generating your response
            </p>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-mono text-gray-700">
              {formatTime(elapsedTime)}
            </span>
          </div>

          {/* Loading dots */}
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}