import React from 'react';
import { Zap, AlertTriangle, Crown } from 'lucide-react';

interface TokenUsageIndicatorProps {
  tokens: number;
  plan: string;
  maxTokens: number;
  className?: string;
  onUpgradeClick?: () => void;
}

export function TokenUsageIndicator({ 
  tokens, 
  plan, 
  maxTokens, 
  className = '',
  onUpgradeClick 
}: TokenUsageIndicatorProps) {
  const percentage = Math.max(0, Math.min(100, (tokens / maxTokens) * 100));
  const isLow = percentage < 20;
  const isEmpty = tokens === 0;

  const getPlanColor = () => {
    switch (plan) {
      case 'free_plan':
        return 'from-gray-500 to-gray-600';
      case 'beginner_plan':
        return 'from-blue-500 to-cyan-500';
      case 'pro_plan':
        return 'from-purple-500 to-pink-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getPlanName = () => {
    switch (plan) {
      case 'free_plan':
        return 'Free';
      case 'beginner_plan':
        return 'Beginner';
      case 'pro_plan':
        return 'Pro';
      default:
        return 'Unknown';
    }
  };

  const getProgressColor = () => {
    if (isEmpty) return 'bg-red-500';
    if (isLow) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 bg-gradient-to-br ${getPlanColor()} rounded-lg flex items-center justify-center`}>
            {plan === 'pro_plan' ? (
              <Crown className="w-4 h-4 text-white" />
            ) : (
              <Zap className="w-4 h-4 text-white" />
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{getPlanName()} Plan</div>
            <div className="text-sm text-gray-500">AI Messages</div>
          </div>
        </div>
        
        {(isEmpty || isLow) && onUpgradeClick && (
          <button
            onClick={onUpgradeClick}
            className="text-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1 rounded-full hover:from-blue-600 hover:to-cyan-600 transition-colors"
          >
            Upgrade
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Usage</span>
          <span className="font-medium text-gray-900">
            {tokens} / {maxTokens}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Status Message */}
      {isEmpty ? (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>No tokens remaining</span>
        </div>
      ) : isLow ? (
        <div className="flex items-center gap-2 text-yellow-600 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>Running low on tokens</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <Zap className="w-4 h-4" />
          <span>Tokens available</span>
        </div>
      )}
    </div>
  );
}