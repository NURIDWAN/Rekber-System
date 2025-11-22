
#!/usr/bin/env node

/**
 * WebSocket Testing Tool
 *
 * This script tests the WebSocket implementation with various scenarios:
 * - Connection testing
 * - Message sending/receiving
 * - Reconnection testing
 * - Load testing
 * - Performance monitoring
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const readline = require('readline');

class WebSocketTester extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            serverUrl: config.serverUrl || 'ws://localhost:8080',
            roomId: config.roomId || 'test-room-1',
            userId: config.userId || 'test-user',
            reconnectAttempts: config.reconnectAttempts || 5,
            reconnectInterval: config.reconnectInterval || 1000,
            ...config
        };

        this.ws = null;
        this.metrics = {
            messagesSent: 0,
            messagesReceived: 0,
            connectionAttempts: 0,
            reconnects: 0,
            errors: 0,
            startTime: Date.now(),
            lastMessageTime: null,
            latencies: []
        };

        this.messageQueue = [];
        this.isRunning = false;
        this.reconnectCount = 0;

        // Setup readline for interactive commands
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.metrics.connectionAttempts++;

            const wsUrl = `${this.config.serverUrl}/ws?room_id=${this.config.roomId}&user_id=${this.config.userId}`;

            console.log(`🔌 Connecting to ${wsUrl}...`);

            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log('✅ Connected successfully');
                this.authenticate();
                this.joinRoom();
                resolve();
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });

            this.ws.on('close', (code, reason) => {
                console.log(`🔌 Connection closed: ${code} - ${reason}`);
                this.handleDisconnect(code, reason);
            });

            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
                this.metrics.errors++;
                this.emit('error', error);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                    this.ws.terminate();
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    authenticate() {
        this.send({
            type: 'auth',
            user_id: this.config.userId,
            token: 'test-token'
        });
    }

    joinRoom() {
        this.send({
            type: 'join_room',
            room_id: this.config.roomId
        });
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const messageData = {
                ...message,
                timestamp: new Date().toISOString(),
                id: this.generateMessageId()
            };

            this.ws.send(JSON.stringify(messageData));
            this.metrics.messagesSent++;
            this.metrics.lastMessageTime = Date.now();

            if (message.type === 'message') {
                console.log(`📤 Sent: ${message.message}`);
            }

            return true;
        } else {
            this.messageQueue.push(message);
            console.log('⏳ Message queued (connection not ready)');
            return false;
        }
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            this.metrics.messagesReceived++;

            // Calculate latency for ping/pong
            if (message.type === 'pong' && message.timestamp) {
                const latency = Date.now() - message.timestamp;
                this.metrics.latencies.push(latency);
                console.log(`🏓 Pong received - Latency: ${latency}ms`);
            } else if (message.type === 'message') {
                console.log(`📥 Received: ${message.message} (from: ${message.user_id})`);
            } else if (message.type === 'typing') {
                console.log(`⌨️  ${message.user_id} is typing...`);
            } else if (message.type === 'activity') {
                console.log(`📢 Activity: ${message.message}`);
            }

            this.emit('message', message);
        } catch (error) {
            console.error('❌ Failed to parse message:', error);
            this.metrics.errors++;
        }
    }

    handleDisconnect(code, reason) {
        this.emit('disconnect', { code, reason });

        // Attempt reconnection if not explicitly closed
        if (code !== 1000 && this.reconnectCount < this.config.reconnectAttempts) {
            this.reconnectCount++;
            this.metrics.reconnects++;

            console.log(`🔄 Reconnection attempt ${this.reconnectCount}/${this.config.reconnectAttempts}...`);

            setTimeout(async () => {
                try {
                    await this.connect();
                    this.reconnectCount = 0;

                    // Send queued messages
                    while (this.messageQueue.length > 0) {
                        const message = this.messageQueue.shift();
                        this.send(message);
                    }
                } catch (error) {
                    console.error('❌ Reconnection failed:', error.message);
                }
            }, this.config.reconnectInterval);
        }
    }

    ping() {
        this.send({
            type: 'ping',
            timestamp: Date.now()
        });
    }

    sendMessage(text) {
        this.send({
            type: 'message',
            message: text,
            room_id: this.config.roomId,
            user_id: this.config.userId
        });
    }

    sendTyping(isTyping) {
        this.send({
            type: 'typing',
            data: { is_typing: isTyping }
        });
    }

    sendActivity(activity, data = {}) {
        this.send({
            type: 'activity',
            message: activity,
            data
        });
    }

    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getMetrics() {
        const avgLatency = this.metrics.latencies.length > 0
            ? this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length
            : 0;

        const uptime = Date.now() - this.metrics.startTime;
        const messagesPerSecond = (this.metrics.messagesSent + this.metrics.messagesReceived) / (uptime / 1000);

        return {
            ...this.metrics,
            avgLatency: Math.round(avgLatency),
            uptime: Math.round(uptime / 1000),
            messagesPerSecond: Math.round(messagesPerSecond * 100) / 100,
            queuedMessages: this.messageQueue.length
        };
    }

    printMetrics() {
        const metrics = this.getMetrics();

        console.log('\n📊 METRICS:');
        console.log(`   Messages Sent: ${metrics.messagesSent}`);
        console.log(`   Messages Received: ${metrics.messagesReceived}`);
        console.log(`   Connection Attempts: ${metrics.connectionAttempts}`);
        console.log(`   Reconnects: ${metrics.reconnects}`);
        console.log(`   Errors: ${metrics.errors}`);
        console.log(`   Average Latency: ${metrics.avgLatency}ms`);
        console.log(`   Uptime: ${metrics.uptime}s`);
        console.log(`   Messages/sec: ${metrics.messagesPerSecond}`);
        console.log(`   Queued Messages: ${metrics.queuedMessages}`);
        console.log('');
    }

    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Test completed');
            this.ws = null;
        }
    }

    // Interactive mode
    async startInteractive() {
        console.log('\n🎮 Interactive WebSocket Test');
        console.log('Commands: send <message>, ping, typing, activity <text>, metrics, quit');
        console.log('Type your command:\n');

        this.rl.setPrompt('WS> ');
        this.rl.prompt();

        this.rl.on('line', async (input) => {
            const [command, ...args] = input.trim().split(' ');

            switch (command.toLowerCase()) {
                case 'send':
                    if (args.length > 0) {
                        this.sendMessage(args.join(' '));
                    } else {
                        console.log('Usage: send <message>');
                    }
                    break;

                case 'ping':
                    this.ping();
                    break;

                case 'typing':
                    this.sendTyping(true);
                    setTimeout(() => this.sendTyping(false), 2000);
                    break;

                case 'activity':
                    if (args.length > 0) {
                        this.sendActivity(args.join(' '));
                    } else {
                        console.log('Usage: activity <text>');
                    }
                    break;

                case 'metrics':
                    this.printMetrics();
                    break;

                case 'quit':
                case 'exit':
                    this.disconnect();
                    this.rl.close();
                    return;

                default:
                    console.log('Unknown command. Available: send, ping, typing, activity, metrics, quit');
                    break;
            }

            this.rl.prompt();
        });

        this.rl.on('close', () => {
            console.log('\n👋 Goodbye!');
            process.exit(0);
        });
    }

    // Automated testing
    async runAutomatedTests() {
        console.log('🤖 Running automated tests...\n');

        const tests = [
            { name: 'Connection Test', fn: () => this.testConnection() },
            { name: 'Message Sending Test', fn: () => this.testMessageSending() },
            { name: 'Latency Test', fn: () => this.testLatency() },
            { name: 'Reconnection Test', fn: () => this.testReconnection() },
            { name: 'Load Test', fn: () => this.testLoad() }
        ];

        for (const test of tests) {
            try {
                console.log(`🧪 ${test.name}...`);
                await test.fn();
                console.log(`✅ ${test.name} passed\n`);
            } catch (error) {
                console.log(`❌ ${test.name} failed: ${error.message}\n`);
            }
        }

        console.log('🏁 Automated testing completed');
        this.printMetrics();
    }

    async testConnection() {
        await this.connect();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('✅ Connection established');
        } else {
            throw new Error('Connection failed');
        }
    }

    async testMessageSending() {
        await this.connect();

        const testMessage = 'Test message ' + Date.now();
        this.sendMessage(testMessage);

        // Wait a moment for message processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (this.metrics.messagesSent > 0) {
            console.log('✅ Message sent successfully');
        } else {
            throw new Error('Message sending failed');
        }
    }

    async testLatency() {
        await this.connect();

        console.log('🏓 Testing latency (10 pings)...');

        for (let i = 0; i < 10; i++) {
            this.ping();
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Wait for responses
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (this.metrics.latencies.length > 0) {
            const avgLatency = this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length;
            console.log(`✅ Average latency: ${Math.round(avgLatency)}ms`);
        } else {
            throw new Error('Latency test failed - no responses received');
        }
    }

    async testReconnection() {
        await this.connect();

        console.log('🔄 Testing reconnection...');

        // Force disconnect
        this.ws.close(1006, 'Test disconnect');

        // Wait for reconnection
        await new Promise(resolve => setTimeout(resolve, 5000));

        if (this.metrics.reconnects > 0) {
            console.log('✅ Reconnection successful');
        } else {
            throw new Error('Reconnection failed');
        }
    }

    async testLoad() {
        await this.connect();

        console.log('⚡ Load testing (100 messages)...');

        const startTime = Date.now();

        for (let i = 0; i < 100; i++) {
            this.sendMessage(`Load test message ${i + 1}`);

            // Small delay to avoid overwhelming
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`✅ Load test completed in ${duration}ms`);
        console.log(`📊 Messages per second: ${(100 / (duration / 1000)).toFixed(2)}`);
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    const config = {
        serverUrl: process.env.WS_SERVER_URL || 'ws://localhost:8080',
        roomId: process.env.WS_ROOM_ID || 'test-room-1',
        userId: process.env.WS_USER_ID || 'test-user',
        reconnectAttempts: 5
    };

    const tester = new WebSocketTester(config);

    try {
        switch (command) {
            case 'interactive':
                await tester.connect();
                await tester.startInteractive();
                break;

            case 'automated':
                await tester.runAutomatedTests();
                break;

            case 'load':
                const userCount = parseInt(args[1]) || 10;
                await runLoadTest(userCount, config);
                break;

            default:
                console.log('Usage:');
                console.log('  node websocket-test.js interactive    # Interactive mode');
                console.log('  node websocket-test.js automated     # Automated tests');
                console.log('  node websocket-test.js load <count>   # Load test with multiple users');
                console.log('');
                console.log('Environment variables:');
                console.log('  WS_SERVER_URL    WebSocket server URL');
                console.log('  WS_ROOM_ID       Room ID for testing');
                console.log('  WS_USER_ID       User ID for testing');
                break;
        }
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    } finally {
        if (tester) {
            tester.disconnect();
        }
    }
}

// Load test with multiple simulated users
async function runLoadTest(userCount, config) {
    console.log(`⚡ Starting load test with ${userCount} simulated users...\n`);

    const testers = [];
    const startTime = Date.now();

    // Create multiple testers
    for (let i = 0; i < userCount; i++) {
        const tester = new WebSocketTester({
            ...config,
            userId: `${config.userId}_${i}`,
            reconnectAttempts: 3
        });
        testers.push(tester);
    }

    // Connect all testers
    console.log('🔌 Connecting all users...');
    await Promise.all(testers.map(t => t.connect()));
    console.log('✅ All users connected');

    // Send messages from each user
    console.log('📤 Sending messages...');
    const messagePromises = [];

    for (let i = 0; i < testers.length; i++) {
        const tester = testers[i];

        for (let j = 0; j < 10; j++) {
            messagePromises.push(
                new Promise(resolve => {
                    setTimeout(() => {
                        tester.sendMessage(`Message ${j + 1} from user ${i}`);
                        resolve();
                    }, Math.random() * 5000);
                })
            );
        }
    }

    await Promise.all(messagePromises);
    console.log('✅ All messages sent');

    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Calculate total metrics
    const totalMetrics = {
        messagesSent: 0,
        messagesReceived: 0,
        connectionAttempts: 0,
        reconnects: 0,
        errors: 0
    };

    testers.forEach(tester => {
        const metrics = tester.getMetrics();
        Object.keys(totalMetrics).forEach(key => {
            totalMetrics[key] += metrics[key];
        });
        tester.disconnect();
    });

    const duration = Date.now() - startTime;

    console.log('\n📊 LOAD TEST RESULTS:');
    console.log(`   Users: ${userCount}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Total Messages Sent: ${totalMetrics.messagesSent}`);
    console.log(`   Total Messages Received: ${totalMetrics.messagesReceived}`);
    console.log(`   Messages per Second: ${((totalMetrics.messagesSent + totalMetrics.messagesReceived) / (duration / 1000)).toFixed(2)}`);
    console.log(`   Total Errors: ${totalMetrics.errors}`);
    console.log(`   Total Reconnects: ${totalMetrics.reconnects}`);
}

if (require.main === module) {
    main();
}

module.exports = WebSocketTester;