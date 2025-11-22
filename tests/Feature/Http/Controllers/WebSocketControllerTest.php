<?php

namespace Tests\Feature\Http\Controllers;

use App\Http\Controllers\WebSocketController;
use App\Services\WebSocketService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;
use Mockery;

class WebSocketControllerTest extends TestCase
{
    use DatabaseMigrations;

    private $mockWebSocketService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockWebSocketService = Mockery::mock(WebSocketService::class);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /**
     * @test
     * Test getting room messages successfully
     */
    public function it_can_get_room_messages_successfully()
    {
        // Arrange
        $roomId = 'test-room-1';
        $expectedMessages = [
            [
                'id' => 'msg_1',
                'room_id' => $roomId,
                'user_id' => 'user_1',
                'message' => 'Hello, world!',
                'type' => 'message',
                'timestamp' => now()->toISOString()
            ]
        ];

        $this->mockWebSocketService
            ->shouldReceive('getRoomMessages')
            ->with($roomId, 50)
            ->once()
            ->andReturn($expectedMessages);

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/rooms/' . $roomId . '/messages', 'GET');

        // Act
        $response = $controller->getRoomMessages($request, $roomId);

        // Assert
        $this->assertInstanceOf(JsonResponse::class, $response);
        $this->assertEquals(200, $response->getStatusCode());

        $responseData = $response->getData(true);
        $this->assertTrue($responseData['success']);
        $this->assertEquals($expectedMessages, $responseData['messages']);
        $this->assertEquals(1, $responseData['total']);
    }

    /**
     * @test
     * Test getting room messages with custom limit
     */
    public function it_can_get_room_messages_with_custom_limit()
    {
        // Arrange
        $roomId = 'test-room-2';
        $customLimit = 25;
        $expectedMessages = [];

        $this->mockWebSocketService
            ->shouldReceive('getRoomMessages')
            ->with($roomId, $customLimit)
            ->once()
            ->andReturn($expectedMessages);

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/rooms/' . $roomId . '/messages', 'GET', [
            'limit' => $customLimit
        ]);

        // Act
        $response = $controller->getRoomMessages($request, $roomId);

        // Assert
        $this->assertEquals(200, $response->getStatusCode());
        $responseData = $response->getData(true);
        $this->assertTrue($responseData['success']);
        $this->assertEquals(0, $responseData['total']);
    }

    /**
     * @test
     * Test getting room messages with maximum limit enforced
     */
    public function it_enforces_maximum_limit_for_room_messages()
    {
        // Arrange
        $roomId = 'test-room-3';
        $excessiveLimit = 200; // Above the 100 max

        $this->mockWebSocketService
            ->shouldReceive('getRoomMessages')
            ->with($roomId, 100) // Should be capped at 100
            ->once()
            ->andReturn([]);

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/rooms/' . $roomId . '/messages', 'GET', [
            'limit' => $excessiveLimit
        ]);

        // Act
        $response = $controller->getRoomMessages($request, $roomId);

        // Assert
        $this->assertEquals(200, $response->getStatusCode());
    }

    /**
     * @test
     * Test getting room messages with service exception
     */
    public function it_handles_service_exception_when_getting_room_messages()
    {
        // Arrange
        $roomId = 'test-room-4';
        $exception = new \Exception('Service error');

        $this->mockWebSocketService
            ->shouldReceive('getRoomMessages')
            ->andThrow($exception);

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/rooms/' . $roomId . '/messages', 'GET');

        Log::shouldReceive('error')
            ->once()
            ->with('Failed to get room messages', Mockery::type('array'));

        // Act
        $response = $controller->getRoomMessages($request, $roomId);

        // Assert
        $this->assertEquals(500, $response->getStatusCode());
        $responseData = $response->getData(true);
        $this->assertFalse($responseData['success']);
        $this->assertEquals('Failed to retrieve messages', $responseData['error']);
    }

    /**
     * @test
     * Test getting room connections successfully
     */
    public function it_can_get_room_connections_successfully()
    {
        // Arrange
        $roomId = 'test-room-5';
        $expectedConnections = [
            'conn_1' => [
                'id' => 'conn_1',
                'user_id' => 'user_1',
                'room_id' => $roomId,
                'connected_at' => now()->toISOString(),
                'last_activity' => now()->toISOString()
            ]
        ];

        $this->mockWebSocketService
            ->shouldReceive('getRoomConnections')
            ->with($roomId)
            ->once()
            ->andReturn($expectedConnections);

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/rooms/' . $roomId . '/connections', 'GET');

        // Act
        $response = $controller->getRoomConnections($request, $roomId);

        // Assert
        $this->assertEquals(200, $response->getStatusCode());
        $responseData = $response->getData(true);
        $this->assertTrue($responseData['success']);
        $this->assertEquals(array_values($expectedConnections), $responseData['connections']);
        $this->assertEquals(1, $responseData['total']);
    }

    /**
     * @test
     * Test sending a message successfully
     */
    public function it_can_send_message_successfully()
    {
        // Arrange
        $roomId = 'test-room-6';
        $userId = 'user-123';
        $message = 'Test message';
        $expectedMessage = [
            'id' => 'msg_new',
            'room_id' => $roomId,
            'user_id' => $userId,
            'message' => $message,
            'type' => 'message',
            'timestamp' => now()->toISOString()
        ];

        $this->mockWebSocketService
            ->shouldReceive('sendMessage')
            ->with($roomId, $userId, $message, 'message')
            ->once()
            ->andReturn($expectedMessage);

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/rooms/' . $roomId . '/messages', 'POST', [
            'message' => $message,
            'user_id' => $userId,
            'type' => 'message'
        ]);

        // Act
        $response = $controller->sendMessage($request, $roomId);

        // Assert
        $this->assertEquals(200, $response->getStatusCode());
        $responseData = $response->getData(true);
        $this->assertTrue($responseData['success']);
        $this->assertEquals($expectedMessage, $responseData['message']);
    }

    /**
     * @test
     * Test sending message validation failure
     */
    public function it_validates_message_request_data()
    {
        // Arrange
        $roomId = 'test-room-7';
        $invalidRequest = Request::create('/api/websocket/rooms/' . $roomId . '/messages', 'POST', [
            'message' => '', // Empty message
            'user_id' => ''  // Empty user_id
        ]);

        $controller = new WebSocketController($this->mockWebSocketService);

        // Act
        $response = $controller->sendMessage($invalidRequest, $roomId);

        // Assert
        $this->assertEquals(422, $response->getStatusCode());
        $responseData = $response->getData(true);
        $this->assertArrayHasKey('message', $responseData);
        $this->assertArrayHasKey('errors', $responseData);
    }

    /**
     * @test
     * Test sending typing indicator successfully
     */
    public function it_can_send_typing_indicator_successfully()
    {
        // Arrange
        $roomId = 'test-room-8';
        $userId = 'user-456';
        $isTyping = true;
        $expectedTypingData = [
            'user_id' => $userId,
            'is_typing' => $isTyping,
            'timestamp' => now()->toISOString()
        ];

        $this->mockWebSocketService
            ->shouldReceive('sendTypingIndicator')
            ->with($roomId, $userId, $isTyping)
            ->once()
            ->andReturn($expectedTypingData);

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/rooms/' . $roomId . '/typing', 'POST', [
            'user_id' => $userId,
            'is_typing' => $isTyping
        ]);

        // Act
        $response = $controller->sendTyping($request, $roomId);

        // Assert
        $this->assertEquals(200, $response->getStatusCode());
        $responseData = $response->getData(true);
        $this->assertTrue($responseData['success']);
        $this->assertEquals($expectedTypingData, $responseData['typing']);
    }

    /**
     * @test
     * Test sending typing indicator validation failure
     */
    public function it_validates_typing_request_data()
    {
        // Arrange
        $roomId = 'test-room-9';
        $invalidRequest = Request::create('/api/websocket/rooms/' . $roomId . '/typing', 'POST', [
            'user_id' => 'user-123'
            // Missing 'is_typing' field
        ]);

        $controller = new WebSocketController($this->mockWebSocketService);

        // Act
        $response = $controller->sendTyping($invalidRequest, $roomId);

        // Assert
        $this->assertEquals(422, $response->getStatusCode());
    }

    /**
     * @test
     * Test getting system health successfully
     */
    public function it_can_get_system_health_successfully()
    {
        // Arrange
        $expectedHealth = [
            'status' => 'healthy',
            'active_connections' => 15,
            'memory_usage' => '45MB',
            'uptime' => '2 days, 3 hours'
        ];

        $this->mockWebSocketService
            ->shouldReceive('getSystemHealth')
            ->once()
            ->andReturn($expectedHealth);

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/health', 'GET');

        // Act
        $response = $controller->getHealth();

        // Assert
        $this->assertEquals(200, $response->getStatusCode());
        $responseData = $response->getData(true);
        $this->assertTrue($responseData['success']);
        $this->assertEquals($expectedHealth, $responseData['health']);
    }

    /**
     * @test
     * Test connection test functionality
     */
    public function it_can_test_websocket_connection_successfully()
    {
        // Arrange
        $roomId = 'test-room-10';
        $userId = 'test-user';
        $message = 'Test message';
        $connectionId = 'test_conn_' . time();

        $expectedConnection = [
            'id' => $connectionId,
            'user_id' => $userId,
            'room_id' => $roomId
        ];

        $expectedMessage = [
            'id' => 'test_msg',
            'message' => $message,
            'room_id' => $roomId,
            'user_id' => $userId
        ];

        $expectedMessages = [$expectedMessage];
        $expectedMetrics = [
            'active_connections' => 1,
            'total_messages' => 1
        ];

        // Mock service method calls
        $this->mockWebSocketService
            ->shouldReceive('registerConnection')
            ->with($userId, $roomId, Mockery::type('string'))
            ->once()
            ->andReturn($expectedConnection);

        $this->mockWebSocketService
            ->shouldReceive('sendMessage')
            ->with($roomId, $userId, $message)
            ->once()
            ->andReturn($expectedMessage);

        $this->mockWebSocketService
            ->shouldReceive('getRoomMessages')
            ->with($roomId, 5)
            ->once()
            ->andReturn($expectedMessages);

        $this->mockWebSocketService
            ->shouldReceive('getMetrics')
            ->once()
            ->andReturn($expectedMetrics);

        $this->mockWebSocketService
            ->shouldReceive('unregisterConnection')
            ->with($connectionId)
            ->once();

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/test', 'POST', [
            'room_id' => $roomId,
            'user_id' => $userId,
            'message' => $message
        ]);

        // Act
        $response = $controller->testConnection($request);

        // Assert
        $this->assertEquals(200, $response->getStatusCode());
        $responseData = $response->getData(true);
        $this->assertTrue($responseData['success']);
        $this->assertTrue($responseData['test_results']['connection_registered']);
        $this->assertTrue($responseData['test_results']['message_sent']);
        $this->assertTrue($responseData['test_results']['metrics_available']);
    }

    /**
     * @test
     * Test load test functionality
     */
    public function it_can_perform_load_test_successfully()
    {
        // Arrange
        $userCount = 5;
        $messagesPerUser = 3;
        $roomId = 'load-test-room';

        $expectedMetrics = [
            'active_connections' => 0, // After cleanup
            'total_messages_sent' => $userCount * $messagesPerUser
        ];

        // Mock service method calls
        $this->mockWebSocketService
            ->shouldReceive('registerConnection')
            ->times($userCount)
            ->andReturn(['id' => 'test-connection']);

        $this->mockWebSocketService
            ->shouldReceive('sendMessage')
            ->times($userCount * $messagesPerUser)
            ->andReturn(['id' => 'test-message']);

        $this->mockWebSocketService
            ->shouldReceive('unregisterConnection')
            ->times($userCount);

        $this->mockWebSocketService
            ->shouldReceive('getMetrics')
            ->once()
            ->andReturn($expectedMetrics);

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/load-test', 'POST', [
            'user_count' => $userCount,
            'messages_per_user' => $messagesPerUser,
            'room_id' => $roomId
        ]);

        // Act
        $response = $controller->loadTest($request);

        // Assert
        $this->assertEquals(200, $response->getStatusCode());
        $responseData = $response->getData(true);
        $this->assertTrue($responseData['success']);
        $this->assertEquals($userCount, $responseData['load_test_results']['user_count']);
        $this->assertEquals($messagesPerUser, $responseData['load_test_results']['messages_per_user']);
        $this->assertEquals($userCount * $messagesPerUser, $responseData['load_test_results']['total_messages']);
    }

    /**
     * @test
     * Test load test validation constraints
     */
    public function it_enforces_load_test_validation_constraints()
    {
        // Arrange
        $excessiveUserCount = 150; // Above the 100 max
        $excessiveMessagesPerUser = 75; // Above the 50 max

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/load-test', 'POST', [
            'user_count' => $excessiveUserCount,
            'messages_per_user' => $excessiveMessagesPerUser
        ]);

        // Act
        $response = $controller->loadTest($request);

        // Assert
        $this->assertEquals(422, $response->getStatusCode());
        $responseData = $response->getData(true);
        $this->assertArrayHasKey('errors', $responseData);
    }

    /**
     * @test
     * Test cleanup connections functionality
     */
    public function it_can_cleanup_inactive_connections_successfully()
    {
        // Arrange
        $inactiveMinutes = 10;
        $remainingConnections = 3;

        $this->mockWebSocketService
            ->shouldReceive('cleanupInactiveConnections')
            ->with($inactiveMinutes)
            ->once()
            ->andReturn($remainingConnections);

        $controller = new WebSocketController($this->mockWebSocketService);
        $request = Request::create('/api/websocket/cleanup', 'POST', [
            'inactive_minutes' => $inactiveMinutes
        ]);

        // Act
        $response = $controller->cleanupConnections($request);

        // Assert
        $this->assertEquals(200, $response->getStatusCode());
        $responseData = $response->getData(true);
        $this->assertTrue($responseData['success']);
        $this->assertEquals($remainingConnections, $responseData['remaining_connections']);
    }
}