<?php

namespace Tests\Feature\Api;

use App\Models\Room;
use App\Services\RoomUrlService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class RoomControllerTokenTest extends TestCase
{
    use RefreshDatabase;

    private RoomUrlService $roomUrlService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->roomUrlService = new RoomUrlService();

        // Create test rooms
        Room::factory()->create(['id' => 1, 'room_number' => 101, 'status' => 'free']);
        Room::factory()->create(['id' => 2, 'room_number' => 102, 'status' => 'in_use']);
    }

    /**
     * Test join with valid token
     */
    public function test_join_with_valid_token(): void
    {
        $room = Room::factory()->create(['status' => 'free']);
        $token = $this->roomUrlService->generateToken($room->id, 'buyer');

        $response = $this->postJson("/api/room/{$token}/join-with-token", [
            'name' => 'Test Buyer',
            'phone' => '1234567890'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Successfully joined the room'
            ]);

        // Verify room status changed
        $this->assertEquals('in_use', $room->fresh()->status);

        // Verify room user was created
        $this->assertDatabaseHas('room_users', [
            'room_id' => $room->id,
            'name' => 'Test Buyer',
            'phone' => '1234567890',
            'role' => 'buyer'
        ]);
    }

    /**
     * Test join with invalid token
     */
    public function test_join_with_invalid_token(): void
    {
        $invalidToken = 'invalid.token.string';

        $response = $this->postJson("/api/room/{$invalidToken}/join-with-token", [
            'name' => 'Test User',
            'phone' => '1234567890'
        ]);

        $response->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'Invalid or expired token'
            ]);
    }

    /**
     * Test join with expired token
     */
    public function test_join_with_expired_token(): void
    {
        // Create an expired token by manipulating the service
        $room = Room::factory()->create();

        // We'll need to mock the service to return an expired token
        $this->mock(RoomUrlService::class, function ($mock) use ($room) {
            $mock->shouldReceive('decryptToken')
                ->andReturn(null); // Simulate expired/invalid token
        });

        $token = 'some.token.string';

        $response = $this->postJson("/api/room/{$token}/join-with-token", [
            'name' => 'Test User',
            'phone' => '1234567890'
        ]);

        $response->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'Invalid or expired token'
            ]);
    }

    /**
     * Test seller joining with token
     */
    public function test_seller_join_with_token(): void
    {
        $room = Room::factory()->create(['status' => 'in_use']);

        // Create a buyer first
        $room->users()->create([
            'name' => 'Test Buyer',
            'phone' => '1234567890',
            'role' => 'buyer',
            'session_token' => \Str::random(32),
            'is_online' => true
        ]);

        $token = $this->roomUrlService->generateToken($room->id, 'seller');

        $response = $this->postJson("/api/room/{$token}/join-with-token", [
            'name' => 'Test Seller',
            'phone' => '0987654321'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Successfully joined the room'
            ]);

        // Verify seller was created
        $this->assertDatabaseHas('room_users', [
            'room_id' => $room->id,
            'name' => 'Test Seller',
            'phone' => '0987654321',
            'role' => 'seller'
        ]);
    }

    /**
     * Test join validation with missing data
     */
    public function test_join_with_token_validation(): void
    {
        $room = Room::factory()->create();
        $token = $this->roomUrlService->generateToken($room->id, 'buyer');

        // Test missing name
        $response = $this->postJson("/api/room/{$token}/join-with-token", [
            'phone' => '1234567890'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        // Test missing phone
        $response = $this->postJson("/api/room/{$token}/join-with-token", [
            'name' => 'Test User'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    /**
     * Test enter with valid token and existing session
     */
    public function test_enter_with_valid_token(): void
    {
        $room = Room::factory()->create();
        $roomUser = $room->users()->create([
            'name' => 'Test User',
            'phone' => '1234567890',
            'role' => 'buyer',
            'session_token' => 'test_session_token',
            'is_online' => false
        ]);

        $token = $this->roomUrlService->generateToken($room->id, 'buyer');

        // Set the session cookie
        $this->withCookie('room_session_' . $room->id, 'test_session_token');

        $response = $this->postJson("/api/room/{$token}/enter-with-token");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Successfully entered the room',
                'data' => [
                    'role' => 'buyer',
                    'name' => 'Test User'
                ]
            ]);

        // Verify user is marked as online
        $this->assertDatabaseHas('room_users', [
            'id' => $roomUser->id,
            'is_online' => true
        ]);
    }

    /**
     * Test enter without session
     */
    public function test_enter_without_session(): void
    {
        $room = Room::factory()->create();
        $token = $this->roomUrlService->generateToken($room->id, 'buyer');

        $response = $this->postJson("/api/room/{$token}/enter-with-token");

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'No session found for this room'
            ]);
    }

    /**
     * Test generate share links
     */
    public function test_generate_share_links(): void
    {
        $room = Room::factory()->create();

        $response = $this->postJson('/api/room/generate-share-links', [
            'room_id' => $room->id
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Shareable links generated successfully',
                'data' => [
                    'room' => [
                        'id' => $room->id,
                        'room_number' => $room->room_number
                    ]
                ]
            ]);

        // Verify structure of links
        $data = $response->json('data');
        $this->assertArrayHasKey('links', $data);
        $this->assertArrayHasKey('buyer', $data['links']);
        $this->assertArrayHasKey('seller', $data['links']);
        $this->assertArrayHasKey('join', $data['links']['buyer']);
        $this->assertArrayHasKey('enter', $data['links']['buyer']);
        $this->assertArrayHasKey('join', $data['links']['seller']);
        $this->assertArrayHasKey('enter', $data['links']['seller']);
    }

    /**
     * Test generate share links with invalid room
     */
    public function test_generate_share_links_invalid_room(): void
    {
        $response = $this->postJson('/api/room/generate-share-links', [
            'room_id' => 99999
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['room_id']);
    }

    /**
     * Test generate share links validation
     */
    public function test_generate_share_links_validation(): void
    {
        // Test missing room_id
        $response = $this->postJson('/api/room/generate-share-links', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['room_id']);
    }

    /**
     * Test duplicate role prevention
     */
    public function test_prevent_duplicate_role_join(): void
    {
        $room = Room::factory()->create();

        // Create existing buyer
        $room->users()->create([
            'name' => 'Existing Buyer',
            'phone' => '1111111111',
            'role' => 'buyer',
            'session_token' => str_random(32)
        ]);

        $token = $this->roomUrlService->generateToken($room->id, 'buyer');

        $response = $this->postJson("/api/room/{$token}/join-with-token", [
            'name' => 'New Buyer',
            'phone' => '2222222222'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['role']);
    }

    /**
     * Test token middleware integration
     */
    public function test_token_middleware_integration(): void
    {
        $response = $this->postJson('/api/room/nonexistent-tenant-token/join-with-token', [
            'name' => 'Test User',
            'phone' => '1234567890'
        ]);

        // Should fail due to middleware validation
        $response->assertStatus(400);
    }
}
