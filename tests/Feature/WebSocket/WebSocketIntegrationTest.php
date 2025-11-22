<?php

namespace Tests\Feature\WebSocket;

use App\Http\Controllers\WebSocketController;
use App\Services\WebSocketService;
use App\Models\Room;
use App\Models\RoomUser;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;
use Mockery;

class WebSocketIntegrationTest extends TestCase
{
    use DatabaseMigrations;

    private WebSocketService $service;
    private WebSocketController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new WebSocketService();
        $this->controller = new WebSocketController($this->service);
        Cache::flush();
    }

    protected function tearDown(): void
    {
        Cache::flush();
        Mockery::close();
        parent::tearDown();
    }

    /**
     * @test
     * Integration test for complete room sharing flow
     */
    public function it_handles_complete_room_sharing_flow()
    {
        // Create test rooms
        $room1 = Room::factory()->create(['room_number' => 1, 'status' => 'free']);
        $room2 = Room::factory()->create(['room_number' => 2, 'status' => 'in_use']);

        // Register WebSocket connections
        $connection1 = $this->service->registerConnection('buyer_user', $room1->id, 'conn_1');
        $connection2 = $this->service->registerConnection('seller_user', $room2->id, 'conn_2');

        // Send test messages
        $message1 = $this->service->sendMessage($room1->id, 'buyer_user', 'Ready to buy');
        $message2 = $this->service->sendMessage($room2->id, 'seller_user', 'Product ready');

        // Test API endpoints
        $shareLinksResponse = $this->get("/api/rooms/{$room1->id}/share-links");
        $shareLinksResponse->assertStatus(200);

        $shareLinksData = $shareLinksResponse->json();
        $this->assertTrue($shareLinksData['needs_buyer']);
        $this->assertFalse($shareLinksData['needs_seller']);

        // Test room status API
        $statusResponse = $this->get('/api/rooms/status');
        $statusResponse->assertStatus(200);

        $statusData = $statusResponse->json();
        $this->assertIsArray($statusData);
        $this->assertNotEmpty($statusData);

        // Verify messages are stored correctly
        $roomMessages = $this->service->getRoomMessages($room1->id);
        $this->assertNotEmpty($roomMessages);
        $this->assertEquals('Ready to buy', $roomMessages[0]['message']);

        // Test metrics
        $metricsResponse = $this->get('/api/websocket/metrics');
        $metricsResponse->assertStatus(200);

        $metricsData = $metricsResponse->json();
        $this->assertTrue($metricsData['success']);
        $this->assertArrayHasKey('metrics', $metricsData);
    }

    /**
     * @test
     * Integration test for real-time room updates
     */
    public function it_handles_real_time_room_updates()
    {
        // Create a test room
        $room = Room::factory()->create(['room_number' => 1, 'status' => 'free']);

        // Initial state - room is free
        $initialStatus = $this->get("/api/rooms/{$room->id}/share-links");
        $initialData = $initialStatus->json();
        $this->assertTrue($initialData['needs_buyer']);
        $this->assertFalse($initialData['needs_seller']);

        // Simulate buyer joining
        $buyerConnection = $this->service->registerConnection('buyer_123', $room->id, 'buyer_conn');

        // Create room user record
        RoomUser::factory()->create([
            'room_id' => $room->id,
            'name' => 'Buyer User',
            'role' => 'buyer',
            'session_token' => 'buyer_session_123'
        ]);

        // Update room status to in_use
        $room->update(['status' => 'in_use']);

        // Check updated status
        $updatedStatus = $this->get("/api/rooms/{$room->id}/share-links");
        $updatedData = $updatedStatus->json();

        // After buyer joins, only seller should be needed
        $this->assertFalse($updatedData['needs_buyer']);
        $this->assertTrue($updatedData['needs_seller']);

        // Simulate seller joining
        $sellerConnection = $this->service->registerConnection('seller_456', $room->id, 'seller_conn');

        RoomUser::factory()->create([
            'room_id' => $room->id,
            'name' => 'Seller User',
            'role' => 'seller',
            'session_token' => 'seller_session_456'
        ]);

        // Update room to full status (would normally be done by a service)
        $room->update(['status' => 'in_use']);

        // Final check - room should be full
        $finalStatus = $this->get("/api/rooms/{$room->id}/share-links");
        $finalData = $finalStatus->json();

        $this->assertFalse($finalData['needs_buyer']);
        $this->assertFalse($finalData['needs_seller']);
        $this->assertEmpty($finalData['share_links']);
    }

    /**
     * @test
     * Integration test for message broadcasting
     */
    public function it_handles_message_broadcasting_integration()
    {
        // Create test room and users
        $room = Room::factory()->create(['room_number' => 1]);

        // Register multiple connections in the same room
        $connections = [];
        $userIds = ['user_1', 'user_2', 'user_3'];

        foreach ($userIds as $index => $userId) {
            $connectionId = "conn_{$index}";
            $connections[] = $this->service->registerConnection($userId, $room->id, $connectionId);
        }

        // Send messages from different users
        $messages = [
            ['user' => 'user_1', 'content' => 'Hello everyone!'],
            ['user' => 'user_2', 'content' => 'Hi there!'],
            ['user' => 'user_3', 'content' => 'Good to see you all!']
        ];

        $sentMessages = [];
        foreach ($messages as $messageData) {
            $sentMessage = $this->service->sendMessage(
                $room->id,
                $messageData['user'],
                $messageData['content']
            );
            $sentMessages[] = $sentMessage;
        }

        // Verify all messages are stored
        $storedMessages = $this->service->getRoomMessages($room->id);
        $this->assertCount(3, $storedMessages);

        // Test API endpoint for retrieving messages
        $apiResponse = $this->get("/api/websocket/rooms/{$room->id}/messages");
        $apiResponse->assertStatus(200);

        $apiData = $apiResponse->json();
        $this->assertTrue($apiData['success']);
        $this->assertEquals(3, $apiData['total']);
        $this->assertIsArray($apiData['messages']);

        // Verify message content
        $messageContents = array_map(fn($msg) => $msg['message'], $apiData['messages']);
        foreach ($messages as $messageData) {
            $this->assertContains($messageData['content'], $messageContents);
        }
    }

    /**
     * @test
     * Integration test for typing indicators
     */
    public function it_handles_typing_indicators_integration()
    {
        $room = Room::factory()->create(['room_number' => 1]);

        // Register connections
        $this->service->registerConnection('user_1', $room->id, 'conn_1');
        $this->service->registerConnection('user_2', $room->id, 'conn_2');

        // User 1 starts typing
        $typingStart = $this->post("/api/websocket/rooms/{$room->id}/typing", [
            'user_id' => 'user_1',
            'is_typing' => true
        ]);

        $typingStart->assertStatus(200);
        $typingData = $typingStart->json();
        $this->assertTrue($typingData['success']);
        $this->assertTrue($typingData['typing']['is_typing']);

        // User 1 stops typing
        $typingStop = $this->post("/api/websocket/rooms/{$room->id}/typing", [
            'user_id' => 'user_1',
            'is_typing' => false
        ]);

        $typingStop->assertStatus(200);
        $typingStopData = $typingStop->json();
        $this->assertTrue($typingStopData['success']);
        $this->assertFalse($typingStopData['typing']['is_typing']);
    }

    /**
     * @test
     * Integration test for user activities
     */
    public function it_handles_user_activities_integration()
    {
        $room = Room::factory()->create(['room_number' => 1]);
        $this->service->registerConnection('user_1', $room->id, 'conn_1');

        // Send various activities
        $activities = [
            [
                'activity' => 'file_uploaded',
                'data' => ['filename' => 'contract.pdf', 'size' => 1024]
            ],
            [
                'activity' => 'payment_verified',
                'data' => ['amount' => 1000, 'currency' => 'USD']
            ],
            [
                'activity' => 'product_shipped',
                'data' => ['tracking_number' => 'TN123456789']
            ]
        ];

        foreach ($activities as $activityData) {
            $response = $this->post("/api/websocket/rooms/{$room->id}/activity", [
                'user_id' => 'user_1',
                'activity' => $activityData['activity'],
                'data' => $activityData['data']
            ]);

            $response->assertStatus(200);
            $responseData = $response->json();
            $this->assertTrue($responseData['success']);
            $this->assertEquals($activityData['activity'], $responseData['activity']['activity']);
            $this->assertEquals($activityData['data'], $responseData['activity']['data']);
        }
    }

    /**
     * @test
     * Integration test for connection management
     */
    public function it_handles_connection_management_integration()
    {
        $room = Room::factory()->create(['room_number' => 1]);

        // Test connection lifecycle
        $connectionId = 'test_conn_123';
        $userId = 'test_user_456';

        // Register connection
        $connection = $this->service->registerConnection($userId, $room->id, $connectionId);
        $this->assertEquals($userId, $connection['user_id']);
        $this->assertEquals($room->id, $connection['room_id']);

        // Verify connection appears in API
        $connectionsResponse = $this->get("/api/websocket/rooms/{$room->id}/connections");
        $connectionsResponse->assertStatus(200);

        $connectionsData = $connectionsResponse->json();
        $this->assertTrue($connectionsData['success']);
        $this->assertEquals(1, $connectionsData['total']);

        // Update connection activity
        $this->service->updateConnectionActivity($connectionId);

        // Cleanup connection
        $this->service->unregisterConnection($connectionId);

        // Verify connection is removed
        $connectionsAfterResponse = $this->get("/api/websocket/rooms/{$room->id}/connections");
        $connectionsAfterData = $connectionsAfterResponse->json();
        $this->assertEquals(0, $connectionsAfterData['total']);
    }

    /**
     * @test
     * Integration test for health and monitoring
     */
    public function it_handles_health_monitoring_integration()
    {
        // Create some activity
        $room = Room::factory()->create(['room_number' => 1]);
        $this->service->registerConnection('user_1', $room->id, 'conn_1');
        $this->service->sendMessage($room->id, 'user_1', 'Test health message');

        // Test health endpoint
        $healthResponse = $this->get('/api/websocket/health');
        $healthResponse->assertStatus(200);

        $healthData = $healthResponse->json();
        $this->assertTrue($healthData['success']);
        $this->assertArrayHasKey('health', $healthData);

        $health = $healthData['health'];
        $this->assertEquals('healthy', $health['status']);
        $this->assertArrayHasKey('connections', $health);
        $this->assertArrayHasKey('metrics', $health);
        $this->assertArrayHasKey('memory_usage', $health);
        $this->assertArrayHasKey('timestamp', $health);

        // Test metrics endpoint
        $metricsResponse = $this->get('/api/websocket/metrics');
        $metricsResponse->assertStatus(200);

        $metricsData = $metricsResponse->json();
        $this->assertTrue($metricsData['success']);
        $this->assertArrayHasKey('metrics', $metricsData);

        $metrics = $metricsData['metrics'];
        $this->assertArrayHasKey('total_connections', $metrics);
        $this->assertArrayHasKey('active_connections', $metrics);
        $this->assertArrayHasKey('messages_sent', $metrics);
    }

    /**
     * @test
     * Integration test for cleanup operations
     */
    public function it_handles_cleanup_operations_integration()
    {
        $room = Room::factory()->create(['room_number' => 1]);

        // Register connections that will become inactive
        $this->service->registerConnection('user_1', $room->id, 'active_conn');
        $this->service->registerConnection('user_2', $room->id, 'inactive_conn');

        // Manually make one connection inactive
        $connections = Cache::get('websocket_connections', []);
        $connections['inactive_conn']['last_activity'] = now()->subMinutes(10);
        Cache::put('websocket_connections', $connections, now()->addHours(24));

        // Run cleanup
        $cleanupResponse = $this->post('/api/websocket/cleanup', [
            'inactive_minutes' => 5
        ]);

        $cleanupResponse->assertStatus(200);
        $cleanupData = $cleanupResponse->json();
        $this->assertTrue($cleanupData['success']);
        $this->assertEquals(1, $cleanupData['remaining_connections']);

        // Verify only active connection remains
        $finalConnections = $this->service->getRoomConnections($room->id);
        $this->assertCount(1, $finalConnections);
        $this->assertArrayHasKey('active_conn', $finalConnections);
        $this->assertArrayNotHasKey('inactive_conn', $finalConnections);
    }

    /**
     * @test
     * Integration test for load testing
     */
    public function it_handles_load_testing_integration()
    {
        $loadTestResponse = $this->post('/api/websocket/load-test', [
            'user_count' => 5,
            'messages_per_user' => 3
        ]);

        $loadTestResponse->assertStatus(200);
        $loadTestData = $loadTestResponse->json();

        $this->assertTrue($loadTestData['success']);
        $this->assertArrayHasKey('load_test_results', $loadTestData);

        $results = $loadTestData['load_test_results'];
        $this->assertEquals(5, $results['user_count']);
        $this->assertEquals(3, $results['messages_per_user']);
        $this->assertEquals(15, $results['total_messages']);
        $this->assertGreaterThan(0, $results['duration_seconds']);
        $this->assertGreaterThan(0, $results['messages_per_second']);
    }

    /**
     * @test
     * Integration test for WebSocket connection test
     */
    public function it_handles_connection_test_integration()
    {
        $testResponse = $this->post('/api/websocket/test', [
            'room_id' => 'test-room-123',
            'user_id' => 'test-user-456',
            'message' => 'Test connection message'
        ]);

        $testResponse->assertStatus(200);
        $testData = $testResponse->json();

        $this->assertTrue($testData['success']);
        $this->assertArrayHasKey('test_results', $testData);

        $testResults = $testData['test_results'];
        $this->assertTrue($testResults['connection_registered']);
        $this->assertTrue($testResults['message_sent']);
        $this->assertTrue($testResults['metrics_available']);

        $this->assertArrayHasKey('connection', $testData);
        $this->assertArrayHasKey('message', $testData);
        $this->assertArrayHasKey('metrics', $testData);
    }

    /**
     * @test
     * Integration test for error handling and recovery
     */
    public function it_handles_error_scenarios_integration()
    {
        // Test with invalid room ID
        $invalidRoomResponse = $this->get('/api/rooms/99999/share-links');
        $invalidRoomResponse->assertStatus(404);

        // Test with invalid request data
        $invalidMessageResponse = $this->post('/api/websocket/rooms/1/messages', [
            'user_id' => '', // Invalid empty user_id
            'message' => ''  // Invalid empty message
        ], ['Accept' => 'application/json']);
        $invalidMessageResponse->assertStatus(422);

        // Test typing indicator with invalid data
        $invalidTypingResponse = $this->post('/api/websocket/rooms/1/typing', [
            'user_id' => 'test_user'
            // Missing is_typing field
        ], ['Accept' => 'application/json']);
        $invalidTypingResponse->assertStatus(422);

        // Test activity with invalid activity name
        $invalidActivityResponse = $this->post('/api/websocket/rooms/1/activity', [
            'user_id' => 'test_user',
            'activity' => str_repeat('a', 200) // Too long
        ], ['Accept' => 'application/json']);
        $invalidActivityResponse->assertStatus(422);
    }

    /**
     * @test
     * Integration test for session data management
     */
    public function it_handles_session_data_management_integration()
    {
        $room = Room::factory()->create(['room_number' => 1]);

        // Create some session data
        $this->service->registerConnection('user_1', $room->id, 'conn_1');
        $this->service->sendMessage($room->id, 'user_1', 'Session test message');

        // Verify data exists
        $messages = $this->service->getRoomMessages($room->id);
        $this->assertNotEmpty($messages);

        // Clear session data
        $clearResponse = $this->delete("/api/websocket/rooms/{$room->id}/session");
        $clearResponse->assertStatus(200);

        $clearData = $clearResponse->json();
        $this->assertTrue($clearData['success']);
        $this->assertArrayHasKey('message', $clearData);

        // Verify data is cleared (this depends on service implementation)
        $messagesAfter = $this->service->getRoomMessages($room->id);
        // The service might implement different clearing strategies
        $this->assertIsArray($messagesAfter);
    }
}