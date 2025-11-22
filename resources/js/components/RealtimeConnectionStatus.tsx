import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import {
  getConnectionStatus,
  onConnectionEstablished,
  onConnectionError,
  onConnectionDisconnected,
} from '@/lib/websocket';
import WebSocketClient, { ConnectionStatus as WSConnectionStatus } from '@/lib/websocket';
import { logger } from '@/lib/logger';

type ConnectionStatusType = 'connected' | 'connecting' | 'disconnected' | 'error' | 'reconnecting';

interface RealtimeConnectionStatusProps {
  wsClient?: WebSocketClient; // Optional new WebSocket client
  usePusher?: boolean; // Fallback to Pusher if no WS client
  showDetails?: boolean; // Show detailed connection info
  disabled?: boolean; // Completely disable the status display
  className?: string;
}

export default function RealtimeConnectionStatus({
  wsClient,
  usePusher = true,
  showDetails = false,
  disabled = false,
  className
}: RealtimeConnectionStatusProps) {

  // If disabled, don't render anything
  if (disabled) {
    return null;
  }
  const [status, setStatus] = useState<ConnectionStatusType>('connecting');
  const [showStatus, setShowStatus] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [latency, setLatency] = useState<number | undefined>();
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (wsClient) {
      // Use new WebSocket client
      const updateStatus = (wsStatus: WSConnectionStatus) => {
        setStatus(mapWSConnectionStatus(wsStatus.status));
        setReconnectAttempts(wsStatus.reconnectAttempts);
        setLatency(wsStatus.latency);
      };

      wsClient.on('statusChange', (data: any) => {
        updateStatus(data.status);
        if (data.to === 'connected') {
          setShowStatus(true);
          setTimeout(() => setShowStatus(false), 3000);
        } else if (data.to === 'error' || data.to === 'disconnected') {
          setShowStatus(true);
        }
      });

      wsClient.on('connected', () => {
        setStatus('connected');
        setShowStatus(true);
        setTimeout(() => setShowStatus(false), 3000);
      });

      wsClient.on('error', () => {
        setStatus('error');
        setShowStatus(true);
      });

      wsClient.on('disconnected', () => {
        setStatus('disconnected');
        setShowStatus(true);
      });

      // Initial status
      updateStatus(wsClient.getStatus());

      cleanup = () => {
        wsClient.off('statusChange');
        wsClient.off('connected');
        wsClient.off('error');
        wsClient.off('disconnected');
      };
    } else if (usePusher) {
      // Fallback to Pusher
      const currentStatus = getConnectionStatus();
      setStatus(mapConnectionStatus(currentStatus));

      const unsubscribeConnected = onConnectionEstablished(() => {
        setStatus('connected');
        setShowStatus(true);
        setTimeout(() => setShowStatus(false), 3000);
      });

      const unsubscribeError = onConnectionError(() => {
        setStatus('error');
        setShowStatus(true);
      });

      const unsubscribeDisconnected = onConnectionDisconnected(() => {
        setStatus('disconnected');
        setShowStatus(true);
      });

      cleanup = () => {
        unsubscribeConnected();
        unsubscribeError();
        unsubscribeDisconnected();
      };
    }

    return cleanup;
  }, [wsClient, usePusher]);

  const mapConnectionStatus = (pusherStatus: string): ConnectionStatusType => {
    switch (pusherStatus) {
      case 'connected':
        return 'connected';
      case 'connecting':
        return 'connecting';
      case 'failed':
      case 'unavailable':
        return 'error';
      case 'disconnected':
      default:
        return 'disconnected';
    }
  };

  const mapWSConnectionStatus = (wsStatus: WSConnectionStatus['status']): ConnectionStatusType => {
    return wsStatus;
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <Wifi className="w-4 h-4" />;
      case 'connecting':
      case 'reconnecting':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4" />;
      default:
        return <WifiOff className="w-4 h-4" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'connecting':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'reconnecting':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'disconnected':
        return 'text-gray-600 bg-gray-100 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return `Reconnecting... (${reconnectAttempts})`;
      case 'error':
        return 'Connection Error';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown Status';
    }
  };

  const handleManualReconnect = async () => {
    if (!wsClient) return;

    setIsReconnecting(true);
    try {
      await wsClient.reconnect();
    } catch (error) {
      console.error('Manual reconnect failed:', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  const canReconnect = (status === 'disconnected' || status === 'error') && wsClient;
  const alwaysShow = status === 'error' || showDetails;
  const shouldShow = alwaysShow || showStatus;

  if (!shouldShow && !showDetails) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 flex flex-col gap-2 p-3 rounded-lg border shadow-sm transition-all duration-300',
        getStatusColor(),
        shouldShow ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-xs font-medium">{getStatusText()}</span>

        {latency !== undefined && (
          <span className="text-xs opacity-75">
            {latency < 50 ? '🟢' : latency < 150 ? '🟡' : '🔴'} {latency}ms
          </span>
        )}

        {canReconnect && (
          <button
            onClick={handleManualReconnect}
            disabled={isReconnecting}
            className="text-xs underline ml-2 hover:no-underline disabled:opacity-50"
          >
            {isReconnecting ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              'Retry'
            )}
          </button>
        )}

        {status === 'error' && !wsClient && (
          <button
            onClick={() => window.location.reload()}
            className="text-xs underline ml-2 hover:no-underline"
          >
            Reload
          </button>
        )}
      </div>

      {showDetails && (
        <div className="text-xs space-y-1 border-t pt-2 mt-1">
          <div className="flex justify-between gap-4">
            <span>Connection Type:</span>
            <span className="font-medium">{wsClient ? 'WebSocket' : 'Pusher'}</span>
          </div>

          {wsClient && (
            <>
              <div className="flex justify-between gap-4">
                <span>Reconnect Attempts:</span>
                <span className="font-medium">{reconnectAttempts}</span>
              </div>

              {latency !== undefined && (
                <div className="flex justify-between gap-4">
                  <span>Latency:</span>
                  <span className="font-medium">{latency}ms</span>
                </div>
              )}

              <div className="flex justify-between gap-4">
                <span>Message Queue:</span>
                <span className="font-medium">
                  {wsClient.getMessageQueue().messages.length} queued
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
