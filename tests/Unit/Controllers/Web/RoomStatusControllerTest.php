<?php

namespace Tests\Unit\Controllers\Web;

use App\Http\Controllers\Web\RoomStatusController;
use App\Models\Room;
use App\Models\RoomUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class RoomStatusControllerTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected function setUp(): void
    {
        parent::setUp();
    }

    /** @test */
    public function it_can_get_room_status_updates()
    {
        // Arrange
        Room::factory()->count(3)->create([
            'room_number' => 101,
            'status' => 'in_use',
        ]);
        Room::factory()->create([
            'room_number' => 102,
            'status' => 'free',
        ]);

        $roomUser = RoomUser::factory()->create([
            'room_id' => 1,
            'role' => 'buyer',
            'name' => 'Test User',
            'is_online' => true,
        ]);

        // Act
        $response = $this->get('/api/rooms/status');

        // Assert
        $response->assertJson([
            'success' => true,
        ]);

        $response->assertJsonCount(2);

        $rooms = $response->json();
        foreach ($rooms as $room) {
            $this->assertArrayHasKey('room_id', $room);
            $this->assertArrayHasKey('status', $room);
            $this->assertArrayHasKey('has_buyer', $room);
            $this->assertArrayHasKey('has_seller', $room);
            $this->assertArrayHasKey('available_for_buyer', $room);
            $this->assertArrayHasKey('available_for_seller', $room);

            // Check first room (in_use)
            if ($room['room_number'] == 101) {
                $this->assertEquals('in_use', $room['status']);
                $this->assertFalse($room['has_buyer']);
                $this->assertTrue($room['has_seller']);
                $this->assertFalse($room['available_for_buyer']);
                $this->assertTrue($room['available_for_seller']);
            }

            // Check second room (free)
            if ($room['room_number'] == 102) {
                $this->assertEquals('free', $room['status']);
                $this->assertFalse($room['has_buyer']);
                $this->assertFalse($room['has_seller']);
                $this->assertTrue($room['available_for_buyer']);
                $this->assertTrue($room['available_for_seller']);
            }

            // Check first user
            $this->assertEquals('Test User', $room['user_name']);
            $this->assertEquals('buyer', $room['role']);
            $this->assertEquals('room_updated', $room['action']);
            $this->assertNotNull($room['timestamp']);
        }
    }

    /** @test */
    public function it_can_get_empty_room_status()
    {
        // Arrange - no rooms exist
        Room::truncate();

        // Act
        $response = $this->get('/api/rooms/status');

        // Assert
        $response->assertJson([
            'success' => true,
        ]);

        $response->assertJsonCount(0);
    }
}