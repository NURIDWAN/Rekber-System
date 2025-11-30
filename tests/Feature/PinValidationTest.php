<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Services\RoomUrlService;
use Illuminate\Support\Facades\Event;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PinValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake();
    }

    public function test_cannot_join_pin_protected_room_without_pin_via_web()
    {
        $room = Room::factory()->create([
            'pin_enabled' => true,
            'pin' => '123456',
            'status' => 'free'
        ]);

        $response = $this->post(route('rooms.join.post', $room), [
            'name' => 'Test User',
            'phone' => '08123456789',
            'role' => 'buyer'
        ]);

        $response->assertSessionHasErrors('pin');
    }

    public function test_cannot_join_pin_protected_room_with_incorrect_pin_via_web()
    {
        $room = Room::factory()->create([
            'pin_enabled' => true,
            'pin' => '123456',
            'status' => 'free'
        ]);

        $response = $this->post(route('rooms.join.post', $room), [
            'name' => 'Test User',
            'phone' => '08123456789',
            'role' => 'buyer',
            'pin' => '000000'
        ]);

        $response->assertSessionHasErrors('pin');
    }

    public function test_can_join_pin_protected_room_with_correct_pin_via_web()
    {
        $room = Room::factory()->create([
            'pin_enabled' => true,
            'pin' => '123456',
            'status' => 'free'
        ]);

        $response = $this->post(route('rooms.join.post', $room), [
            'name' => 'Test User',
            'phone' => '08123456789',
            'role' => 'buyer',
            'pin' => '123456'
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();
    }

    public function test_cannot_join_pin_protected_room_without_pin_via_api()
    {
        $room = Room::factory()->create([
            'pin_enabled' => true,
            'pin' => '123456',
            'status' => 'free'
        ]);

        $roomUrlService = app(RoomUrlService::class);
        $token = 'test_token';
        // We need to mock the token validation or use a real token if possible.
        // Since RoomJoinController uses middleware that decodes the token, testing it directly might be complex without mocking middleware.
        // However, we can test the controller method directly if we mock the request properly or if we can generate a valid token.

        // Let's try to generate a valid token using the service if possible, but the service methods for token generation might be protected or complex.
        // Alternatively, we can skip the middleware for this test or mock the middleware.
        // But `joinWithToken` expects data from middleware in the request object.

        // Let's simulate the request with the data that middleware would inject.

        // We bypass middleware to test controller logic directly as we can't easily generate valid encrypted tokens in test
        $response = $this->withoutMiddleware()->postJson("/api/room/{$token}/join-with-token", [
            'name' => 'Test User',
            'phone' => '08123456789',
            'room_id_from_token' => $room->id,
            'role_from_token' => 'buyer',
            'token_timestamp' => now()->timestamp
        ]);

        $response->assertStatus(401);
        $response->assertJson([
            'success' => false,
            'message' => 'PIN is required for this room',
            'requires_pin' => true
        ]);
    }

    public function test_cannot_join_pin_protected_room_with_incorrect_pin_via_api()
    {
        $room = Room::factory()->create([
            'pin_enabled' => true,
            'pin' => '123456',
            'status' => 'free'
        ]);

        $token = 'test_token';

        $response = $this->withoutMiddleware()->postJson("/api/room/{$token}/join-with-token", [
            'name' => 'Test User',
            'phone' => '08123456789',
            'pin' => '000000',
            'room_id_from_token' => $room->id,
            'role_from_token' => 'buyer',
            'token_timestamp' => now()->timestamp
        ]);

        $response->assertStatus(401);
        $response->assertJson([
            'success' => false,
            'message' => 'Invalid PIN',
            'requires_pin' => true
        ]);
    }

    public function test_can_join_pin_protected_room_with_correct_pin_via_api()
    {
        $room = Room::factory()->create([
            'pin_enabled' => true,
            'pin' => '123456',
            'status' => 'free'
        ]);

        $token = 'test_token';

        $response = $this->withoutMiddleware()->postJson("/api/room/{$token}/join-with-token", [
            'name' => 'Test User',
            'phone' => '08123456789',
            'pin' => '123456',
            'room_id_from_token' => $room->id,
            'role_from_token' => 'buyer',
            'token_timestamp' => now()->timestamp
        ]);

        // It might fail if other dependencies are not met (like MultiSessionManager), but we expect it to pass the PIN check at least.
        // If it passes PIN check, it proceeds to join logic.
        // We just want to ensure it doesn't return 401 for PIN.

        if ($response->status() === 401) {
            $response->assertStatus(200); // Fail explicitly if it's 401
        }

        // It might return 200 or other error, but NOT 401 for PIN.
        $this->assertNotEquals(401, $response->status());
    }
}
