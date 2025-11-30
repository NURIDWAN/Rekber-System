<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomUser;
use App\Models\User;
use App\Services\MultiSessionManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoomRoleConstraintTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_seller_can_join_if_existing_seller_is_offline_reproduction()
    {
        // 1. Create a room
        $room = Room::create([
            'room_number' => '12345',
            'status' => 'free'
        ]);

        // 2. User A joins as Buyer (to allow seller to join)
        $buyer = RoomUser::create([
            'room_id' => $room->id,
            'name' => 'Buyer A',
            'role' => 'buyer',
            'user_identifier' => 'user_a',
            'session_token' => 'token_a',
            'is_online' => true,
            'joined_at' => now(),
            'last_seen' => now(),
        ]);

        $room->update(['status' => 'in_use']);

        // 3. User B joins as Seller
        $sellerA = RoomUser::create([
            'room_id' => $room->id,
            'name' => 'Seller A',
            'role' => 'seller',
            'user_identifier' => 'user_b',
            'session_token' => 'token_b',
            'is_online' => true,
            'joined_at' => now(),
            'last_seen' => now(),
        ]);

        // 4. User B goes offline
        $sellerA->update(['is_online' => false]);

        // 5. User C tries to join as Seller
        $manager = app(MultiSessionManager::class);
        $result = $manager->canJoinRoom($room->id, 'seller', 'user_c');

        // CURRENT BEHAVIOR: Should be allowed because existing seller is offline
        $this->assertTrue($result['can_join'], 'User C should be able to join as seller if User B is offline (current bug)');
    }

    public function test_new_buyer_can_join_if_existing_buyer_is_offline_reproduction()
    {
        // 1. Create a room
        $room = Room::create([
            'room_number' => '67890',
            'status' => 'free'
        ]);

        // 2. User A joins as Buyer
        $buyerA = RoomUser::create([
            'room_id' => $room->id,
            'name' => 'Buyer A',
            'role' => 'buyer',
            'user_identifier' => 'user_a',
            'session_token' => 'token_a',
            'is_online' => true,
            'joined_at' => now(),
            'last_seen' => now(),
        ]);

        $room->update(['status' => 'in_use']);

        // 3. User A goes offline
        $buyerA->update(['is_online' => false]);

        // 4. User B tries to join as Buyer
        $manager = app(MultiSessionManager::class);
        $result = $manager->canJoinRoom($room->id, 'buyer', 'user_b');

        // CURRENT BEHAVIOR: Should be allowed because existing buyer is offline
        $this->assertTrue($result['can_join'], 'User B should be able to join as buyer if User A is offline (current bug)');
    }
    public function test_user_cannot_join_multiple_rooms()
    {
        // 1. Create Room A
        $roomA = Room::create([
            'room_number' => '11111',
            'status' => 'free'
        ]);

        // 2. User joins Room A
        $manager = app(MultiSessionManager::class);
        $userIdentifier = 'user_test_multi';

        // Simulate joining Room A
        RoomUser::create([
            'room_id' => $roomA->id,
            'name' => 'User Test',
            'role' => 'buyer',
            'user_identifier' => $userIdentifier,
            'session_token' => 'token_a',
            'is_online' => true,
            'joined_at' => now(),
            'last_seen' => now(),
        ]);

        $roomA->update(['status' => 'in_use']);

        // 3. Create Room B
        $roomB = Room::create([
            'room_number' => '22222',
            'status' => 'free'
        ]);

        // 4. User tries to join Room B
        $result = $manager->canJoinRoom($roomB->id, 'buyer', $userIdentifier);

        // Should be denied
        $this->assertFalse($result['can_join'], 'User should not be able to join Room B while in Room A');
        $this->assertEquals('redirect_to_active', $result['suggested_action']);
        $this->assertEquals($roomA->id, $result['active_room_id']);

        // 5. Complete Room A
        $roomA->update(['status' => 'completed']);

        // 6. User tries to join Room B again
        $result = $manager->canJoinRoom($roomB->id, 'buyer', $userIdentifier);

        // Should be allowed
        $this->assertTrue($result['can_join'], 'User should be able to join Room B after Room A is completed');
    }
}
