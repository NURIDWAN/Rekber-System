#!/usr/bin/env node

/**
 * WebSocket Server Implementation
 *
 * This server handles WebSocket connections for the chat system
 * with session-based message storage and real-time features.
 */

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');

// Simple logger for the server
class ServerLogger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'warn'; // Default to warn to reduce console spam
        this.enableColors = true;
    }

    log(level, category, message, data = null) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        if (levels[level] < levels[this.logLevel]) return;

        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const colors = {
            debug: '\x1b[90m',
            info: '\x1b[36m',
            warn: '\x1b[33m',
            error: '\x1b[31m',
            success: '\x1b[32m',
            reset: '\x1b[0m'
        };

        const icons = {
            debug: '🔍',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
            success: '✅'
        };

        const color = colors[level] || colors.info;
        const icon = icons[level] || '📝';
        const reset = colors.reset;

        // Only use colors if enabled and it's a TTY
        const useColors = this.enableColors && process.stdout.isTTY;
        const colorCode = useColors ? color : '';
        const resetCode = useColors ? reset : '';

        console.log(`${colorCode}${icon} [${timestamp}] ${category.padEnd(8)} ${message}${resetCode}`);
        if (data) {
            console.log(`  Data: ${JSON.stringify(data, null, 2)}`);
        }
    }

    debug(category, message, data) { this.log('debug', category, message, data); }
    info(category, message, data) { this.log('info', category, message, data); }
    warn(category, message, data) { this.log('warn', category, message, data); }
    error(category, message, data) { this.log('error', category, message, data); }
    success(category, message, data) { this.log('success', category, message, data); }
}

const logger = new ServerLogger();

class WebSocketServer {
    constructor(options = {}) {
        this.port = options.port || 8080;
        this.host = options.host || '0.0.0.0';

        // In-memory storage (use Redis in production)
        this.connections = new Map(); // connectionId -> connection info
        this.rooms = new Map(); // roomId -> Set of connectionIds
        this.messages = new Map(); // roomId -> array of messages
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            messagesSent: 0,
            messagesReceived: 0,
            errors: 0,
            startTime: Date.now()
        };

        this.setupExpress();
        this.setupWebSocket();
    }

    setupExpress() {
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());

        // API routes
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                connections: this.metrics.activeConnections,
                uptime: Date.now() - this.metrics.startTime,
                timestamp: new Date().toISOString()
            });
        });

        this.app.get('/api/rooms/:roomId/messages', (req, res) => {
            const roomId = req.params.roomId;
            const roomMessages = this.messages.get(roomId) || [];
            res.json(roomMessages.slice(-50)); // Return last 50 messages
        });

        this.app.get('/api/rooms/:roomId/connections', (req, res) => {
            const roomId = req.params.roomId;
            const roomConnections = this.rooms.get(roomId) || [];
            const connections = Array.from(roomConnections).map(connId => ({
                connectionId: connId,
                ...this.connections.get(connId)
            }));
            res.json(connections);
        });

        this.app.get('/api/metrics', (req, res) => {
            res.json({
                ...this.metrics,
                activeRooms: this.rooms.size,
                totalMessages: Array.from(this.messages.values())
                    .reduce((total, roomMessages) => total + roomMessages.length, 0)
            });
        });
    }

    setupWebSocket() {
        // Create HTTP server
        this.httpServer = http.createServer(this.app);

        // Create WebSocket server
        this.wss = new WebSocket.Server({
            server: this.httpServer,
            path: '/ws'
        });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        // Cleanup interval
        setInterval(() => {
            this.cleanupInactiveConnections();
        }, 60000); // Every minute
    }

    handleConnection(ws, req) {
        console.log('🔌 RAW CONNECTION DETECTED!');
        console.log('📍 Request URL:', req.url);
        console.log('📍 Headers:', req.headers);

        const connectionId = this.generateConnectionId();
        const url = new URL(req.url, `http://${req.headers.host}`);
        const roomId = url.searchParams.get('room_id');
        const userId = url.searchParams.get('user_id');
        const token = url.searchParams.get('token');

        console.log('🆔 Extracted params:', { connectionId, roomId, userId, hasToken: !!token });

        logger.info('WS-CONN', `New connection: ${connectionId} (User: ${userId}, Room: ${roomId})`);

        if (!roomId || !userId) {
            logger.error('WS-CONN', 'Missing required parameters', { connectionId, roomId, userId });
            ws.close(1008, 'Missing required parameters');
            return;
        }

        // Connection info
        const connectionInfo = {
            connectionId,
            userId,
            roomId,
            token,
            connectedAt: new Date(),
            lastActivity: new Date(),
            isAlive: true,
            ip: req.socket.remoteAddress
        };

        // Store connection
        this.connections.set(connectionId, connectionInfo);

        // Add to room
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
            this.messages.set(roomId, []);
        }
        this.rooms.get(roomId).add(connectionId);

        // Update metrics
        this.metrics.totalConnections++;
        this.metrics.activeConnections++;

        // Setup WebSocket event handlers
        ws.on('message', (data) => {
            this.handleMessage(connectionId, data);
        });

        ws.on('close', (code, reason) => {
            this.handleDisconnection(connectionId, code, reason);
        });

        ws.on('error', (error) => {
            logger.error('WS-ERROR', `WebSocket error for ${connectionId}: ${error.message}`, { connectionId, error: error.message, stack: error.stack });
            this.metrics.errors++;
            this.handleDisconnection(connectionId, 1006, 'Error');
        });

        ws.on('pong', () => {
            connectionInfo.isAlive = true;
            connectionInfo.lastActivity = new Date();
        });

        // Send welcome message
        this.sendToConnection(connectionId, {
            type: 'connected',
            connectionId,
            timestamp: new Date().toISOString()
        });

        // Notify room about new user
        this.broadcastToRoom(roomId, {
            type: 'activity',
            activity: 'user_joined',
            user_id: userId,
            message: `${userId} joined the room`,
            timestamp: new Date().toISOString()
        }, connectionId);
    }

    handleMessage(connectionId, data) {
        try {
            const connectionInfo = this.connections.get(connectionId);
            if (!connectionInfo) return;

            connectionInfo.lastActivity = new Date();
            this.metrics.messagesReceived++;

            const message = JSON.parse(data.toString());
            message.timestamp = message.timestamp || new Date().toISOString();
            message.connectionId = connectionId;

            logger.debug('WS-MSG', `Received from ${connectionId}: ${message.type}`, { connectionId, messageType: message.type });

            switch (message.type) {
                case 'auth':
                    this.handleAuth(connectionId, message);
                    break;

                case 'join_room':
                    this.handleJoinRoom(connectionId, message);
                    break;

                case 'message':
                    this.handleChatMessage(connectionId, message);
                    break;

                case 'typing':
                    this.handleTypingIndicator(connectionId, message);
                    break;

                case 'activity':
                    this.handleActivity(connectionId, message);
                    break;

                case 'file':
                    this.handleFileMessage(connectionId, message);
                    break;

                case 'ping':
                    this.handlePing(connectionId, message);
                    break;

                default:
                    logger.debug('WS-MSG', `Unknown message type: ${message.type}`, { connectionId, messageType: message.type });
            }
        } catch (error) {
            logger.error('WS-MSG', `Error handling message from ${connectionId}: ${error.message}`, { connectionId, error: error.message, stack: error.stack });
            this.metrics.errors++;
        }
    }

    handleAuth(connectionId, message) {
        const connectionInfo = this.connections.get(connectionId);
        if (!connectionInfo) return;

        // In a real implementation, validate the token here
        connectionInfo.isAuthenticated = true;

        this.sendToConnection(connectionId, {
            type: 'auth_success',
            user_id: message.user_id,
            timestamp: new Date().toISOString()
        });
    }

    handleJoinRoom(connectionId, message) {
        const connectionInfo = this.connections.get(connectionId);
        if (!connectionInfo) return;

        const roomId = message.room_id;

        // Remove from current room if different
        if (connectionInfo.roomId !== roomId) {
            this.rooms.get(connectionInfo.roomId)?.delete(connectionId);
        }

        // Add to new room
        connectionInfo.roomId = roomId;

        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
            this.messages.set(roomId, []);
        }
        this.rooms.get(roomId).add(connectionId);

        this.sendToConnection(connectionId, {
            type: 'room_joined',
            room_id: roomId,
            user_count: this.rooms.get(roomId).size,
            timestamp: new Date().toISOString()
        });
    }

    handleChatMessage(connectionId, message) {
        const connectionInfo = this.connections.get(connectionId);
        if (!connectionInfo) return;

        const roomMessage = {
            id: this.generateMessageId(),
            room_id: connectionInfo.roomId,
            user_id: connectionInfo.userId,
            message: message.message,
            type: 'message',
            timestamp: new Date().toISOString(),
            status: 'sent'
        };

        // Store message
        this.storeMessage(connectionInfo.roomId, roomMessage);

        // Broadcast to room
        this.broadcastToRoom(connectionInfo.roomId, roomMessage);

        this.metrics.messagesSent++;
    }

    handleTypingIndicator(connectionId, message) {
        const connectionInfo = this.connections.get(connectionId);
        if (!connectionInfo) return;

        const typingMessage = {
            type: 'typing',
            room_id: connectionInfo.roomId,
            user_id: connectionInfo.userId,
            data: message.data,
            timestamp: new Date().toISOString()
        };

        this.broadcastToRoom(connectionInfo.roomId, typingMessage, connectionId);
    }

    handleActivity(connectionId, message) {
        const connectionInfo = this.connections.get(connectionId);
        if (!connectionInfo) return;

        const activityMessage = {
            type: 'activity',
            activity: message.activity || 'custom',
            room_id: connectionInfo.roomId,
            user_id: connectionInfo.userId,
            message: message.message,
            data: message.data,
            timestamp: new Date().toISOString()
        };

        this.broadcastToRoom(connectionInfo.roomId, activityMessage);
    }

    handleFileMessage(connectionId, message) {
        const connectionInfo = this.connections.get(connectionId);
        if (!connectionInfo) return;

        const fileMessage = {
            id: this.generateMessageId(),
            type: 'file',
            room_id: connectionInfo.roomId,
            user_id: connectionInfo.userId,
            message: message.message,
            data: message.data,
            timestamp: new Date().toISOString()
        };

        this.storeMessage(connectionInfo.roomId, fileMessage);
        this.broadcastToRoom(connectionInfo.roomId, fileMessage);

        this.metrics.messagesSent++;
    }

    handlePing(connectionId, message) {
        const connectionInfo = this.connections.get(connectionId);
        if (!connectionInfo) return;

        this.sendToConnection(connectionId, {
            type: 'pong',
            timestamp: message.timestamp || Date.now()
        });
    }

    handleDisconnection(connectionId, code, reason) {
        const connectionInfo = this.connections.get(connectionId);
        if (!connectionInfo) return;

        logger.info('WS-CONN', `Disconnected: ${connectionId} (${code}: ${reason})`, { connectionId, code, reason });

        // Remove from room
        this.rooms.get(connectionInfo.roomId)?.delete(connectionId);

        // Remove connection
        this.connections.delete(connectionId);
        this.metrics.activeConnections--;

        // Notify room about user leaving
        if (this.rooms.has(connectionInfo.roomId) && this.rooms.get(connectionInfo.roomId).size > 0) {
            this.broadcastToRoom(connectionInfo.roomId, {
                type: 'activity',
                activity: 'user_left',
                user_id: connectionInfo.userId,
                message: `${connectionInfo.userId} left the room`,
                timestamp: new Date().toISOString()
            });
        }

        // Clean up empty rooms
        if (this.rooms.get(connectionInfo.roomId)?.size === 0) {
            this.rooms.delete(connectionInfo.roomId);
            this.messages.delete(connectionInfo.roomId);
        }
    }

    storeMessage(roomId, message) {
        if (!this.messages.has(roomId)) {
            this.messages.set(roomId, []);
        }

        const roomMessages = this.messages.get(roomId);
        roomMessages.push(message);

        // Keep only last 1000 messages per room
        if (roomMessages.length > 1000) {
            this.messages.set(roomId, roomMessages.slice(-1000));
        }
    }

    sendToConnection(connectionId, message) {
        const connectionInfo = this.connections.get(connectionId);
        if (!connectionInfo) return;

        // Find WebSocket connection
        for (const ws of this.wss.clients) {
            if (ws.connectionId === connectionId && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
                break;
            }
        }
    }

    broadcastToRoom(roomId, message, excludeConnectionId = null) {
        const roomConnections = this.rooms.get(roomId);
        if (!roomConnections) return;

        const messageStr = JSON.stringify(message);

        for (const connectionId of roomConnections) {
            if (connectionId !== excludeConnectionId) {
                this.sendToConnection(connectionId, message);
            }
        }

        logger.debug('WS-ROOM', `Broadcast to room ${roomId}: ${message.type}`, { roomId, messageType: message.type, recipients: roomConnections.size });
    }

    cleanupInactiveConnections() {
        const now = new Date();
        const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

        for (const [connectionId, connectionInfo] of this.connections) {
            if (now - connectionInfo.lastActivity > inactiveThreshold) {
                logger.info('WS-CONN', `Cleaning up inactive connection: ${connectionId}`);

                // Find and close WebSocket
                for (const ws of this.wss.clients) {
                    if (ws.connectionId === connectionId) {
                        ws.terminate();
                        break;
                    }
                }
            }
        }
    }

    generateConnectionId() {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.startTime,
            activeConnections: this.connections.size,
            activeRooms: this.rooms.size,
            totalMessages: Array.from(this.messages.values())
                .reduce((total, roomMessages) => total + roomMessages.length, 0)
        };
    }

    start() {
        this.httpServer.listen(this.port, this.host, () => {
            console.log(`🚀 WebSocket server started on ${this.host}:${this.port}`);
            console.log(`📊 Health endpoint: http://${this.host}:${this.port}/health`);
            console.log(`📈 Metrics endpoint: http://${this.host}:${this.port}/api/metrics`);
        });

        // Attach connectionId to WebSocket instances
        this.wss.on('connection', (ws, req) => {
            const connectionId = this.generateConnectionId();
            ws.connectionId = connectionId;
        });
    }

    stop() {
        console.log('🛑 Shutting down WebSocket server...');

        // Close all connections
        for (const ws of this.wss.clients) {
            ws.close(1001, 'Server shutdown');
        }

        // Close HTTP server
        this.httpServer.close(() => {
            console.log('✅ WebSocket server stopped');
        });
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const port = parseInt(args[0]) || 8080;

    const server = new WebSocketServer({ port });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        server.stop();
        process.exit(0);
    });

    server.start();
}

if (require.main === module) {
    main();
}

module.exports = WebSocketServer;