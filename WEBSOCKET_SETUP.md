# WebSocket Real-Time Chat Setup Guide

## Overview

This document explains how to set up and configure the real-time WebSocket chat functionality using Pusher in your Laravel + React application.

## Architecture

The real-time system consists of:

1. **Backend (Laravel)**:
   - Event classes for broadcasting
   - Pusher configuration
   - WebSocket event triggers

2. **Frontend (React)**:
   - Pusher client integration
   - Real-time listeners
   - Connection status management
   - Live updates for messages, user status, and activities

## Setup Instructions

### 1. Pusher Account Setup

1. Create a free account at [Pusher.com](https://pusher.com/)
2. Create a new app and select "Channels" product
3. Note down your App ID, Key, and Secret
4. Choose your app cluster (usually `mt1` for free tier)

### 2. Backend Configuration

#### Update Environment Variables

Add these to your `.env` file:

```env
# Enable broadcasting
BROADCAST_CONNECTION=pusher

# Pusher Configuration
PUSHER_APP_ID=your-pusher-app-id
PUSHER_APP_KEY=your-pusher-key
PUSHER_APP_SECRET=your-pusher-secret
PUSHER_HOST=
PUSHER_PORT=443
PUSHER_SCHEME=https
PUSHER_APP_CLUSTER=mt1
PUSHER_VERIFY_PEER=false

# Frontend access
VITE_PUSHER_APP_KEY="${PUSHER_APP_KEY}"
VITE_PUSHER_APP_CLUSTER="${PUSHER_APP_CLUSTER}"
```

#### Install Backend Dependencies

```bash
composer require pusher/pusher-php-server pusher/pusher-http-laravel
```

#### Enable Broadcasting

In `config/broadcasting.php`, ensure Pusher is configured correctly.

### 3. Frontend Configuration

The Pusher client is already integrated in `resources/js/lib/websocket.ts` with these features:

- **Message Broadcasting**: Real-time message updates
- **User Status**: Online/offline status tracking
- **Activity Logging**: Real-time activity feed
- **File Uploads**: Live file upload notifications
- **Connection Management**: Automatic reconnection and status indicators

### 4. Real-Time Features

#### Messages
- ✅ Real-time message delivery
- ✅ Message history persistence
- ✅ File/image sharing support
- ✅ System messages for uploads

#### User Status
- ✅ Online/offline indicators
- ✅ User join/leave notifications
- ✅ Role-based status display

#### Activity Feed
- ✅ Real-time activity logging
- ✅ Room join events
- ✅ File upload notifications
- ✅ Message events

#### Connection Management
- ✅ Automatic reconnection
- ✅ Connection status indicators
- ✅ Error handling and retry

### 5. Usage Examples

#### Listening to Messages
```typescript
import { listenToMessages } from '@/lib/websocket';

const unsubscribe = listenToMessages(roomId, (message) => {
    console.log('New message:', message);
    // Update UI with new message
});

// Cleanup
unsubscribe();
```

#### Connection Status
```typescript
import { getConnectionStatus } from '@/lib/websocket';

const status = getConnectionStatus();
console.log('Connection status:', status); // 'connected' | 'connecting' | 'disconnected'
```

#### Broadcasting Events (Backend)
```php
// In your routes or controllers
use App\Events\RoomMessageSent;
use App\Models\RoomMessage;

$message = RoomMessage::create([...]);
broadcast(new RoomMessageSent($message))->toOthers();
```

## WebSocket Channels

The system uses these channels:

- `room-{id}` - Public channel for room events
- `presence-room-{id}` - Presence channel for user status

### Channel Events

#### `new-message`
Triggered when a new message is sent:
```typescript
{
    id: number,
    room_id: number,
    sender_role: string,
    sender_name: string,
    message: string,
    type: 'text' | 'image' | 'system',
    created_at: string
}
```

#### `user-status-changed`
Triggered when user online status changes:
```typescript
{
    room_id: number,
    user_id: number,
    user_name: string,
    role: string,
    is_online: boolean,
    last_seen: string,
    timestamp: string
}
```

#### `new-activity`
Triggered for room activities:
```typescript
{
    room_id: number,
    action: string,
    user_name: string,
    role: string,
    description: string,
    timestamp: string
}
```

## Testing

### Local Testing
1. Set up Pusher keys in `.env`
2. Run `npm run dev` for frontend
3. Run `php artisan serve` for backend
4. Open multiple browser windows to test real-time updates

### Production Testing
1. Use Pusher's debug console to monitor events
2. Check browser console for WebSocket connection status
3. Monitor connection indicators in the UI

## Troubleshooting

### Common Issues

#### 1. Connection Failed
- **Check**: Pusher keys in `.env` and `.env.example`
- **Check**: Network connectivity and CORS settings
- **Solution**: Verify Pusher dashboard configuration

#### 2. Messages Not Updating
- **Check**: Broadcasting is enabled (`BROADCAST_CONNECTION=pusher`)
- **Check**: Events are being triggered in backend routes
- **Solution**: Add debug logging to verify event firing

#### 3. User Status Not Working
- **Check**: Presence channel subscriptions
- **Check**: User authentication for private channels
- **Solution**: Verify channel authentication middleware

#### 4. Performance Issues
- **Check**: Event payload size
- **Check**: Number of concurrent connections
- **Solution**: Optimize event data and implement rate limiting

## Security Considerations

1. **Channel Authorization**: Implement proper authentication for private channels
2. **Event Validation**: Validate all event data before broadcasting
3. **Rate Limiting**: Implement rate limiting for message sending
4. **Content Filtering**: Sanitize message content to prevent XSS

## Monitoring

### Pusher Dashboard
- Monitor connection statistics
- View event logs
- Debug connection issues

### Application Monitoring
```typescript
// Monitor connection status
import { onConnectionError, onConnectionDisconnected } from '@/lib/websocket';

onConnectionError((error) => {
    console.error('WebSocket error:', error);
    // Send to monitoring service
});

onConnectionDisconnected(() => {
    console.warn('WebSocket disconnected');
    // Alert user or attempt reconnection
});
```

## Performance Optimization

1. **Batch Events**: Combine multiple updates into single events
2. **Lazy Loading**: Load historical messages on demand
3. **Connection Pooling**: Reuse connections when possible
4. **Event Debouncing**: Prevent rapid successive events

## Future Enhancements

1. **Typing Indicators**: Show when users are typing
2. **Message Reactions**: Add emoji reactions to messages
3. **File Previews**: Show thumbnails for uploaded images
4. **Message Search**: Implement searchable message history
5. **Push Notifications**: Browser notifications for new messages