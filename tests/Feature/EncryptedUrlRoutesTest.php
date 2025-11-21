<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Services\RoomUrlService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class EncryptedUrlRoutesTest extends TestCase
{
    use RefreshDatabase;

    private RoomUrlService $roomUrlService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->roomUrlService = new RoomUrlService();
    }

    /**
     * Test web route for joining with valid token
     */
    public function test_web_join_with_valid_token(): void
    {
        $room = Room::factory()->create();
        $token = $this->roomUrlService->generateToken($room->id, 'buyer');

        $response = $this->get("/rooms/{$token}/join");

        $response->assertStatus(200);
        $response->assertViewIs('rooms.join');
        $response->assertViewHas('room', function ($viewRoom) use ($room) {
            return $viewRoom->id === $room->id;
        });
        $response->assertViewHas('role', 'buyer');
        $response->assertViewHas('token', $token);
    }

    /**
     * Test web route for joining with invalid token
     */
    public function test_web_join_with_invalid_token(): void
    {
        $invalidToken = 'invalid.token.string';

        $response = $this->get("/rooms/{$invalidToken}/join");

        $response->assertStatus(404);
    }

    /**
     * Test web route for entering with valid token but no session
     */
    public function test_web_enter_with_valid_token_no_session(): void
    {
        $room = Room::factory()->create();
        $token = $this->roomUrlService->generateToken($room->id, 'buyer');

        $response = $this->get("/rooms/{$token}/enter");

        // Should redirect to join page when no session exists
        $response->assertRedirect("/rooms/{$token}/join");
    }

    /**
     * Test web route for entering with valid token and session
     */
    public function test_web_enter_with_valid_token_and_session(): void
    {
        $room = Room::factory()->create();
        $token = $this->roomUrlService->generateToken($room->id, 'buyer');

        // Create a user session
        $roomUser = $room->users()->create([
            'name' => 'Test User',
            'phone' => '1234567890',
            'role' => 'buyer',
            'session_token' => 'test_session_token',
            'is_online' => true
        ]);

        // Set session cookie
        $this->withCookie('room_session_' . $room->id, 'test_session_token');

        $response = $this->get("/rooms/{$token}/enter");

        // Should redirect to room show page when session exists
        $response->assertRedirect("/rooms/{$room->id}");
    }

    /**
     * Test web route for entering with invalid token
     */
    public function test_web_enter_with_invalid_token(): void
    {
        $invalidToken = 'invalid.token.string';

        $response = $this->get("/rooms/{$invalidToken}/enter");

        $response->assertStatus(404);
    }

    /**
     * Test share links generation route
     */
    public function test_share_links_generation_route(): void
    {
        $room = Room::factory()->create();

        $response = $this->postJson('/api/room/generate-share-links', [
            'room_id' => $room->id
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Shareable links generated successfully'
            ]);

        // Verify response structure
        $data = $response->json('data');
        $this->assertArrayHasKey('room', $data);
        $this->assertArrayHasKey('links', $data);
        $this->assertEquals($room->id, $data['room']['id']);
    }

    /**
     * Test share links route validation
     */
    public function test_share_links_route_validation(): void
    {
        // Test missing room_id
        $response = $this->postJson('/api/room/generate-share-links', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['room_id']);

        // Test invalid room_id
        $response = $this->postJson('/api/room/generate-share-links', [
            'room_id' => 'invalid'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['room_id']);

        // Test non-existent room_id
        $response = $this->postJson('/api/room/generate-share-links', [
            'room_id' => 99999
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['room_id']);
    }

    /**
     * Test API join with token route
     */
    public function test_api_join_with_token_route(): void
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

        // Verify room user was created
        $this->assertDatabaseHas('room_users', [
            'room_id' => $room->id,
            'name' => 'Test Buyer',
            'role' => 'buyer'
        ]);
    }

    /**
     * Test API enter with token route
     */
    public function test_api_enter_with_token_route(): void
    {
        $room = Room::factory()->create();
        $roomUser = $room->users()->create([
            'name' => 'Test User',
            'phone' => '1234567890',
            'role' => 'buyer',
            'session_token' => 'test_session_token'
        ]);

        $token = $this->roomUrlService->generateToken($room->id, 'buyer');

        $this->withCookie('room_session_' . $room->id, 'test_session_token');

        $response = $this->postJson("/api/room/{$token}/enter-with-token");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Successfully entered the room'
            ]);
    }

    /**
     * Test token expiry handling
     */
    public function test_token_expiry_handling(): void
    {
        // We need to test this with mocking since we can't easily create expired tokens
        $this->mock(RoomUrlService::class, function ($mock) {
            $mock->shouldReceive('decryptToken')
                ->andReturn(null); // Simulate expired token
        });

        $token = 'expired.token.string';

        $response = $this->get("/rooms/{$token}/join");

        $response->assertStatus(404);
    }

    /**
     * Test route parameters are correctly extracted
     */
    public function test_route_parameters_extraction(): void
    {
        $room = Room::factory()->create();
        $token = $this->roomUrlService->generateToken($room->id, 'seller');

        $response = $this->get("/rooms/{$token}/join");

        $response->assertStatus(200);
        $response->assertViewHas('role', 'seller');
        $response->assertViewHas('token', $token);
    }

    /**
     * Test URL structure validity
     */
    public function test_generated_url_structure(): void
    {
        $room = Room::factory()->create(['room_number' => 101]);

        $links = $this->roomUrlService->generateShareableLinks($room->id);

        // Test URL structure
        $this->assertStringContainsString('/rooms/', $links['buyer']['join']);
        $this->assertStringContainsString('/join', $links['buyer']['join']);
        $this->assertStringContainsString('/rooms/', $links['buyer']['enter']);
        $this->assertStringContainsString('/enter', $links['buyer']['enter']);

        $this->assertStringContainsString('/rooms/', $links['seller']['join']);
        $this->assertStringContainsString('/join', $links['seller']['join']);
        $this->assertStringContainsString('/rooms/', $links['seller']['enter']);
        $this->assertStringContainsString('/enter', $links['seller']['enter']);
    }

    /**
     * Test route middleware application
     */
    public function test_route_middleware_application(): void
    {
        // Test that API routes with token have middleware applied
        $response = $this->postJson('/api/room/invalid-token/join-with-token', [
            'name' => 'Test User',
            'phone' => '1234567890'
        ]);

        // Should fail at middleware level, not reach controller
        $response->assertStatus(400);
    }

    /**
     * Test route caching compatibility
     */
    public function test_route_caching_compatibility(): void
    {
        // This test ensures routes work with Laravel's route caching
        $room = Room::factory()->create();
        $token = $this->roomUrlService->generateToken($room->id, 'buyer');

        // Simulate route cache by using route() helper
        $joinUrl = route('rooms.join.token', ['token' => $token]);

        $this->assertStringContains($token, $joinUrl);
        $this->assertStringContains('/join', $joinUrl);

        $enterUrl = route('rooms.enter.token', ['token' => $token]);

        $this->assertStringContains($token, $enterUrl);
        $this->assertStringContains('/enter', $enterUrl);
    }

    /**
     * Test route name resolution
     */
    public function test_route_name_resolution(): void
    {
        $room = Room::factory()->create();
        $token = $this->roomUrlService->generateToken($room->id, 'buyer');

        // Test route names exist
        $this->assertEquals(
            url("/rooms/{$token}/join"),
            route('rooms.join.token', ['token' => $token])
        );

        $this->assertEquals(
            url("/rooms/{$token}/enter"),
            route('rooms.enter.token', ['token' => $token])
        );
    }
}
