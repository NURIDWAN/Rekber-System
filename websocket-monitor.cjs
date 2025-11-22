#!/usr/bin/env node

/**
 * WebSocket Connection Monitor
 *
 * Displays real-time WebSocket connection status and metrics
 * without spamming the terminal with errors.
 */

const WebSocket = require('ws');
const http = require('http');

class WebSocketMonitor {
    constructor(config = {}) {
        this.serverUrl = config.serverUrl || 'ws://localhost:8080';
        this.roomId = config.roomId || 'monitor-room';
        this.userId = config.userId || 'monitor-user';
        this.updateInterval = config.updateInterval || 5000; // 5 seconds
        this.maxHistory = config.maxHistory || 50;

        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.lastPingTime = null;
        this.latency = null;
        this.messageCount = 0;
        this.errorCount = 0;
        this.connectionHistory = [];
        this.lastStatusUpdate = Date.now();

        this.setupMonitoring();
    }

    setupMonitoring() {
        // Clear console and show header
        console.clear();
        this.showHeader();

        // Start connection
        this.connect();

        // Update display periodically
        this.displayInterval = setInterval(() => {
            this.updateDisplay();
        }, this.updateInterval);

        // Handle process exit
        process.on('SIGINT', () => {
            console.log('\n👋 WebSocket Monitor stopped');
            if (this.ws) {
                this.ws.close();
            }
            clearInterval(this.displayInterval);
            process.exit(0);
        });
    }

    showHeader() {
        console.log('🔌 WebSocket Connection Monitor');
        console.log('=====================================');
        console.log(`Server: ${this.serverUrl}`);
        console.log(`Room: ${this.roomId}`);
        console.log(`User: ${this.userId}`);
        console.log('=====================================\n');
    }

    connect() {
        const url = `${this.serverUrl}/ws?room_id=${this.roomId}&user_id=${this.userId}`;

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.addToHistory('connected');
            this.sendPing();
        });

        this.ws.on('message', (data) => {
            this.messageCount++;
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'pong') {
                    this.latency = Date.now() - this.lastPingTime;
                } else if (message.type !== 'ping') {
                    this.addToHistory('message', message.type);
                }
            } catch (error) {
                // Ignore parse errors in monitor
            }
        });

        this.ws.on('close', (code, reason) => {
            this.isConnected = false;
            this.addToHistory('disconnected', `${code}: ${reason}`);
            this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
            this.errorCount++;
            this.addToHistory('error', error.message);
            // Don't log to console - we'll show it in the display
        });

        // Ping interval
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendPing();
            }
        }, 30000);
    }

    sendPing() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.lastPingTime = Date.now();
            this.ws.send(JSON.stringify({ type: 'ping', timestamp: this.lastPingTime }));
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.addToHistory('failed', 'Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        this.addToHistory('reconnecting', `Attempt ${this.reconnectAttempts}`);

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    addToHistory(type, detail = '') {
        const entry = {
            timestamp: new Date(),
            type,
            detail
        };

        this.connectionHistory.unshift(entry);
        if (this.connectionHistory.length > this.maxHistory) {
            this.connectionHistory.pop();
        }
    }

    updateDisplay() {
        // Move cursor to top to overwrite previous display
        process.stdout.write('\x1b[H');

        // Show current status
        console.log('🔌 WebSocket Connection Monitor');
        console.log('=====================================');

        // Connection status line
        const statusIcon = this.isConnected ? '🟢' : '🔴';
        const statusText = this.isConnected ? 'Connected' : 'Disconnected';
        console.log(`Status: ${statusIcon} ${statusText}`);

        if (this.isConnected) {
            console.log(`Latency: ${this.latency !== null ? `${this.latency}ms` : 'Measuring...'}`);
            console.log(`Messages: ${this.messageCount}`);
        } else {
            console.log(`Reconnect attempts: ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        }

        console.log(`Errors: ${this.errorCount}`);
        console.log(`Server: ${this.serverUrl}`);
        console.log('=====================================');

        // Show recent history
        console.log('\n📜 Recent Activity:');
        const recentHistory = this.connectionHistory.slice(0, 10);
        recentHistory.forEach(entry => {
            const time = entry.timestamp.toLocaleTimeString();
            const icon = this.getHistoryIcon(entry.type);
            const detail = entry.detail ? ` - ${entry.detail}` : '';
            console.log(`  ${time} ${icon} ${entry.type}${detail}`);
        });

        // Clear rest of screen
        console.log('\nPress Ctrl+C to exit');
    }

    getHistoryIcon(type) {
        switch (type) {
            case 'connected': return '✅';
            case 'disconnected': return '❌';
            case 'message': return '💬';
            case 'error': return '🚨';
            case 'reconnecting': return '🔄';
            case 'failed': return '💀';
            default: return '📝';
        }
    }
}

// CLI interface
function main() {
    const args = process.argv.slice(2);
    const config = {};

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--server':
            case '-s':
                config.serverUrl = args[++i];
                break;
            case '--room':
            case '-r':
                config.roomId = args[++i];
                break;
            case '--user':
            case '-u':
                config.userId = args[++i];
                break;
            case '--interval':
            case '-i':
                config.updateInterval = parseInt(args[++i]) * 1000; // Convert to ms
                break;
            case '--help':
            case '-h':
                console.log('WebSocket Connection Monitor');
                console.log('');
                console.log('Usage: node websocket-monitor.js [options]');
                console.log('');
                console.log('Options:');
                console.log('  -s, --server <url>     WebSocket server URL (default: ws://localhost:8080)');
                console.log('  -r, --room <id>        Room ID to join (default: monitor-room)');
                console.log('  -u, --user <id>        User ID (default: monitor-user)');
                console.log('  -i, --interval <sec>   Update interval in seconds (default: 5)');
                console.log('  -h, --help             Show this help');
                process.exit(0);
        }
    }

    new WebSocketMonitor(config);
}

if (require.main === module) {
    main();
}

module.exports = WebSocketMonitor;