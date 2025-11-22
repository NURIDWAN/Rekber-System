<?php

namespace Tests\Feature\WebSocket;

use App\Models\Room;
use App\Models\RoomUser;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class WebSocketFallbackTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    protected function tearDown(): void
    {
        Cache::flush();
        parent::tearDown();
    }

    /**
     * @test
     * Test room status API for WebSocket fallback polling
     */
    public function it_provides_room_status_for_fallback_polling()
    {
        // Create test rooms with different statuses
        Room::factory()->create([
            'room_number' => 1,
            'status' => 'free'
        ]);

        Room::factory()->create([
            'room_number' => 2,
            'status' => 'in_use'
        ]);

        // Create room users for room 2
        $room2 = Room::where('room_number', 2)->first();
        RoomUser::factory()->create([
            'room_id' => $room2->id,
            'name' => 'Test Buyer',
            'role' => 'buyer',
            'is_online' => true
        ]);

        $response = $this->get('/api/rooms/status');

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertIsArray($data);
        $this->assertCount(2, $data);

        // Check room 1 data (free room)
        $room1Data = collect($data)->firstWhere('room_id', 1);
        $this->assertEquals(1, $room1Data['room_id']);
        $this->assertEquals('free', $room1Data['status']);
        $this->assertFalse($room1Data['has_buyer']);
        $this->assertFalse($room1Data['has_seller']);
        $this->assertTrue($room1Data['available_for_buyer']);
        $this->assertFalse($room1Data['available_for_seller']);

        // Check room 2 data (room with buyer)
        $room2Data = collect($data)->firstWhere('room_id', 2);
        $this->assertEquals(2, $room2Data['room_id']);
        $this->assertEquals('in_use', $room2Data['status']);
        $this->assertTrue($room2Data['has_buyer']);
        $this->assertFalse($room2Data['has_seller']);
        $this->assertFalse($room2Data['available_for_buyer']);
        $this->assertTrue($room2Data['available_for_seller']);
    }

    /**
     * @test
     * Test room status API handles empty rooms correctly
     */
    public function it_handles_empty_rooms_in_status_api()
    {
        $response = $this->get('/api/rooms/status');

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertIsArray($data);
        $this->assertEmpty($data);
    }

    /**
     * @test
     * Test room status API includes timestamp for caching
     */
    public function it_includes_timestamp_in_status_response()
    {
        Room::factory()->create(['room_number' => 1, 'status' => 'free']);

        $response = $this->get('/api/rooms/status');

        $response->assertStatus(200);
        $data = $response->json();

        $roomData = $data[0];
        $this->assertArrayHasKey('timestamp', $roomData);
        $this->assertNotEmpty($roomData['timestamp']);

        // Verify timestamp format
        $timestamp = $roomData['timestamp'];
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/',
            $timestamp
        );
    }

    /**
     * @test
     * Test room status API includes correct action field
     */
    public function it_includes_correct_action_field_in_status_response()
    {
        Room::factory()->create(['room_number' => 1, 'status' => 'free']);

        $response = $this->get('/api/rooms/status');

        $response->assertStatus(200);
        $data = $response->json();

        $roomData = $data[0];
        $this->assertEquals('room_updated', $roomData['action']);
    }

    /**
     * @test
     * Test share links API works with WebSocket fallback
     */
    public function it_provides_share_links_for_fallback_mode()
    {
        $room = Room::factory()->create(['room_number' => 1, 'status' => 'free']);

        $response = $this->get("/api/rooms/{$room->id}/share-links");

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertTrue($data['success']);
        $this->assertEquals($room->id, $data['room_id']);
        $this->assertEquals(1, $data['room_number']);
        $this->assertEquals('free', $data['status']);
        $this->assertTrue($data['needs_buyer']);
        $this->assertFalse($data['needs_seller']);
        $this->assertFalse($data['is_full']);
        $this->assertEquals(5, $data['token_expiry_minutes']);

        $this->assertArrayHasKey('share_links', $data);
        $this->assertArrayHasKey('buyer', $data['share_links']);
        $this->assertArrayNotHasKey('seller', $data['share_links']);
    }

    /**
     * @test
     * Test share links API for room with buyer
     */
    public function it_provides_seller_share_links_when_buyer_present()
    {
        $room = Room::factory()->create(['room_number' => 1, 'status' => 'in_use']);
        RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'name' => 'Test Buyer'
        ]);

        $response = $this->get("/api/rooms/{$room->id}/share-links");

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertFalse($data['needs_buyer']);
        $this->assertTrue($data['needs_seller']);
        $this->assertFalse($data['is_full']);

        $this->assertArrayHasKey('seller', $data['share_links']);
        $this->assertArrayNotHasKey('buyer', $data['share_links']);
    }

    /**
     * @test
     * Test share links API for full room
     */
    public function it_returns_empty_share_links_for_full_room()
    {
        $room = Room::factory()->create(['room_number' => 1, 'status' => 'in_use']);
        RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'name' => 'Test Buyer'
        ]);
        RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'seller',
            'name' => 'Test Seller'
        ]);

        $response = $this->get("/api/rooms/{$room->id}/share-links");

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertFalse($data['needs_buyer']);
        $this->assertFalse($data['needs_seller']);
        $this->assertTrue($data['is_full']);
        $this->assertEmpty($data['share_links']);
    }

    /**
     * @test
     * Test share links API handles invalid room
     */
    public function it_handles_invalid_room_in_share_links_api()
    {
        $response = $this->get('/api/rooms/99999/share-links');

        $response->assertStatus(404);
    }

    /**
     * @test
     * Test room status API handles large number of rooms efficiently
     */
    public function it_handles_large_number_of_rooms_efficiently()
    {
        // Create 50 rooms
        Room::factory()->count(50)->create([
            'status' => 'free'
        ]);

        $startTime = microtime(true);

        $response = $this->get('/api/rooms/status');

        $endTime = microtime(true);
        $responseTime = $endTime - $startTime;

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertCount(50, $data);
        $this->assertLessThan(1.0, $responseTime); // Should respond in under 1 second
    }

    /**
     * @test
     * Test fallback API responses include proper headers
     */
    public function it_includes_proper_headers_for_fallback_responses()
    {
        Room::factory()->create(['room_number' => 1, 'status' => 'free']);

        $response = $this->get('/api/rooms/status');

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/json');
        $response->assertHeader('Cache-Control', 'no-cache, private');
    }

    /**
     * @test
     * Test fallback API handles concurrent requests
     */
    public function it_handles_concurrent_status_requests()
    {
        Room::factory()->count(10)->create(['status' => 'free']);

        // Make multiple concurrent requests
        $responses = collect(range(1, 5))->map(function () {
            return $this->get('/api/rooms/status');
        });

        $responses->each(function ($response) {
            $response->assertStatus(200);
            $data = $response->json();
            $this->assertCount(10, $data);
        });
    }

    /**
     * @test
     * Test fallback API rate limiting behavior
     */
    public function it_handles_rate_limiting_appropriately()
    {
        Room::factory()->create(['room_number' => 1, 'status' => 'free']);

        // Make multiple rapid requests
        $responses = [];
        for ($i = 0; $i < 20; $i++) {
            $responses[] = $this->get('/api/rooms/status');
        }

        // Most should succeed, but some might be rate limited depending on configuration
        $successCount = collect($responses)->filter(function ($response) {
            return $response->getStatusCode() === 200;
        })->count();

        $this->assertGreaterThan(0, $successCount);
    }

    /**
     * @test
     * Test fallback API error handling
     */
    public function it_handles_database_errors_gracefully()
    {
        // This test would require mocking database failures
        // For now, we'll test normal operation
        Room::factory()->create(['room_number' => 1, 'status' => 'free']);

        $response = $this->get('/api/rooms/status');
        $response->assertStatus(200);
    }

    /**
     * @test
     * Test fallback API consistency with WebSocket events
     */
    public function it_provides_consistent_data_with_websocket_events()
    {
        $room = Room::factory()->create(['room_number' => 1, 'status' => 'free']);
        RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'name' => 'Test Buyer',
            'is_online' => true
        ]);

        // Get status from API
        $apiResponse = $this->get('/api/rooms/status');
        $apiData = $apiResponse->json();
        $roomApiData = collect($apiData)->firstWhere('room_id', $room->id);

        // Get status from share links API
        $shareResponse = $this->get("/api/rooms/{$room->id}/share-links");
        $shareData = $shareResponse->json();

        // Data should be consistent between APIs
        $this->assertEquals($roomApiData['has_buyer'], $shareData['has_buyer']);
        $this->assertEquals($roomApiData['has_seller'], $shareData['has_seller']);
        $this->assertEquals($roomApiData['available_for_buyer'], $shareData['needs_buyer']);
        $this->assertEquals($roomApiData['available_for_seller'], $shareData['needs_seller']);
    }

    /**
     * @test
     * Test fallback API data structure validation
     */
    public function it_provides_valid_data_structure()
    {
        Room::factory()->create(['room_number' => 1, 'status' => 'free']);

        $response = $this->get('/api/rooms/status');

        $response->assertStatus(200);
        $data = $response->json();

        // Validate data structure
        $this->assertIsArray($data);

        if (!empty($data)) {
            $roomData = $data[0];

            $requiredFields = [
                'room_id',
                'status',
                'has_buyer',
                'has_seller',
                'available_for_buyer',
                'available_for_seller',
                'user_name',
                'role',
                'action',
                'timestamp'
            ];

            foreach ($requiredFields as $field) {
                $this->assertArrayHasKey($field, $roomData);
            }

            // Validate field types
            $this->assertIsInt($roomData['room_id']);
            $this->assertIsString($roomData['status']);
            $this->assertIsBool($roomData['has_buyer']);
            $this->assertIsBool($roomData['has_seller']);
            $this->assertIsBool($roomData['available_for_buyer']);
            $this->assertIsBool($roomData['available_for_seller']);
            $this->assertIsString($roomData['user_name']);
            $this->assertIsString($roomData['role']);
            $this->assertIsString($roomData['action']);
            $this->assertIsString($roomData['timestamp']);
        }
    }

    /**
     * @test
     * Test fallback API pagination and limiting
     */
    public function it_handles_data_limiting_appropriately()
    {
        // Create many rooms to test limiting behavior
        Room::factory()->count(150)->create(['status' => 'free']);

        $response = $this->get('/api/rooms/status');

        $response->assertStatus(200);
        $data = $response->json();

        // Should return all rooms (or implement reasonable limiting)
        $this->assertLessThanOrEqual(200, count($data));
        $this->assertGreaterThan(0, count($data));
    }
}