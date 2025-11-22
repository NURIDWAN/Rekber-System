<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Services\RoomUrlService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoomJoinApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Create a room for testing
        $this->room = Room::factory()->create([
            'status' => 'free',
        ]);

        $this->roomUrlService = app(RoomUrlService::class);
    }

    public function test_can_generate_valid_token()
    {
        $token = $this->roomUrlService->generateToken($this->room->id, 'buyer', null, true);

        $this->assertNotEmpty($token);

        $decrypted = $this->roomUrlService->decryptToken($token);

        $this->assertNotNull($decrypted);
        $this->assertEquals($this->room->id, $decrypted['room_id']);
        $this->assertEquals('buyer', $decrypted['role']);
    }

    public function test_can_join_room_as_buyer_with_valid_token()
    {
        $token = $this->roomUrlService->generateToken($this->room->id, 'buyer', null, true);

        $response = $this->postJson("/api/room/{$token}/join-with-token", [
            'name' => 'John Doe',
            'phone' => '+1234567890',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Successfully joined the room',
            ]);

        $this->assertDatabaseHas('room_users', [
            'room_id' => $this->room->id,
            'name' => 'John Doe',
            'phone' => '+1234567890',
            'role' => 'buyer',
        ]);

        $this->room->refresh();
        $this->assertEquals('in_use', $this->room->status);
    }

    public function test_cannot_join_room_as_seller_when_no_buyer()
    {
        $token = $this->roomUrlService->generateToken($this->room->id, 'seller', null, true);

        $response = $this->postJson("/api/room/{$token}/join-with-token", [
            'name' => 'Jane Doe',
            'phone' => '+1234567890',
        ]);

        $response->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'Room is not available for this role',
            ]);
    }

    public function test_cannot_join_same_role_twice()
    {
        // First buyer joins
        $token = $this->roomUrlService->generateToken($this->room->id, 'buyer', null, true);

        $this->postJson("/api/room/{$token}/join-with-token", [
            'name' => 'John Doe',
            'phone' => '+1234567890',
        ]);

        // Refresh the room to get updated status
        $this->room->refresh();

        // Second buyer tries to join
        $token2 = $this->roomUrlService->generateToken($this->room->id, 'buyer', null, true);

        $response = $this->postJson("/api/room/{$token2}/join-with-token", [
            'name' => 'Jane Doe',
            'phone' => '+1234567890',
        ]);

        $response->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'This role is already taken in this room',
            ]);
    }

    public function test_can_join_as_seller_after_buyer_joined()
    {
        // First, add a buyer
        $buyerToken = $this->roomUrlService->generateToken($this->room->id, 'buyer', null, true);

        $this->postJson("/api/room/{$buyerToken}/join-with-token", [
            'name' => 'John Buyer',
            'phone' => '+1234567890',
        ]);

        // Now a seller can join
        $sellerToken = $this->roomUrlService->generateToken($this->room->id, 'seller', null, true);

        $response = $this->postJson("/api/room/{$sellerToken}/join-with-token", [
            'name' => 'Jane Seller',
            'phone' => '+0987654321',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Successfully joined the room',
            ]);

        $this->assertDatabaseHas('room_users', [
            'room_id' => $this->room->id,
            'name' => 'Jane Seller',
            'phone' => '+0987654321',
            'role' => 'seller',
        ]);
    }
}