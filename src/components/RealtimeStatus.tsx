import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RealtimeStatusProps {
  className?: string;
}

export function RealtimeStatus({ className = '' }: RealtimeStatusProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const [lastPing, setLastPing] = useState<Date | null>(null);

  useEffect(() => {
    // Test real-time connection
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.rpc('test_realtime_connection');
        if (error) throw error;
        
        setIsConnected(true);
        setLastPing(new Date());
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Real-time connection test failed:', error);
        setIsConnected(false);
        setConnectionStatus('error');
      }
    };

    // Test connection immediately
    testConnection();

    // Set up a simple real-time test channel
    const testChannel = supabase.channel('realtime_test', {
      config: {
        broadcast: { self: true }
      }
    });

    testChannel
      .on('broadcast', { event: 'ping' }, () => {
        setIsConnected(true);
        setLastPing(new Date());
        setConnectionStatus('connected');
      })
      .subscribe((status) => {
        console.log('Real-time test channel status:', status);
        setConnectionStatus(status);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          // Send a test ping every 30 seconds
          const pingInterval = setInterval(() => {
            testChannel.send({
              type: 'broadcast',
              event: 'ping',
              payload: { timestamp: new Date().toISOString() }
            });
          }, 30000);

          return () => clearInterval(pingInterval);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
        }
      });

    return () => {
      testChannel.unsubscribe();
    };
  }, []);

  const getStatusColor = () => {
    if (isConnected) return 'text-green-500';
    if (connectionStatus === 'connecting') return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusIcon = () => {
    if (isConnected) return <Wifi className="w-4 h-4" />;
    if (connectionStatus === 'connecting') return <AlertCircle className="w-4 h-4" />;
    return <WifiOff className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (isConnected) return 'Real-time connected';
    if (connectionStatus === 'connecting') return 'Connecting...';
    return 'Real-time disconnected';
  };

  return (
    <div className={`flex items-center gap-2 text-xs ${getStatusColor()} ${className}`}>
      {getStatusIcon()}
      <span>{getStatusText()}</span>
      {lastPing && (
        <span className="text-gray-500">
          • Last: {lastPing.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}