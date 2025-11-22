#!/usr/bin/env node

// WebSocket Connection Test Script
import WebSocket from 'ws';

console.log('🚀 Starting WebSocket Connection Test...');

// Test configuration
const config = {
    wsUrl: 'ws://localhost:8082/ws',
    roomId: 'test-room-123',
    userId: 'test-user-123'
};

console.log('📝 Configuration:', config);

// Create WebSocket connection
const ws = new WebSocket(`${config.wsUrl}?room_id=${config.roomId}&user_id=${config.userId}`);

let messageCount = 0;
let isConnected = false;

// Connection event handlers
ws.on('open', function open() {
    console.log('✅ WebSocket connection established!');
    isConnected = true;

    // Send a test message after 1 second
    setTimeout(() => {
        sendTestMessage();
    }, 1000);

    // Send periodic ping messages
    setInterval(() => {
        if (isConnected) {
            sendPing();
        }
    }, 30000);
});

ws.on('message', function message(data) {
    messageCount++;
    console.log(`📨 Message #${messageCount} received:`, data.toString());

    try {
        const parsed = JSON.parse(data.toString());
        console.log('📦 Parsed message:', JSON.stringify(parsed, null, 2));

        // Handle different message types
        switch (parsed.type) {
            case 'room_joined':
                console.log('🏠 Successfully joined room:', parsed.room_id);
                break;
            case 'message':
                console.log('💬 Chat message received:', parsed.data);
                break;
            case 'typing':
                console.log('⌨️ Typing indicator:', parsed.data);
                break;
            case 'activity':
                console.log('📊 User activity:', parsed.data);
                break;
            case 'pong':
                console.log('🏓 Pong response received');
                break;
            default:
                console.log('❓ Unknown message type:', parsed.type);
        }
    } catch (error) {
        console.log('📄 Raw message (not JSON):', data.toString());
    }
});

ws.on('close', function close() {
    console.log('❌ WebSocket connection closed');
    isConnected = false;
});

ws.on('error', function error(err) {
    console.error('💥 WebSocket error:', err.message);
    isConnected = false;
});

// Helper functions
function sendTestMessage() {
    if (!isConnected) {
        console.log('❌ Cannot send message - not connected');
        return;
    }

    const testMessage = {
        type: 'message',
        data: {
            room_id: config.roomId,
            sender_name: config.userId,
            message: `Test message #${Date.now()}`,
            message_type: 'text'
        }
    };

    console.log('📤 Sending test message:', testMessage);
    ws.send(JSON.stringify(testMessage));
}

function sendPing() {
    if (!isConnected) return;

    const ping = {
        type: 'ping',
        timestamp: new Date().toISOString()
    };

    console.log('🏓 Sending ping...');
    ws.send(JSON.stringify(ping));
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🧹 Closing WebSocket connection...');
    if (ws) {
        ws.close();
    }
    process.exit(0);
});

// Test timeout
setTimeout(() => {
    console.log('⏰ Test completed after 30 seconds');
    if (ws) {
        ws.close();
    }
    process.exit(0);
}, 30000);