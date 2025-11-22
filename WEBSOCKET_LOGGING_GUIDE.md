# WebSocket Connection Logging & Monitoring

This guide explains how to use the enhanced WebSocket connection logging and monitoring system to track connection status, debug issues, and avoid error spam in your terminal.

## Overview

The WebSocket logging system provides:

- **Clean Terminal Output**: Structured logging with colors and icons to reduce console spam
- **Connection Monitoring**: Real-time status tracking and metrics
- **Debug Information**: Detailed connection state and message flow
- **Error Tracking**: Organized error logging without flooding the console

## Quick Start

### 1. Start the WebSocket Server

```bash
# Start the WebSocket server with logging
npm run ws:server

# Or specify a custom port
node websocket-server.js 8080
```

### 2. Monitor Connections in Real-time

```bash
# Start the connection monitor
npm run ws:monitor

# Or with custom settings
node websocket-monitor.js --server ws://localhost:8080 --room monitor-room --interval 3
```

### 3. Test WebSocket Functionality

```bash
# Run automated tests
npm run ws:test automated

# Interactive testing mode
npm run ws:test interactive

# Load testing with multiple users
npm run ws:test load 50
```

## Log Categories & Levels

### Log Categories

- **WS-CONN**: Connection events (connect, disconnect, errors)
- **WS-MSG**: Message flow (sent, received, types)
- **WS-ERROR**: Error conditions and debugging
- **WS-RECONN**: Reconnection attempts
- **WS-ROOM**: Room-based activities

### Log Levels

```typescript
import { logger } from '@/lib/logger';

// Set minimum log level (debug, info, warn, error, success)
logger.setLogLevel('info');

// Disable console output (keep internal logs)
logger.setEnableConsole(false);
```

## Client-Side Integration

### Basic Usage

```typescript
import WebSocketClient from '@/lib/websocket';
import { log } from '@/lib/logger';

const wsClient = new WebSocketClient({
  url: 'ws://localhost:8080',
  roomId: 'room-1',
  userId: 'user-123'
});

// Connect with automatic logging
await wsClient.connect();

// Send message (automatically logged)
wsClient.sendMessage({
  type: 'message',
  message: 'Hello World!'
});
```

### Custom Logging

```typescript
import { log } from '@/lib/logger';

// Manual connection logging
log.ws.connection('client-123', 'connected', {
  url: 'ws://localhost:8080',
  timestamp: new Date()
});

// Message logging
log.ws.message('client-123', 'chat', 'sent');
log.ws.message('client-123', 'typing', 'received');

// Error logging
log.ws.error('client-123', 'Connection timeout', {
  code: 1006,
  attempt: 3
});
```

## Monitoring Tools

### 1. Connection Monitor (`websocket-monitor.js`)

Real-time WebSocket connection monitoring dashboard:

```bash
# Basic usage
node websocket-monitor.js

# Custom configuration
node websocket-monitor.js \
  --server ws://localhost:8080 \
  --room monitoring-room \
  --user monitor \
  --interval 5
```

**Features:**
- Connection status indicator
- Latency measurement
- Message count tracking
- Recent activity history
- Error monitoring

### 2. Test Suite (`websocket-test.js`)

Comprehensive WebSocket testing:

```bash
# Interactive mode
node websocket-test.js interactive

# Automated tests
node websocket-test.js automated

# Load testing
node websocket-test.js load 100
```

**Test Types:**
- Connection establishment
- Message sending/receiving
- Latency measurement
- Reconnection handling
- Load testing with multiple users

## Log Output Examples

### Clean Terminal Output

```
✅ [14:30:22] WS-CONN  Connected: client_room-1_user-123
📤 [14:30:23] WS-MSG  ↑ client_room-1_user-123: message
📥 [14:30:23] WS-MSG  ↓ client_room-1_user-123: message
⚠️  [14:30:25] WS-RECONN Reconnecting client_room-1_user-123 (1/10)
✅ [14:30:26] WS-CONN  Connected: client_room-1_user-123
```

### Server-side Logging

```
✅ [14:30:22] WS-CONN  New connection: conn_1640188222000_abc123 (User: user-123, Room: room-1)
📨 [14:30:23] WS-MSG  Received from conn_1640188222000_abc123: message
📢 [14:30:23] WS-ROOM  Broadcast to room room-1: message
```

## Configuration

### Environment Variables

```bash
# Server log level
export LOG_LEVEL=info

# WebSocket server URL
export WS_SERVER_URL=ws://localhost:8080

# Default room for testing
export WS_ROOM_ID=test-room

# Default user for testing
export WS_USER_ID=test-user
```

### Client Configuration

```typescript
// Configure logger
import { logger } from '@/lib/logger';

logger.setLogLevel('info');        // Minimum log level
logger.setEnableConsole(true);     // Show/hide console output

// WebSocket client with custom settings
const wsClient = new WebSocketClient({
  url: 'ws://localhost:8080',
  roomId: 'my-room',
  userId: 'my-user',
  reconnectAttempts: 10,           // Max reconnection attempts
  reconnectInterval: 1000,         // Initial reconnect delay (ms)
  maxReconnectInterval: 30000      // Maximum reconnect delay (ms)
});
```

## Troubleshooting

### Common Issues

1. **Connection Timeouts**
   ```
   ❌ [14:30:22] WS-ERROR Connection client_123: Connection timeout
   ```
   - Check if WebSocket server is running
   - Verify server URL and port
   - Check network connectivity

2. **Missing Parameters**
   ```
   ❌ [14:30:22] WS-CONN Missing required parameters
   ```
   - Ensure `room_id` and `user_id` are provided
   - Check WebSocket URL construction

3. **Reconnection Loops**
   ```
   ⚠️ [14:30:22] WS-RECONN Reconnecting client_123 (10/10)
   ```
   - Server may be down
   - Network connectivity issues
   - Authentication problems

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
// Enable debug logging
logger.setLogLevel('debug');

// Get connection logs
const wsLogs = logger.getLogs('debug', 'WS-CONN');
console.log('WebSocket logs:', wsLogs);

// Get status summary
const summary = logger.getWebSocketStatusSummary();
console.log('Status:', summary);
```

### Performance Monitoring

Monitor WebSocket performance:

```typescript
// Get client metrics
const metrics = wsClient.getMetrics();
console.log('Connection metrics:', {
  reconnectAttempts: metrics.reconnectAttempts,
  totalReconnects: metrics.totalReconnects,
  messageQueue: wsClient.getMessageQueue()
});

// Get WebSocket status summary
const summary = logger.getWebSocketStatusSummary();
console.log('Summary:', summary);
```

## Best Practices

### 1. Log Level Management
- Use `info` level for production
- Use `debug` level during development
- Set appropriate levels to avoid console spam

### 2. Error Handling
- Log errors with context information
- Don't log sensitive data (tokens, passwords)
- Use structured error messages

### 3. Performance
- Limit log storage size
- Export logs periodically for analysis
- Use log levels to filter output

### 4. Monitoring
- Use the connection monitor for real-time status
- Set up automated testing for critical paths
- Monitor error rates and reconnection patterns

## API Reference

### Logger Class

```typescript
class Logger {
  setLogLevel(level: LogLevel): void
  setEnableConsole(enable: boolean): void

  // Logging methods
  debug(category: string, message: string, data?: any): void
  info(category: string, message: string, data?: any): void
  warn(category: string, message: string, data?: any): void
  error(category: string, message: string, data?: any): void
  success(category: string, message: string, data?: any): void

  // WebSocket specific
  websocketConnection(connectionId: string, status: string, details?: any): void
  websocketMessage(connectionId: string, type: string, direction: string): void
  websocketError(connectionId: string, error: string, details?: any): void

  // Utility methods
  getLogs(level?: LogLevel, category?: string): LogEntry[]
  clearLogs(): void
  exportLogs(): string
  getWebSocketStatusSummary(): StatusSummary
}
```

### WebSocket Client

```typescript
class WebSocketClient {
  connect(): Promise<void>
  disconnect(): void
  sendMessage(message: Partial<WebSocketMessage>): boolean
  getStatus(): ConnectionStatus
  getMetrics(): ClientMetrics
  getMessageQueue(): MessageQueue
  reconnect(): Promise<void>
}
```

For more information, see the inline documentation in the source files.