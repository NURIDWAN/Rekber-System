<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomInvitation;
use App\Models\User;
use App\Services\RoomUrlService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

class InvitationSystemTest extends TestCase
{
    use RefreshDatabase;

    protected User $roomOwner;
    protected Room $room;
    protected RoomUrlService $roomUrlService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->roomOwner = User::factory()->create();
        $this->room = Room::factory()->create();
        $this->roomUrlService = app(RoomUrlService::class);
    }

    /** @test */
    public function it_can_create_a_room_invitation()
    {
        $invitation = $this->roomUrlService->createInvitation(
            $this->room,
            $this->roomOwner,
            'test@example.com',
            'buyer',
            24
        );

        $this->assertInstanceOf(RoomInvitation::class, $invitation);
        $this->assertEquals($this->room->id, $invitation->room_id);
        $this->assertEquals($this->roomOwner->id, $invitation->inviter_id);
        $this->assertEquals('test@example.com', $invitation->email);
        $this->assertEquals('buyer', $invitation->role);
        $this->assertNotNull($invitation->encrypted_token);
        $this->assertNotNull($invitation->pin);
        $this->assertEquals(6, strlen($invitation->pin));
        $this->assertFalse($invitation->isExpired());
        $this->assertTrue($invitation->isActive());
    }

    /** @test */
    public function it_generates_encrypted_token_for_invitation()
    {
        $invitation = $this->roomUrlService->createInvitation(
            $this->room,
            $this->roomOwner,
            'test@example.com',
            'seller'
        );

        $token = $invitation->generateEncryptedToken();
        $this->assertNotNull($token);
        $this->assertNotEmpty($token);

        // Verify token contains the invitation data
        $payload = Crypt::decrypt($token);
        $this->assertEquals($this->room->id, $payload['room_id']);
        $this->assertEquals('seller', $payload['role']);
        $this->assertEquals('test@example.com', $payload['email']);
    }

    /** @test */
    public function it_generates_valid_invitation_url()
    {
        $invitation = $this->roomUrlService->createInvitation(
            $this->room,
            $this->roomOwner,
            'test@example.com',
            'buyer'
        );

        $url = $this->roomUrlService->generateInvitationUrl($invitation);

        $this->assertStringContains('rooms/invite/inv_', $url);
        $this->assertStringContains($invitation->encrypted_token, $url);
    }

    /** @test */
    public function it_validates_invitation_token_correctly()
    {
        $invitation = $this->roomUrlService->createInvitation(
            $this->room,
            $this->roomOwner,
            'test@example.com',
            'buyer'
        );

        $invitation->generateEncryptedToken();
        $token = 'inv_' . base64_encode($invitation->encrypted_token);

        $foundInvitation = $this->roomUrlService->findInvitationByToken($token);

        $this->assertNotNull($foundInvitation);
        $this->assertEquals($invitation->id, $foundInvitation->id);
    }

    /** @test */
    public function it_handles_invalid_invitation_token()
    {
        $invalidToken = 'inv_' . base64_encode('invalid_encrypted_data');

        $invitation = $this->roomUrlService->findInvitationByToken($invalidToken);

        $this->assertNull($invitation);
    }

    /** @test */
    public function it_verifies_pin_correctly()
    {
        $invitation = $this->roomUrlService->createInvitation(
            $this->room,
            $this->roomOwner,
            'test@example.com',
            'buyer'
        );

        $correctPin = $invitation->pin;
        $wrongPin = '000000';

        // Test correct PIN
        $isValid = $this->roomUrlService->verifyPin($invitation, $correctPin);
        $this->assertTrue($isValid);

        // Test wrong PIN
        $isValid = $this->roomUrlService->verifyPin($invitation, $wrongPin);
        $this->assertFalse($isValid);
        $this->assertEquals(1, $invitation->fresh()->pin_attempts);
    }

    /** @test */
    public function it_handles_pin_locking_after_multiple_attempts()
    {
        $invitation = $this->roomUrlService->createInvitation(
            $this->room,
            $this->roomOwner,
            'test@example.com',
            'buyer'
        );

        // Make 5 failed attempts
        for ($i = 0; $i < 5; $i++) {
            $this->roomUrlService->verifyPin($invitation, '000000');
            $invitation->refresh();
        }

        $this->assertTrue($invitation->isPinLocked());
        $this->assertFalse($invitation->canAttemptPin());
    }

    /** @test */
    public function it_resets_pin_attempts_after_correct_pin()
    {
        $invitation = $this->roomUrlService->createInvitation(
            $this->room,
            $this->roomOwner,
            'test@example.com',
            'buyer'
        );

        // Make 2 failed attempts
        $this->roomUrlService->verifyPin($invitation, '000000');
        $this->roomUrlService->verifyPin($invitation, '000000');

        $invitation->refresh();
        $this->assertEquals(2, $invitation->pin_attempts);

        // Enter correct PIN
        $this->roomUrlService->verifyPin($invitation, $invitation->pin);

        $invitation->refresh();
        $this->assertEquals(0, $invitation->pin_attempts);
        $this->assertNull($invitation->pin_locked_until);
    }

    /** @test */
    public function it_marks_invitation_as_accepted()
    {
        $invitation = $this->roomUrlService->createInvitation(
            $this->room,
            $this->roomOwner,
            'test@example.com',
            'buyer'
        );

        $user = User::factory()->create(['email' => 'test@example.com']);

        $invitation->accept($user, 'session_123', '127.0.0.1', 'Test Agent');

        $invitation->refresh();
        $this->assertNotNull($invitation->accepted_at);
        $this->assertEquals($user->id, $invitation->invitee_id);
        $this->assertEquals('session_123', $invitation->session_id);
        $this->assertEquals('127.0.0.1', $invitation->ip_address);
        $this->assertEquals('Test Agent', $invitation->user_agent);
    }

    /** @test */
    public function it_marks_invitation_as_joined()
    {
        $invitation = $this->roomUrlService->createInvitation(
            $this->room,
            $this->roomOwner,
            'test@example.com',
            'buyer'
        );

        $this->assertFalse($invitation->isJoined());

        $invitation->markAsJoined();

        $invitation->refresh();
        $this->assertTrue($invitation->isJoined());
        $this->assertNotNull($invitation->joined_at);
    }

    /** @test */
    public function it_detects_expired_invitations()
    {
        // Create invitation with past expiry
        $invitation = RoomInvitation::factory()->create([
            'room_id' => $this->room->id,
            'inviter_id' => $this->roomOwner->id,
            'expires_at' => now()->subMinutes(1)
        ]);

        $this->assertTrue($invitation->isExpired());
    }

    /** @test */
    public function it_creates_invitation_package_for_sharing()
    {
        $invitation = $this->roomUrlService->createInvitation(
            $this->room,
            $this->roomOwner,
            'test@example.com',
            'buyer'
        );

        $package = $this->roomUrlService->generateInvitationPackage($invitation);

        $this->assertArrayHasKey('url', $package);
        $this->assertArrayHasKey('pin', $package);
        $this->assertArrayHasKey('role', $package);
        $this->assertArrayHasKey('room_name', $package);
        $this->assertArrayHasKey('expires_at', $package);
        $this->assertArrayHasKey('email', $package);
        $this->assertArrayHasKey('inviter', $package);

        $this->assertEquals('test@example.com', $package['email']);
        $this->assertEquals('buyer', $package['role']);
        $this->assertEquals($invitation->pin, $package['pin']);
    }

    /** @test */
    public function api_creates_invitation_successfully()
    {
        $this->actingAs($this->roomOwner);

        $response = $this->postJson("/api/rooms/{$this->room->id}/invitations", [
            'email' => 'newuser@example.com',
            'role' => 'seller',
            'hours_valid' => 24
        ]);

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'invitation' => [
                        'url',
                        'pin',
                        'role',
                        'room_name',
                        'expires_at',
                        'email',
                        'inviter'
                    ],
                    'message'
                ]);

        $this->assertDatabaseHas('room_invitations', [
            'email' => 'newuser@example.com',
            'role' => 'seller'
        ]);
    }

    /** @test */
    public function api_validates_invitation_creation_data()
    {
        $this->actingAs($this->roomOwner);

        // Test missing email
        $response = $this->postJson("/api/rooms/{$this->room->id}/invitations", [
            'role' => 'buyer'
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['email']);

        // Test invalid role
        $response = $this->postJson("/api/rooms/{$this->room->id}/invitations", [
            'email' => 'test@example.com',
            'role' => 'invalid_role'
        ]);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['role']);
    }
}