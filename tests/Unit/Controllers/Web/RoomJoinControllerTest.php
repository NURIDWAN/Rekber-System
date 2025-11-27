<?php

namespace Tests\Unit\Controllers\Web;

use App\Http\Controllers\Web\RoomJoinController;
use App\Models\Room;
use App\Models\Invitation;
use App\Models\RoomUser;
use App\Services\RoomUrlService;
use App\Services\MultiSessionManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Tests\TestCase;
use Inertia\Testing\AssertableInertia;

class RoomJoinControllerTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected function setUp(): void
    {
        parent::setUp();

        // Mock services
        $this->mock(RoomUrlService::class, function ($mock) {
            $mock->shouldReceive('decryptToken')->andReturn(null);
            $mock->shouldReceive('generateShareableLinks')
                 ->andReturn([
                     'buyer' => ['join_url' => 'https://example.com/buyer'],
                     'seller' => ['join_url' => 'https://example.com/seller'],
                 ]);

            $mock->shouldReceive('encryptRoomId')
                 ->andReturn('encrypted_room_id');
        });

        $this->mock(MultiSessionManager::class, function ($mock) {
            $mock->shouldReceive('getUserIdentifierFromCookie')
                 ->andReturn('user_identifier_123');

            $mock->shouldReceive('generateCookieName')
                 ->andReturn('room_session_1');
        });
    }

    /** @test */
    public function it_can_enter_room_with_existing_session()
    {
        // Arrange
        $room = Room::factory()->create([
            'room_number' => 101,
            'status' => 'free'
        ]);
        $roomUser = RoomUser::factory()->create([
            'room_id' => $room->id,
            'user_identifier' => 'user_identifier_123',
            'session_token' => 'existing_token_123',
            'role' => 'buyer',
            'is_online' => true,
        ]);

        // Mock request data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $roomUser,
            'user_identifier' => 'user_identifier_123',
            'encrypted_room_id' => 'encrypted_room_id',
        ]);

        // Act
        $response = $this->get("/rooms/{$room->id}/enter");

        // Assert
        $encryptedId = app(RoomUrlService::class)->encryptRoomId($room->id);
        $response->assertRedirect("/rooms/{$encryptedId}");
    }

    /** @test */
    public function it_can_enter_room_without_session()
    {
        // Arrange
        $room = Room::factory()->create([
            'room_number' => 102,
            'status' => 'free'
        ]);

        // Mock request data
        request()->merge([
            'current_room' => null,
            'current_room_user' => null,
            'user_identifier' => 'user_identifier_123',
            'encrypted_room_id' => 'encrypted_room_id',
        ]);

        // Act
        $response = $this->get("/rooms/{$room->id}/enter");

        // Assert
        $encryptedId = app(RoomUrlService::class)->encryptRoomId($room->id);
        $response->assertRedirect("/rooms/{$encryptedId}/join");

        // Should redirect to join page when no session
        $this->assertDatabaseMissing('room_users');
    }

    /** @test */
    public function it_can_redirect_invalid_token()
    {
        // Arrange
        $response = $this->get("/rooms/invalid_token");

        // Assert
        $response->assertStatus(404);
    }

    /** @test */
    public function it_can_redirect_to_token_join_page()
    {
        // Arrange
        $token = 'valid_token_123';
        $this->mock(RoomUrlService::class, function ($mock) use ($token) {
            $mock->shouldReceive('decryptToken')
                 ->with($token)
                 ->andReturn([
                     'room_id' => 1,
                     'role' => 'buyer',
                     'pin' => null
                 ]);

            $mock->shouldReceive('generateShareableLinks')
                 ->andReturn([
                     'buyer' => ['join_url' => 'https://example.com/buyer'],
                     'seller' => ['join_url' => 'https://example.com/seller'],
                 ]);
        });

        // Act
        $response = $this->get("/rooms/{$token}");

        // Assert
        $response->assertRedirect(route('rooms.join.token', ['token' => $token]));
    }

    /** @test */
    public function it_can_generate_share_links_for_room()
    {
        // Arrange
        $room = Room::factory()->create([
            'room_number' => 103,
            'status' => 'in_use',
            'has_buyer' => true,
            'has_seller' => false,
        ]);

        // Act
        $response = $this->get("/api/rooms/{$room->id}/share-links");

        // Assert
        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'room_id' => $room->id,
            'room_number' => $room->room_number,
                'status' => $room->status,
                'has_buyer' => $room->hasBuyer(),
                'has_seller' => $room->hasSeller(),
                'needs_buyer' => $room->isAvailableForBuyer(),
                'needs_seller' => $room->isAvailableForSeller(),
                'share_links' => [
                    'buyer' => [
                        'join_url' => 'https://example.com/buyer',
                        'role' => 'buyer',
                        'label' => 'Buyer Link',
                        'description' => 'Share this link with someone who wants to buy'
                    ],
                ],
        ]);
    }

    /** @test */
    public function it_can_join_with_token()
    {
        // Arrange
        $room = Room::factory()->create();
        $token = 'test_token_123';

        $this->mock(RoomUrlService::class, function ($mock) use ($token, $room) {
            $mock->shouldReceive('decryptToken')
                 ->with($token)
                 ->andReturn([
                     'room_id' => $room->id,
                     'role' => 'buyer',
                     'pin' => '1234'
                 ]);

            $mock->shouldReceive('generateShareableLinks')
                 ->andReturn([
                     'buyer' => ['join_url' => 'https://example.com/buyer'],
                     'seller' => ['join_url' => 'https://example.com/seller'],
                 ]);
        });

        // Mock request data
        request()->merge([
            'pin' => '1234',
        ]);

        // Act
        $response = $this->get("/rooms/{$token}/join");

        // Assert
        $response->assertOk();
        $response->assertInertia('rooms/[id]/join', [
            'room' => [
                'id' => $room->id,
                'status' => $room->status,
                'has_buyer' => $room->hasBuyer(),
                'has_seller' => $room->hasSeller(),
                'buyer_name' => null,
                'seller_name' => null,
                'current_user_role' => null,
                'current_user_name' => null,
            ],
            'role' => 'buyer',
            'token' => $token,
        ]);
    }

    /** @test */
    public function it_can_join_with_invalid_pin()
    {
        // Arrange
        $room = Room::factory()->create();
        $token = 'test_token_456';

        $this->mock(RoomUrlService::class, function ($mock) use ($token, $room) {
            $mock->shouldReceive('decryptToken')
                 ->with($token)
                 ->andReturn([
                     'room_id' => $room->id,
                     'role' => 'buyer',
                     'pin' => '1234' // Different pin
                 ]);

            $mock->shouldReceive('generateShareableLinks')
                 ->andReturn([
                     'buyer' => ['join_url' => 'https://example.com/buyer'],
                     'seller' => ['join_url' => 'https://example.com/seller'],
                 ]);
        });

        // Mock request data
        request()->merge([
            'pin' => '1111', // Wrong pin
        ]);

        // Act
        $response = $this->get("/rooms/{$token}/join");

        // Assert
        $response->assertStatus(403);
    }

    /** @test */
    public function it_can_enter_with_token()
    {
        // Arrange
        $room = Room::factory()->create();
        $roomUser = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'is_online' => false,
        ]);

        $this->mock(RoomUrlService::class, function ($mock) use ($token, $room) {
            $mock->shouldReceive('decryptToken')
                 ->with($token)
                 ->andReturn([
                     'room_id' => $room->id,
                     'role' => 'buyer',
                     'pin' => null
                 ]);

            $mock->shouldReceive('generateShareableLinks')
                 ->andReturn([
                     'buyer' => ['join_url' => 'https://example.com/buyer'],
                     'seller' => ['join_url' => 'https://example.com/seller'],
                 ]);
        });

        // Mock request data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $roomUser,
            'user_identifier' => 'user_identifier_123',
            'encrypted_room_id' => 'encrypted_room_id',
        ]);

        // Act
        $response = $this->get("/rooms/{$token}/enter");

        // Assert
        $response->assertRedirect();

        // Should set user as online and redirect to room
        $this->assertDatabaseHas('room_users', [
            'id' => $roomUser->id,
            'is_online' => true,
        ]);
    }

    /** @test */
    public function it_cannot_enter_locked_token()
    {
        // Arrange
        $token = 'locked_token_789';
        $this->mock(RoomUrlService::class, function ($mock) use ($token) {
            $mock->shouldReceive('decryptToken')
                 ->with($token)
                 ->andReturn(null);
        });

        $response = $this->get("/rooms/locked_token_789/enter");

        $response->assertStatus(404);
    }
}
