<?php

namespace Tests\Unit\Controllers\Web;

use App\Http\Controllers\Web\ApiShareLinksController;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class ApiShareLinksControllerTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected function setUp(): void
    {
        parent::setUp();
    }

    /** @test */
    public function it_can_generate_share_links()
    {
        // Arrange
        $room = Room::factory()->create([
            'room_number' => 101,
            'status' => 'free',
        ]);

        // Act
        $response = $this->post('/api/room/generate-share-links', [
            'room_id' => $room->id,
            'pin' => '1234',
        ]);

        // Assert
        $response->assertJson([
            'success' => true,
            'message' => 'Shareable links generated successfully',
            'data' => [
                'room' => [
                    'id' => $room->id,
                    'room_number' => $room->room_number,
                    'status' => $room->status,
                ],
                'pin_enabled' => true,
                'pin' => '1234',
                'links' => [
                    'buyer' => [
                        'url' => 'https://example.com/buyer',
                        'role' => 'buyer',
                        'label' => 'Buyer Link',
                        'description' => 'Share this link with someone who wants to buy',
                    ],
                ],
            ],
        ]);
    }

    /** @test */
    public function it_can_generate_share_links_with_pin()
    {
        // Arrange
        $room = Room::factory()->create([
            'room_number' => 101,
            'status' => 'free',
        ]);

        // Act
        $response = $this->post('/api/room/generate-share-links', [
            'room_id' => $room->id,
            'pin' => '5678',
        ]);

        // Assert
        $response->assertJson([
            'success' => true,
            'message' => 'Shareable links generated successfully',
            'data' => [
                'room' => [
                    'id' => $room->id,
                    'room_number' => $room->room_number,
                    'status' => $room->status,
                ],
                'pin_enabled' => true,
                'pin' => '5678',
                'links' => [
                    'buyer' => [
                        'url' => 'https://example.com/buyer',
                        'role' => 'buyer',
                        'label' => 'Buyer Link',
                        'description' => 'Share this link with someone who wants to buy',
                    ],
                ],
            ],
        ]);
    }

    /** @test */
    public function it_can_generate_share_links_without_pin()
    {
        // Arrange
        $room = Room::factory()->create([
            'room_number' => 101,
            'status' => 'free',
        ]);

        // Act
        $response = $this->post('/api/room/generate-share-links', [
            'room_id' => $room->id,
        ]);

        // Assert
        $response->assertJson([
            'success' => true,
            'message' => 'Shareable links generated successfully',
            'data' => [
                'room' => [
                    'id' => $room->id,
                    'room_number' => $room->room_number,
                    'status' => $room->status,
                ],
                'pin_enabled' => false,
                'pin' => null,
                'links' => [
                    'buyer' => [
                        'url' => 'https://example.com/buyer',
                        'role' => 'buyer',
                        'label' => 'Buyer Link',
                        'description' => 'Share this link with someone who wants to buy',
                    ],
                ],
            ],
        ]);
    }

    /** @test */
    public function it_fails_to_generate_links_for_invalid_room()
    {
        // Act
        $response = $this->post('/api/room/generate-share-links', [
            'room_id' => 999,
        ]);

        // Assert
        $response->assertJson([
            'success' => false,
            'message' => 'The selected room id is invalid.',
        ]);
        $response->assertStatus(422);
    }

    /** @test */
    public function it_fails_to_generate_links_with_invalid_pin_format()
    {
        // Act
        $response = $this->post('/api/room/generate-share-links', [
            'room_id' => 1,
            'pin' => '123', // Invalid format - too short
        ]);

        // Assert
        $response->assertJson([
            'success' => false,
            'message' => 'The pin field must be between 4 and 8 characters.',
        ]);
        $response->assertStatus(422);
    }
}