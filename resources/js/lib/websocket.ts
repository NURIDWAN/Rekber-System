import Pusher from 'pusher-js';
import { log } from './logger';

// ===== LEGACY PUSHER SUPPORT (BACKWARD COMPATIBILITY) =====

// Pusher configuration (explicit host/port to match backend)
const scheme = import.meta.env.VITE_PUSHER_SCHEME || 'https';
const port = Number(import.meta.env.VITE_PUSHER_PORT || (scheme === 'https' ? 443 : 80));
const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1';
const host = import.meta.env.VITE_PUSHER_HOST || undefined;
const pusherKey = import.meta.env.VITE_PUSHER_APP_KEY || 'your-pusher-key';

// Initialize Pusher
const pusher = new Pusher(pusherKey, {
  cluster,
  wsHost: host || `ws-${cluster}.pusher.com`,
  wsPort: port,
  wssPort: port,
  forceTLS: scheme === 'https',
  enabledTransports: ['ws', 'wss'],
  disableStats: true,
});

// Debug state changes to inspect connection lifecycle
pusher.connection.bind('state_change', (state: any) => {
  console.info('[Pusher] state change', state.previous, '->', state.current);
});

// Room event types (legacy)
export interface RoomMessageEvent {
  id: number;
  room_id: number;
  sender_role: string;
  sender_name: string;
  message: string;
  type: 'text' | 'image' | 'system';
  created_at: string;
}

export interface RoomUserStatusEvent {
  room_id: number;
  user_id: number;
  user_name: string;
  role: string;
  is_online: boolean;
  last_seen: string;
}

export interface RoomActivityEvent {
  room_id: number;
  action: string;
  user_name: string;
  role: string;
  description: string;
  timestamp: string;
}

export interface RoomStatusChangeEvent {
  room_id: number;
  status: string;
  has_buyer: boolean;
  has_seller: boolean;
  available_for_buyer: boolean;
  available_for_seller: boolean;
  user_name: string;
  role: string;
  action: 'user_joined' | 'user_left' | 'room_updated';
}

// Legacy Pusher functions
export const subscribeToRoom = (roomId: number) => {
  const channelName = `room-${roomId}`;
  return pusher.subscribe(channelName);
};

export const unsubscribeFromRoom = (roomId: number) => {
  const channelName = `room-${roomId}`;
  pusher.unsubscribe(channelName);
};

export const listenToMessages = (roomId: number, callback: (message: RoomMessageEvent) => void) => {
  const channel = pusher.subscribe(`room-${roomId}`);
  const handler = (msg: RoomMessageEvent) => {
    console.log('[Pusher] new-message', msg);
    callback(msg);
  };
  channel.bind('new-message', handler);
  return () => channel.unbind('new-message', handler);
};

export const listenToUserStatus = (roomId: number, callback: (status: RoomUserStatusEvent) => void) => {
  const channel = pusher.subscribe(`room-${roomId}`);
  const handler = (status: RoomUserStatusEvent) => {
    console.log('[Pusher] user-status-changed', status);
    callback(status);
  };
  channel.bind('user-status-changed', handler);
  return () => channel.unbind('user-status-changed', handler);
};

export const listenToActivities = (roomId: number, callback: (activity: RoomActivityEvent) => void) => {
  const channel = pusher.subscribe(`room-${roomId}`);
  const handler = (activity: RoomActivityEvent) => {
    console.log('[Pusher] new-activity', activity);
    callback(activity);
  };
  channel.bind('new-activity', handler);
  return () => channel.unbind('new-activity', handler);
};

export const listenToFileUploads = (roomId: number, callback: (file: any) => void) => {
  const channel = pusher.subscribe(`room-${roomId}`);
  channel.bind('file-uploaded', callback);
  return () => channel.unbind('file-uploaded', callback);
};

export const listenToRoomStatusChanges = (callback: (status: RoomStatusChangeEvent) => void) => {
  try {
    const channel = pusher.subscribe('rooms-status');
    channel.bind('room-status-changed', callback);
    return () => channel.unbind('room-status-changed', callback);
  } catch (error) {
    console.warn('Failed to subscribe to room status changes via Pusher, using fallback:', error);

    // Fallback: Set up periodic polling
    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      intervalId = setInterval(async () => {
        try {
          // Fallback to HTTP polling for room status updates
          const response = await fetch('/api/rooms/status');
          if (response.ok) {
            const updates = await response.json();
            if (updates && updates.length > 0) {
              updates.forEach((update: RoomStatusChangeEvent) => {
                callback(update);
              });
            }
          }
        } catch (pollError) {
          console.warn('Fallback polling failed:', pollError);
        }
      }, 5000); // Poll every 5 seconds
    };

    // Start polling immediately
    startPolling();

    // Return cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }
};

export const getConnectionStatus = () => {
  try {
    return pusher.connection.state;
  } catch (error) {
    console.warn('Failed to get Pusher connection status:', error);
    return 'disconnected';
  }
};

export const onConnectionEstablished = (callback: () => void) => {
  try {
    pusher.connection.bind('connected', callback);
    return () => pusher.connection.unbind('connected', callback);
  } catch (error) {
    console.warn('Failed to bind to Pusher connection events:', error);
    // Return a no-op function as fallback
    return () => {};
  }
};

export const onConnectionError = (callback: (error: any) => void) => {
  try {
    pusher.connection.bind('error', callback);
    return () => pusher.connection.unbind('error', callback);
  } catch (error) {
    console.warn('Failed to bind to Pusher error events:', error);
    // Call the callback immediately with the error
    callback(error);
    // Return a no-op function as fallback
    return () => {};
  }
};

export const onConnectionDisconnected = (callback: () => void) => {
  try {
    pusher.connection.bind('disconnected', callback);
    return () => pusher.connection.unbind('disconnected', callback);
  } catch (error) {
    console.warn('Failed to bind to Pusher disconnect events:', error);
    // Return a no-op function as fallback
    return () => {};
  }
};

export const triggerTyping = (roomId: number, userRole: string, userName: string) => {
  const channel = pusher.channel(`room-${roomId}`);
  if (channel) {
    channel.trigger('client-typing', {
      user_role: userRole,
      user_name: userName,
      timestamp: new Date().toISOString(),
    });
  }
};

export const stopTyping = (roomId: number, userRole: string, userName: string) => {
  const channel = pusher.channel(`room-${roomId}`);
  if (channel) {
    channel.trigger('client-stop-typing', {
      user_role: userRole,
      user_name: userName,
      timestamp: new Date().toISOString(),
    });
  }
};

export const listenToTyping = (roomId: number, callback: (data: any) => void) => {
  const channel = pusher.subscribe(`room-${roomId}`);
  channel.bind('client-typing', callback);
  return () => channel.unbind('client-typing', callback);
};

export const listenToStopTyping = (roomId: number, callback: (data: any) => void) => {
  const channel = pusher.subscribe(`room-${roomId}`);
  channel.bind('client-stop-typing', callback);
  return () => channel.unbind('client-stop-typing', callback);
};

// ===== NEW ENHANCED WEBSOCKET CLIENT =====

interface WebSocketConfig {
  url: string;
  roomId: string;
  userId: string;
  token?: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
}

interface WebSocketMessage {
  id: string;
  room_id: string;
  user_id: string;
  message: string;
  type: 'message' | 'typing' | 'activity' | 'file' | 'voice' | 'video';
  timestamp: string;
  status: string;
  data?: any;
}

interface ConnectionStatus {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
  lastConnected?: Date;
  lastDisconnected?: Date;
  reconnectAttempts: number;
  totalReconnects: number;
  latency?: number;
}

interface MessageQueue {
  messages: WebSocketMessage[];
  failed: WebSocketMessage[];
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private status: ConnectionStatus = {
    status: 'disconnected',
    reconnectAttempts: 0,
    totalReconnects: 0
  };
  private messageQueue: MessageQueue = {
    messages: [],
    failed: []
  };
  private listeners: Map<string, Function[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pingTimeout: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    this.config = {
      ...config,
      reconnectAttempts: config.reconnectAttempts || 10,
      reconnectInterval: config.reconnectInterval || 1000,
      maxReconnectInterval: config.maxReconnectInterval || 30000
    };

    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    this.on('open', this.handleOpen.bind(this));
    this.on('message', this.handleMessage.bind(this));
    this.on('close', this.handleClose.bind(this));
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.updateStatus('connecting');
      const connectionId = `client_${this.config.roomId}_${this.config.userId}`;
      log.ws.connection(connectionId, 'connecting', { url: this.config.url });

      try {
        const wsUrl = this.buildWebSocketUrl();
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = (event) => {
          this.handleOpen(event);
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          this.handleClose(event);
        };

        this.ws.onerror = (event) => {
          this.handleError(event);
          reject(new Error('WebSocket connection failed'));
        };

      } catch (error) {
        this.updateStatus('error');
        reject(error);
      }
    });
  }

  private buildWebSocketUrl(): string {
    // Ensure the URL has the /ws path
    let baseUrl = this.config.url;
    if (!baseUrl.endsWith('/ws')) {
      baseUrl = baseUrl.replace(/\/$/, '') + '/ws';
    }

    const wsUrl = new URL(baseUrl);

    if (this.config.token) {
      wsUrl.searchParams.set('token', this.config.token);
    }

    wsUrl.searchParams.set('room_id', this.config.roomId);
    wsUrl.searchParams.set('user_id', this.config.userId);

    return wsUrl.toString();
  }

  private handleOpen(event: Event) {
    const connectionId = `client_${this.config.roomId}_${this.config.userId}`;
    log.ws.connection(connectionId, 'connected', {
      url: this.config.url,
      roomId: this.config.roomId,
      userId: this.config.userId
    });

    this.updateStatus('connected');
    this.status.lastConnected = new Date();
    this.status.reconnectAttempts = 0;

    this.authenticate();
    this.joinRoom();
    this.startHeartbeat();
    this.processMessageQueue();

    this.emit('connected', {
      timestamp: new Date(),
      reconnectAttempts: this.status.totalReconnects
    });
  }

  private handleMessage(event: MessageEvent) {
    const connectionId = `client_${this.config.roomId}_${this.config.userId}`;

    try {
      const data = JSON.parse(event.data);
      log.ws.message(connectionId, data.type, 'received');

      switch (data.type) {
        case 'pong':
          this.handlePong();
          break;
        case 'message':
        case 'typing':
        case 'activity':
        case 'file':
        case 'voice':
        case 'video':
          this.emit('message', data);
          break;
        case 'room_joined':
          log.ws.room(this.config.roomId, 'joined', this.config.userId);
          this.emit('roomJoined', data);
          break;
        case 'room_left':
          log.ws.room(this.config.roomId, 'left', this.config.userId);
          this.emit('roomLeft', data);
          break;
        case 'user_status':
          this.emit('userStatus', data);
          break;
        default:
          log.debug('WS-MSG', `Unknown message type: ${data.type}`, { connectionId, data });
      }
    } catch (error) {
      log.error('WS-MSG', `Failed to parse message`, { connectionId, error: error.message, data: event.data });
      this.emit('error', { type: 'parse_error', data: event.data });
    }
  }

  private handleClose(event: CloseEvent) {
    const connectionId = `client_${this.config.roomId}_${this.config.userId}`;
    log.ws.connection(connectionId, 'disconnected', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      reconnectAttempts: this.status.reconnectAttempts
    });

    this.updateStatus('disconnected');
    this.status.lastDisconnected = new Date();

    this.stopHeartbeat();

    if (!event.wasClean && this.status.reconnectAttempts < this.config.reconnectAttempts) {
      this.scheduleReconnect();
    }

    this.emit('disconnected', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });
  }

  private handleError(event: Event) {
    const connectionId = `client_${this.config.roomId}_${this.config.userId}`;
    log.ws.error(connectionId, 'Connection error', { event, url: this.config.url });
    this.updateStatus('error');
    this.emit('error', { type: 'connection_error', event });
  }

  private authenticate() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'auth',
        user_id: this.config.userId,
        token: this.config.token
      }));
    }
  }

  private joinRoom() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'join_room',
        room_id: this.config.roomId
      }));
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.ping();
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  private ping() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const startTime = Date.now();
      this.ws.send(JSON.stringify({ type: 'ping', timestamp: startTime }));

      this.pingTimeout = setTimeout(() => {
        console.warn('Ping timeout - connection may be lost');
        this.updateStatus('error');
        this.ws?.close();
      }, 10000);
    }
  }

  private handlePong() {
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  private scheduleReconnect() {
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.status.reconnectAttempts),
      this.config.maxReconnectInterval
    );

    this.updateStatus('reconnecting');
    this.status.reconnectAttempts++;
    this.status.totalReconnects++;

    const connectionId = `client_${this.config.roomId}_${this.config.userId}`;
    log.ws.reconnect(connectionId, this.status.reconnectAttempts, this.config.reconnectAttempts);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(error => {
        log.ws.error(connectionId, 'Reconnect failed', { error: error.message, attempt: this.status.reconnectAttempts });
      });
    }, delay);
  }

  private processMessageQueue() {
    while (this.messageQueue.messages.length > 0) {
      const message = this.messageQueue.messages.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  private updateStatus(status: ConnectionStatus['status']) {
    const oldStatus = this.status.status;
    this.status.status = status;

    if (oldStatus !== status) {
      this.emit('statusChange', {
        from: oldStatus,
        to: status,
        status: this.status
      });
    }
  }

  // Public API methods
  public sendMessage(message: Partial<WebSocketMessage>): boolean {
    const fullMessage: WebSocketMessage = {
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      room_id: message.room_id || this.config.roomId,
      user_id: message.user_id || this.config.userId,
      message: message.message || '',
      type: message.type || 'message',
      timestamp: message.timestamp || new Date().toISOString(),
      status: message.status || 'sending',
      data: message.data
    };

    const connectionId = `client_${this.config.roomId}_${this.config.userId}`;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(fullMessage));
        fullMessage.status = 'sent';
        log.ws.message(connectionId, fullMessage.type, 'sent');
        this.emit('messageSent', fullMessage);
        return true;
      } catch (error) {
        log.ws.error(connectionId, 'Failed to send message', { error: error.message, message: fullMessage });
        fullMessage.status = 'failed';
        this.messageQueue.failed.push(fullMessage);
        return false;
      }
    } else {
      log.debug('WS-MSG', `Message queued (not connected): ${fullMessage.type}`, { connectionId, messageType: fullMessage.type });
      this.messageQueue.messages.push(fullMessage);
      return false;
    }
  }

  public sendTypingIndicator(isTyping: boolean) {
    return this.sendMessage({
      type: 'typing',
      message: '',
      data: { is_typing: isTyping }
    });
  }

  public sendActivity(activity: string, data?: any) {
    return this.sendMessage({
      type: 'activity',
      message: activity,
      data
    });
  }

  public sendFile(file: File, metadata?: any) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const result = e.target?.result;
        if (result) {
          const success = this.sendMessage({
            type: 'file',
            message: file.name,
            data: {
              file: result,
              size: file.size,
              type: file.type,
              name: file.name,
              ...metadata
            }
          });

          if (success) {
            resolve(true);
          } else {
            reject(new Error('Failed to send file'));
          }
        }
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  public reconnect(): Promise<void> {
    this.disconnect();
    this.status.reconnectAttempts = 0;
    return this.connect();
  }

  public disconnect() {
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.updateStatus('disconnected');
  }

  // Event handling
  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }

  // Getters
  public getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public getConfig(): Required<WebSocketConfig> {
    return { ...this.config };
  }

  public getMessageQueue(): MessageQueue {
    return {
      messages: [...this.messageQueue.messages],
      failed: [...this.messageQueue.failed]
    };
  }

  public clearMessageQueue() {
    this.messageQueue = {
      messages: [],
      failed: []
    };
  }

  // Static factory method
  public static create(config: WebSocketConfig): WebSocketClient {
    return new WebSocketClient(config);
  }
}

export default WebSocketClient;
export type { WebSocketConfig, WebSocketMessage, ConnectionStatus };
