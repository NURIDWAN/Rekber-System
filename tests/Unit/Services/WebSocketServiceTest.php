<?php

namespace Tests\Unit\Services;

use App\Services\WebSocketService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;
use Carbon\Carbon;

class WebSocketServiceTest extends TestCase
{
    use DatabaseMigrations;

    private WebSocketService $service;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->service = new WebSocketService();
    }

    protected function tearDown(): void
    {
        Cache::flush();
        parent::tearDown();
    }

    /**
     * @test
     * Test service initialization
     */
    public function it_initializes_correctly()
    {
        $this->assertInstanceOf(WebSocketService::class, $this->service);

        // Check that cache keys are initialized
        $this->assertTrue(Cache::has('websocket_connections'));
        $this->assertTrue(Cache::has('websocket_rooms'));
        $this->assertTrue(Cache::has('websocket_metrics'));
    }

    /**
     * @test
     * Test registering a new connection
     */
    public function it_can_register_a_connection()
    {
        $userId = 'user_123';
        $roomId = 'room_456';
        $connectionId = 'conn_789';

        $connection = $this->service->registerConnection($userId, $roomId, $connectionId);

        $this->assertIsArray($connection);
        $this->assertEquals($userId, $connection['user_id']);
        $this->assertEquals($roomId, $connection['room_id']);
        $this->assertEquals($connectionId, $connection['connection_id']);
        $this->assertEquals('connected', $connection['status']);
        $this->assertArrayHasKey('connected_at', $connection);
        $this->assertArrayHasKey('last_activity', $connection);

        // Verify connection is stored in cache
        $connections = Cache::get('websocket_connections', []);
        $this->assertArrayHasKey($connectionId, $connections);
        $this->assertEquals($connection, $connections[$connectionId]);

        // Verify room is updated
        $rooms = Cache::get('websocket_rooms', []);
        $this->assertArrayHasKey($roomId, $rooms);
        $this->assertArrayHasKey($connectionId, $rooms[$roomId]);
    }

    /**
     * @test
     * Test unregistering a connection
     */
    public function it_can_unregister_a_connection()
    {
        $userId = 'user_123';
        $roomId = 'room_456';
        $connectionId = 'conn_789';

        // First register a connection
        $this->service->registerConnection($userId, $roomId, $connectionId);

        // Then unregister it
        $this->service->unregisterConnection($connectionId);

        // Verify connection is removed from cache
        $connections = Cache::get('websocket_connections', []);
        $this->assertArrayNotHasKey($connectionId, $connections);

        // Verify connection is removed from room
        $rooms = Cache::get('websocket_rooms', []);
        $this->assertArrayNotHasKey($connectionId, $rooms[$roomId]);
    }

    /**
     * @test
     * Test unregistering a non-existent connection
     */
    public function it_handles_unregistering_non_existent_connection()
    {
        $nonExistentConnectionId = 'conn_nonexistent';

        // Should not throw an exception
        $this->service->unregisterConnection($nonExistentConnectionId);

        $this->assertTrue(true); // Test passes if no exception is thrown
    }

    /**
     * @test
     * Test sending a message
     */
    public function it_can_send_a_message()
    {
        $roomId = 'room_123';
        $userId = 'user_456';
        $message = 'Hello, world!';
        $type = 'message';

        $result = $this->service->sendMessage($roomId, $userId, $message, $type);

        $this->assertIsArray($result);
        $this->assertEquals($roomId, $result['room_id']);
        $this->assertEquals($userId, $result['user_id']);
        $this->assertEquals($message, $result['message']);
        $this->assertEquals($type, $result['type']);
        $this->assertArrayHasKey('id', $result);
        $this->assertArrayHasKey('timestamp', $result);

        // Verify message is stored in room messages
        $roomMessages = Cache::get("room_messages_{$roomId}", []);
        $this->assertNotEmpty($roomMessages);
        $this->assertEquals($message, end($roomMessages)['message']);
    }

    /**
     * @test
     * Test sending a typing indicator
     */
    public function it_can_send_typing_indicator()
    {
        $roomId = 'room_123';
        $userId = 'user_456';
        $isTyping = true;

        $result = $this->service->sendTypingIndicator($roomId, $userId, $isTyping);

        $this->assertIsArray($result);
        $this->assertEquals($userId, $result['user_id']);
        $this->assertEquals($isTyping, $result['is_typing']);
        $this->assertArrayHasKey('timestamp', $result);
    }

    /**
     * @test
     * Test sending user activity
     */
    public function it_can_send_user_activity()
    {
        $roomId = 'room_123';
        $userId = 'user_456';
        $activity = 'file_uploaded';
        $data = ['filename' => 'test.pdf', 'size' => 1024];

        $result = $this->service->sendUserActivity($roomId, $userId, $activity, $data);

        $this->assertIsArray($result);
        $this->assertEquals($roomId, $result['room_id']);
        $this->assertEquals($userId, $result['user_id']);
        $this->assertEquals($activity, $result['activity']);
        $this->assertEquals($data, $result['data']);
        $this->assertArrayHasKey('timestamp', $result);
    }

    /**
     * @test
     * Test getting room messages
     */
    public function it_can_get_room_messages()
    {
        $roomId = 'room_123';

        // Send some test messages
        $this->service->sendMessage($roomId, 'user1', 'Message 1');
        $this->service->sendMessage($roomId, 'user2', 'Message 2');
        $this->service->sendMessage($roomId, 'user1', 'Message 3');

        $messages = $this->service->getRoomMessages($roomId);

        $this->assertIsArray($messages);
        $this->assertCount(3, $messages);
        $this->assertEquals('Message 1', $messages[0]['message']);
        $this->assertEquals('Message 2', $messages[1]['message']);
        $this->assertEquals('Message 3', $messages[2]['message']);
    }

    /**
     * @test
     * Test getting room messages with limit
     */
    public function it_can_get_room_messages_with_limit()
    {
        $roomId = 'room_123';

        // Send more test messages than the limit
        for ($i = 1; $i <= 10; $i++) {
            $this->service->sendMessage($roomId, 'user1', "Message {$i}");
        }

        $messages = $this->service->getRoomMessages($roomId, 5);

        $this->assertIsArray($messages);
        $this->assertCount(5, $messages);

        // Should return the last 5 messages
        $this->assertEquals('Message 6', $messages[0]['message']);
        $this->assertEquals('Message 10', $messages[4]['message']);
    }

    /**
     * @test
     * Test getting room connections
     */
    public function it_can_get_room_connections()
    {
        $roomId = 'room_123';

        // Register some connections
        $this->service->registerConnection('user1', $roomId, 'conn1');
        $this->service->registerConnection('user2', $roomId, 'conn2');
        $this->service->registerConnection('user3', $roomId, 'conn3');

        $connections = $this->service->getRoomConnections($roomId);

        $this->assertIsArray($connections);
        $this->assertCount(3, $connections);
        $this->assertArrayHasKey('conn1', $connections);
        $this->assertArrayHasKey('conn2', $connections);
        $this->assertArrayHasKey('conn3', $connections);
    }

    /**
     * @test
     * Test getting all connections
     */
    public function it_can_get_all_connections()
    {
        // Register connections in different rooms
        $this->service->registerConnection('user1', 'room1', 'conn1');
        $this->service->registerConnection('user2', 'room2', 'conn2');
        $this->service->registerConnection('user3', 'room1', 'conn3');

        $allConnections = $this->service->getAllConnections();

        $this->assertIsArray($allConnections);
        $this->assertCount(3, $allConnections);
        $this->assertArrayHasKey('conn1', $allConnections);
        $this->assertArrayHasKey('conn2', $allConnections);
        $this->assertArrayHasKey('conn3', $allConnections);
    }

    /**
     * @test
     * Test updating connection activity
     */
    public function it_can_update_connection_activity()
    {
        $userId = 'user_123';
        $roomId = 'room_456';
        $connectionId = 'conn_789';

        // Register a connection
        $this->service->registerConnection($userId, $roomId, $connectionId);

        // Wait a moment to ensure timestamp difference
        sleep(1);

        // Update activity
        $this->service->updateConnectionActivity($connectionId);

        // Check that last_activity was updated
        $connections = $this->service->getRoomConnections($roomId);
        $connection = $connections[$connectionId];

        $this->assertGreaterThan(
            $connection['connected_at']->timestamp,
            $connection['last_activity']->timestamp
        );
    }

    /**
     * @test
     * Test cleanup of inactive connections
     */
    public function it_can_cleanup_inactive_connections()
    {
        $roomId = 'room_123';

        // Register some connections
        $this->service->registerConnection('user1', $roomId, 'conn1');
        $this->service->registerConnection('user2', $roomId, 'conn2');

        // Manually set one connection as inactive
        $connections = Cache::get('websocket_connections', []);
        $connections['conn2']['last_activity'] = now()->subMinutes(10);
        Cache::put('websocket_connections', $connections, now()->addHours(24));

        // Cleanup connections inactive for more than 5 minutes
        $remainingConnections = $this->service->cleanupInactiveConnections(5);

        $this->assertEquals(1, $remainingConnections);

        // Check that only the active connection remains
        $activeConnections = $this->service->getRoomConnections($roomId);
        $this->assertCount(1, $activeConnections);
        $this->assertArrayHasKey('conn1', $activeConnections);
        $this->assertArrayNotHasKey('conn2', $activeConnections);
    }

    /**
     * @test
     * Test getting metrics
     */
    public function it_can_get_metrics()
    {
        // Perform some operations to generate metrics
        $this->service->registerConnection('user1', 'room1', 'conn1');
        $this->service->sendMessage('room1', 'user1', 'Test message');

        $metrics = $this->service->getMetrics();

        $this->assertIsArray($metrics);
        $this->assertArrayHasKey('total_connections', $metrics);
        $this->assertArrayHasKey('active_connections', $metrics);
        $this->assertArrayHasKey('messages_sent', $metrics);
        $this->assertArrayHasKey('messages_received', $metrics);
        $this->assertArrayHasKey('errors', $metrics);
        $this->assertEquals(1, $metrics['total_connections']);
        $this->assertEquals(1, $metrics['active_connections']);
        $this->assertEquals(1, $metrics['messages_sent']);
    }

    /**
     * @test
     * Test clearing session data
     */
    public function it_can_clear_session_data()
    {
        $roomId1 = 'room1';
        $roomId2 = 'room2';

        // Create some data
        $this->service->registerConnection('user1', $roomId1, 'conn1');
        $this->service->sendMessage($roomId1, 'user1', 'Message 1');
        $this->service->registerConnection('user2', $roomId2, 'conn2');
        $this->service->sendMessage($roomId2, 'user2', 'Message 2');

        // Clear data for specific room
        $this->service->clearSessionData($roomId1);

        // Check that room1 data is cleared but room2 remains
        $room1Messages = Cache::get("room_messages_{$roomId1}", []);
        $room2Messages = Cache::get("room_messages_{$roomId2}", []);

        $this->assertEmpty($room1Messages);
        $this->assertNotEmpty($room2Messages);
    }

    /**
     * @test
     * Test clearing all session data
     */
    public function it_can_clear_all_session_data()
    {
        // Create some data
        $this->service->registerConnection('user1', 'room1', 'conn1');
        $this->service->sendMessage('room1', 'user1', 'Message 1');

        // Clear all data
        $this->service->clearSessionData();

        // Check that all cache data is cleared
        $this->assertFalse(Cache::has('websocket_connections'));
        $this->assertFalse(Cache::has('websocket_rooms'));
        $this->assertFalse(Cache::has('websocket_metrics'));
        $this->assertFalse(Cache::has('room_messages_room1'));
    }

    /**
     * @test
     * Test getting system health
     */
    public function it_can_get_system_health()
    {
        // Create some activity
        $this->service->registerConnection('user1', 'room1', 'conn1');
        $this->service->sendMessage('room1', 'user1', 'Test message');

        $health = $this->service->getSystemHealth();

        $this->assertIsArray($health);
        $this->assertArrayHasKey('status', $health);
        $this->assertArrayHasKey('active_connections', $health);
        $this->assertArrayHasKey('total_rooms', $health);
        $this->assertArrayHasKey('messages_sent', $health);
        $this->assertArrayHasKey('cache_status', $health);
        $this->assertEquals('healthy', $health['status']);
        $this->assertEquals(1, $health['active_connections']);
        $this->assertEquals(1, $health['total_rooms']);
        $this->assertEquals(1, $health['messages_sent']);
    }

    /**
     * @test
     * Test connection limits
     */
    public function it_handles_connection_limits()
    {
        $roomId = 'room_123';
        $maxConnections = 100;

        // Try to register more than the maximum connections
        for ($i = 1; $i <= $maxConnections + 10; $i++) {
            $this->service->registerConnection("user_{$i}", $roomId, "conn_{$i}");
        }

        $connections = $this->service->getRoomConnections($roomId);

        // Should enforce some reasonable limit (implementation specific)
        $this->assertLessThanOrEqual($maxConnections, count($connections));
    }

    /**
     * @test
     * Test message validation
     */
    public function it_validates_message_content()
    {
        $roomId = 'room_123';
        $userId = 'user_456';

        // Test empty message
        $result = $this->service->sendMessage($roomId, $userId, '');
        $this->assertIsArray($result);

        // Test very long message (should be truncated or handled)
        $longMessage = str_repeat('a', 2000);
        $result = $this->service->sendMessage($roomId, $userId, $longMessage);
        $this->assertIsArray($result);
        $this->assertLessThanOrEqual(1000, strlen($result['message']));
    }

    /**
     * @test
     * Test concurrent connection handling
     */
    public function it_handles_concurrent_connections()
    {
        $roomId = 'room_concurrent';
        $userCount = 10;

        // Simulate multiple users connecting to the same room
        for ($i = 1; $i <= $userCount; $i++) {
            $this->service->registerConnection("user_{$i}", $roomId, "conn_{$i}");
        }

        $connections = $this->service->getRoomConnections($roomId);
        $this->assertCount($userCount, $connections);

        // All users should be able to send messages
        for ($i = 1; $i <= $userCount; $i++) {
            $result = $this->service->sendMessage($roomId, "user_{$i}", "Message from user {$i}");
            $this->assertIsArray($result);
        }

        // All messages should be stored
        $messages = $this->service->getRoomMessages($roomId);
        $this->assertCount($userCount, $messages);
    }

    /**
     * @test
     * Test error handling in metrics
     */
    public function it_handles_metrics_errors_gracefully()
    {
        // Simulate cache failure scenario
        Cache::shouldReceive('get')->with('websocket_metrics')->andReturn(null);
        Cache::shouldReceive('put')->andReturn(true);
        Cache::shouldReceive('flush')->andReturn(true);

        // Should return default metrics
        $metrics = $this->service->getMetrics();
        $this->assertIsArray($metrics);
        $this->assertEquals(0, $metrics['total_connections']);
        $this->assertEquals(0, $metrics['active_connections']);
    }

    /**
     * @test
     * Test room isolation
     */
    public function it_maintains_room_isolation()
    {
        $room1 = 'room_1';
        $room2 = 'room_2';

        // Add connections and messages to different rooms
        $this->service->registerConnection('user1', $room1, 'conn1');
        $this->service->sendMessage($room1, 'user1', 'Room 1 message');

        $this->service->registerConnection('user2', $room2, 'conn2');
        $this->service->sendMessage($room2, 'user2', 'Room 2 message');

        // Check room isolation
        $room1Connections = $this->service->getRoomConnections($room1);
        $room2Connections = $this->service->getRoomConnections($room2);

        $this->assertCount(1, $room1Connections);
        $this->assertCount(1, $room2Connections);
        $this->assertArrayHasKey('conn1', $room1Connections);
        $this->assertArrayHasKey('conn2', $room2Connections);

        $room1Messages = $this->service->getRoomMessages($room1);
        $room2Messages = $this->service->getRoomMessages($room2);

        $this->assertEquals('Room 1 message', $room1Messages[0]['message']);
        $this->assertEquals('Room 2 message', $room2Messages[0]['message']);
    }
}
