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
}
