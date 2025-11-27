<?php

namespace Tests\Unit\Controllers\Web;

use App\Http\Controllers\Web\InvitationController;
use App\Models\Room;
use App\Models\Invitation;
use App\Models\RoomUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Http\JsonResponse;
use Tests\TestCase;

class InvitationControllerTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected function setUp(): void
    {
        parent::setUp();
    }

    /** @test */
    public function it_can_display_invitation_expired_page()
    {
        // Arrange
        $token = 'expired_token_123';

        // Act
        $response = $this->get("/{$token}/expired");

        // Assert
        $response->assertOk();
        $response->assertInertia('rooms/invitation-expired', [
            'token' => $token,
        ]);
    }

    /** @test */
    public function it_can_display_room_invitations()
    {
        // Arrange
        $room = Room::factory()->create([
            'room_number' => 101,
            'status' => 'free',
        ]);
        $buyer = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'name' => 'Test Buyer',
            'is_online' => true,
        ]);
        $invitation1 = Invitation::factory()->create([
            'room_id' => $room->id,
            'email' => 'buyer1@example.com',
            'role' => 'buyer',
            'token' => 'valid_token_123',
            'status' => 'accepted',
            'accepted_at' => now()->subDay(),
            'joined_at' => now()->subHours(2),
        ]);
        $invitation2 = Invitation::factory()->create([
            'room_id' => $room->id,
            'email' => 'buyer2@example.com',
            'role' => 'buyer',
            'token' => 'expired_token_456',
            'status' => 'pending',
            'expires_at' => now()->subDay(),
        ]);
        $invitation3 = Invitation::factory()->create([
            'room_id' => $room->id,
            'email' => 'seller1@example.com',
            'role' => 'seller',
            'token' => 'valid_token_789',
            'status' => 'pending',
            'expires_at' => now()->addDay(),
        ]);

        // Act
        $response = $this->get("/rooms/{$room->id}/invitations");

        // Assert
        $response->assertOk();
        $response->assertInertia('rooms/invitations', [
            'room' => [
                'id' => $room->id,
                'name' => "Room #{$room->room_number}",
                'room_number' => $room->room_number,
                'status' => $room->status,
                'has_buyer' => $room->hasBuyer(),
                'has_seller' => $room->hasSeller(),
                'is_full' => $room->isFull(),
            ],
            'invitations' => function ($invitations) {
                $this->assertCount(3, $invitations);
                return $invitations->map(function ($invitation) {
                    return [
                        'id' => $invitation->id,
                        'email' => $invitation->email,
                        'role' => $invitation->role,
                        'status' => $invitation->isAccepted() ? 'accepted' : ($invitation->isExpired() ? 'expired' : 'pending'),
                        'expires_at' => $invitation->expires_at->toISOString(),
                        'accepted_at' => $invitation->accepted_at?->toISOString(),
                        'joined_at' => $invitation->joined_at?->toISOString(),
                        'pin_attempts' => $invitation->pin_attempts,
                        'is_pin_locked' => $invitation->isPinLocked(),
                        'inviter' => $invitation->inviter->name,
                        'invitee' => $invitation->invitee?->name,
                        'can_revoke' => !$invitation->isAccepted() && !$invitation->isExpired(),
                        'can_resend' => $invitation->isExpired(),
                    ];
                });
            },
            'availableRoles' => ['seller'],
            'can_create_invitations' => true,
            'stats' => [
                'total_invitations' => 3,
                'pending_invitations' => 2,
                'accepted_invitations' => 1,
                'expired_invitations' => 0,
            ],
        ]);
    }

    /** @test */
    public function it_can_create_invitation()
    {
        // Arrange
        $room = Room::factory()->create();
        $inviter = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'name' => 'Test Buyer',
            'is_online' => true,
        ]);

        $invitationData = [
            'email' => 'seller1@example.com',
            'role' => 'seller',
            'message' => 'Please join my room',
            'expires_hours' => 24,
        ];

        // Mock request data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $inviter,
        ]);

        // Act
        $response = $this->post("/rooms/{$room->id}/invitations", $invitationData);

        // Assert
        $response->assertRedirect();

        $this->assertDatabaseHas('invitations', [
            'room_id' => $room->id,
            'email' => 'seller1@example.com',
            'role' => 'seller',
            'status' => 'pending',
            'token' => notNull(),
            'expires_at' => now()->addHours(24)->toDateTimeString(),
            'message' => 'Please join my room',
        ]);
    }

    /** @test */
    public function it_cannot_create_invitation_for_full_room()
    {
        // Arrange
        $room = Room::factory()->create();
        $buyer = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
        ]);
        $seller = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'seller',
        ]);

        // Mock request data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $buyer,
        ]);

        $invitationData = [
            'email' => 'another@example.com',
            'role' => 'seller',
        ];

        // Act
        $response = $this->post("/rooms/{$room->id}/invitations", $invitationData);

        // Assert
        $response->assertRedirect()
            ->assertSessionHasErrors(['role' => 'Room is full']);
    }

    /** @test */
    public function it_cannot_create_invitation_for_same_role()
    {
        // Arrange
        $room = Room::factory()->create();
        $buyer = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
        ]);

        // Mock request data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $buyer,
        ]);

        $invitationData = [
            'email' => 'buyer1@example.com',
            'role' => 'buyer',
        ];

        // Act
        $response = $this->post("/rooms/{$room->id}/invitations", $invitationData);

        // Assert
        $response->assertRedirect()
            ->assertSessionHasErrors(['email' => 'This role is already filled']);
    }

    /** @test */
    public function it_can_verify_pin()
    {
        // Arrange
        $room = Room::factory()->create();
        $invitation = Invitation::factory()->create([
            'room_id' => $room->id,
            'email' => 'buyer1@example.com',
            'role' => 'buyer',
            'token' => 'valid_token_123',
            'pin' => '1234',
            'pin_attempts' => 2,
            'pin_locked_until' => null,
            'expires_at' => now()->addHours(24),
        ]);

        $pinData = [
            'pin' => '1234',
        ];

        // Act
        $response = $this->post("/{$invitation->token}/verify-pin", $pinData);

        // Assert
        $response->assertJson([
            'success' => true,
            'message' => 'PIN verified successfully',
            'invitation' => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'role' => $invitation->role,
                'room' => [
                    'id' => $room->id,
                    'room_number' => $room->room_number,
                ],
                'inviter' => [
                    'name' => $invitation->inviter->name,
                ],
            ],
        ]);

        // Check invitation pin attempts
        $this->assertDatabaseHas('invitations', [
            'pin_attempts' => 3,
            'pin_locked_until' => null,
        ]);
    }

    /** @test */
    public function it_cannot_verify_invalid_pin()
    {
        // Arrange
        $invitation = Invitation::factory()->create([
            'token' => 'valid_token_123',
            'pin' => '1234',
            'pin_attempts' => 2,
        ]);

        $pinData = [
            'pin' => '1111',
        ];

        // Act
        $response = $this->post("/{$invitation->token}/verify-pin", $pinData);

        // Assert
        $response->assertJson([
            'success' => false,
            'message' => 'Invalid PIN',
            'attempts_remaining' => 1,
        ]);
    }

    /** @test */
    public function it_cannot_verify_when_pin_locked()
    {
        // Arrange
        $invitation = Invitation::factory()->create([
            'token' => 'valid_token_123',
            'pin' => '1234',
            'pin_attempts' => 3,
            'pin_locked_until' => now()->addMinutes(30),
        ]);

        $pinData = [
            'pin' => '1234',
        ];

        // Act
        $response = $this->post("/{$invitation->token}/verify-pin", $pinData);

        // Assert
        $response->assertJson([
            'success' => false,
            'message' => 'Too many failed attempts. Please try again later.',
            'locked_until' => $invitation->pin_locked_until->toISOString(),
        ]);
    }

    /** @test */
    public function it_can_revoke_invitation()
    {
        // Arrange
        $room = Room::factory()->create();
        $inviter = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
        ]);
        $invitation = Invitation::factory()->create([
            'room_id' => $room->id,
            'email' => 'seller1@example.com',
            'role' => 'seller',
            'status' => 'pending',
            'token' => 'valid_token_123',
        ]);

        // Mock request data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $inviter,
        ]);

        // Act
        $response = $this->post("/rooms/{$room->id}/invitations/{$invitation->id}/revoke");

        // Assert
        $response->assertRedirect();

        $this->assertDatabaseHas('invitations', [
            'id' => $invitation->id,
            'status' => 'revoked',
            'revoked_at' => notNull(),
        ]);
    }

    /** @test */
    public function it_can_delete_expired_invitation()
    {
        // Arrange
        $room = Room::factory()->create();
        $invitation = Invitation::factory()->create([
            'room_id' => $room->id,
            'email' => 'seller1@example.com',
            'role' => 'seller',
            'status' => 'expired',
            'token' => 'expired_token_123',
        ]);

        // Mock request data
        request()->merge([
            'current_room' => $room,
        ]);

        // Act
        $response = $this->delete("/rooms/{$room->id}/invitations/{$invitation->id}");

        // Assert
        $response->assertRedirect();

        $this->assertDatabaseMissing('invitations', [
            'id' => $invitation->id,
        ]);
    }
}