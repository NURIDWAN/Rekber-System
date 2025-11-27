<?php

namespace Tests\Unit\Controllers\Web;

use App\Http\Controllers\Web\RoomController;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\RoomMessage;
use App\Models\RoomActivityLog;
use App\Models\Transaction;
use App\Models\TransactionFile;
use App\Services\RoomUrlService;
use App\Services\MultiSessionManager;
use App\Events\RoomActivityLogged;
use App\Events\RoomMessageSent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class RoomControllerTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected function setUp(): void
    {
        parent::setUp();

        // Mock services
        $this->mock(RoomUrlService::class, function ($mock) {
            $mock->shouldReceive('generateShareableLinks')
                 ->andReturn([
                     'buyer' => ['url' => 'https://example.com/buyer'],
                     'seller' => ['url' => 'https://example.com/seller'],
                 ]);

            $mock->shouldReceive('encryptRoomId')
                 ->andReturn('encrypted_room_id');

            $mock->shouldReceive('generateRoomUrl')
                 ->andReturn('https://example.com/room/encrypted_room_id');

            $mock->shouldReceive('generateRoomJoinUrl')
                 ->andReturn('https://example.com/join/encrypted_room_id');

            $mock->shouldReceive('generateJoinUrl')
                 ->andReturn('https://example.com/join/token');

            $mock->shouldReceive('generateEnterUrl')
                 ->andReturn('https://example.com/enter/token');
        });

        $this->mock(MultiSessionManager::class, function ($mock) {
            $mock->shouldReceive('getUserIdentifierFromCookie')
                 ->andReturn('user_identifier_123');

            $mock->shouldReceive('generateCookieName')
                 ->andReturn('room_session_1');
        });
    }

    /** @test */
    public function it_can_display_rooms_index()
    {
        // Arrange
        Room::factory()->count(3)->create([
            'status' => 'free',
            'room_number' => 101
        ]);

        // Act
        $response = $this->get('/rooms');

        // Assert
        $response->assertOk();
        $response->assertInertia('rooms', [
            'rooms' => function ($rooms) {
                $this->assertCount(3, $rooms);
            }
        ]);
    }

    /** @test */
    public function it_can_display_room_join_form()
    {
        // Arrange
        $room = Room::factory()->create([
            'room_number' => 102,
            'status' => 'free'
        ]);

        // Act
        $response = $this->get("/rooms/{$room->id}/join");

        // Assert
        $response->assertOk();
        $response->assertInertia('rooms/[id]/join', [
            'room' => [
                'id' => $room->id,
                'room_number' => 102,
                'status' => 'free',
                'has_buyer' => false,
                'has_seller' => false,
                'current_user_role' => null,
                'current_user_name' => null,
            ],
            'role' => 'buyer',
            'token' => null
        ]);
    }

    /** @test */
    public function it_can_join_room_as_buyer()
    {
        // Arrange
        $room = Room::factory()->create([
            'status' => 'free'
        ]);

        $userData = [
            'name' => 'Test Buyer',
            'phone' => '+1234567890',
            'role' => 'buyer'
        ];

        // Act
        $response = $this->post("/rooms/{$room->id}/join", $userData);

        // Assert
        $response->assertRedirect();

        $this->assertDatabaseHas('room_users', [
            'room_id' => $room->id,
            'name' => 'Test Buyer',
            'phone' => '+1234567890',
            'role' => 'buyer',
            'is_online' => true,
        ]);

        $this->assertDatabaseHas('room_activity_logs', [
            'room_id' => $room->id,
            'action' => 'buyer_joined',
            'user_name' => 'Test Buyer',
            'role' => 'buyer',
            'description' => 'Buyer joined room',
        ]);

        // Check room status updated
        $this->assertDatabaseHas('rooms', [
            'id' => $room->id,
            'status' => 'in_use',
        ]);
    }

    /** @test */
    public function it_cannot_join_room_if_not_available_for_buyer()
    {
        // Arrange
        $room = Room::factory()->create();
        RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'is_online' => true,
        ]);

        $userData = [
            'name' => 'Test Buyer 2',
            'phone' => '+1234567890',
            'role' => 'buyer'
        ];

        // Act
        $response = $this->post("/rooms/{$room->id}/join", $userData);

        // Assert
        $response->assertSessionHasErrors(['general' => 'Room is not available for buyer']);

        $this->assertDatabaseMissing('room_users', [
            'name' => 'Test Buyer 2',
            'phone' => '+1234567890',
        ]);
    }

    /** @test */
    public function it_cannot_join_if_already_in_another_room()
    {
        // Arrange
        $room = Room::factory()->create();
        $existingUser = RoomUser::factory()->create([
            'session_token' => 'existing_token_123',
            'is_online' => true,
        ]);

        // Set existing session cookie
        $this->withCookie('room_session_token', 'existing_token_123');

        $userData = [
            'name' => 'Test User',
            'phone' => '+1234567890',
            'role' => 'seller'
        ];

        // Act
        $response = $this->post("/rooms/{$room->id}/join", $userData);

        // Assert
        $response->assertSessionHasErrors(['general' => 'You are already in another room']);
    }

    /** @test */
    public function it_can_display_room_show()
    {
        // Arrange
        $room = Room::factory()->create();
        $buyer = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'name' => 'Test Buyer',
            'is_online' => true,
        ]);
        $seller = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'seller',
            'name' => 'Test Seller',
            'is_online' => true,
        ]);

        // Mock middleware data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $buyer,
            'user_identifier' => 'user_identifier_123',
            'encrypted_room_id' => 'encrypted_room_id',
        ]);

        // Act
        $response = $this->get("/rooms/encrypted_room_id");

        // Assert
        $response->assertOk();
        $response->assertInertia('rooms/[id]/index', [
            'room' => [
                'id' => $room->id,
                'room_number' => $room->room_number,
                'status' => $room->status,
                'buyer' => [
                    'name' => 'Test Buyer',
                    'is_online' => true,
                ],
                'seller' => [
                    'name' => 'Test Seller',
                    'is_online' => true,
                ],
                'messages' => [],
            ],
            'currentUser' => [
                'role' => 'buyer',
                'name' => 'Test Buyer',
                'is_online' => true,
            ],
            'encrypted_room_id' => 'encrypted_room_id',
        ]);
    }

    /** @test */
    public function it_can_send_message_to_room()
    {
        // Arrange
        $room = Room::factory()->create();
        $roomUser = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'name' => 'Test User',
            'is_online' => true,
        ]);

        // Mock middleware data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $roomUser,
        ]);

        $messageData = [
            'message' => 'This is a test message',
            'type' => 'text',
        ];

        Event::fake();

        // Act
        $response = $this->post("/rooms/{$room->id}/message", $messageData);

        // Assert
        $response->assertRedirect();

        $this->assertDatabaseHas('room_messages', [
            'room_id' => $room->id,
            'sender_role' => 'buyer',
            'sender_name' => 'Test User',
            'message' => 'This is a test message',
            'type' => 'text',
        ]);

        $this->assertDatabaseHas('room_activity_logs', [
            'room_id' => $room->id,
            'action' => 'message_sent',
            'user_name' => 'Test User',
            'role' => 'buyer',
            'description' => 'Sent a text message',
        ]);

        Event::assertDispatched(RoomMessageSent::class);
    }

    /** @test */
    public function it_can_leave_room()
    {
        // Arrange
        $room = Room::factory()->create(['status' => 'in_use']);
        $roomUser = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'name' => 'Test User',
            'is_online' => true,
        ]);

        // Mock middleware data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $roomUser,
            'user_identifier' => 'user_identifier_123',
        ]);

        // Act
        $response = $this->post("/rooms/{$room->id}/leave");

        // Assert
        $response->assertRedirect('/rooms');

        $this->assertDatabaseMissing('room_users', [
            'id' => $roomUser->id,
        ]);

        $this->assertDatabaseHas('room_activity_logs', [
            'room_id' => $room->id,
            'action' => 'user_left',
            'user_name' => 'Test User',
            'role' => 'buyer',
            'description' => 'buyer left room',
        ]);

        // Room status should be reset to free since it's now empty
        $this->assertDatabaseHas('rooms', [
            'id' => $room->id,
            'status' => 'free',
        ]);
    }

    /** @test */
    public function it_can_upload_payment_proof()
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

        // Mock middleware data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $buyer,
        ]);

        $file = UploadedFile::fake()->create('payment_proof.jpg', 100);

        $uploadData = [
            'file' => $file,
            'file_type' => 'payment_proof',
        ];

        Storage::fake('public');

        Event::fake();

        // Act
        $response = $this->post("/rooms/{$room->id}/upload", $uploadData);

        // Assert
        $response->assertJson([
            'success' => true,
            'message' => 'Uploaded payment proof (awaiting verification)',
            'transaction_status' => 'awaiting_payment_verification',
        ]);

        $this->assertDatabaseHas('transactions', [
            'room_id' => $room->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'status' => 'awaiting_payment_verification',
            'description' => "Transaction for Room #{$room->room_number}",
        ]);

        $this->assertDatabaseHas('transaction_files', [
            'room_id' => $room->id,
            'file_type' => 'payment_proof',
            'file_name' => 'payment_proof.jpg',
            'uploaded_by' => 'buyer',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('room_messages', [
            'room_id' => $room->id,
            'sender_role' => 'system',
            'sender_name' => 'System',
            'type' => 'image',
        ]);

        Event::assertDispatched(RoomMessageSent::class);
    }

    /** @test */
    public function it_cannot_upload_if_unauthorized()
    {
        // Arrange - no middleware data set
        $room = Room::factory()->create();
        $file = UploadedFile::fake()->create('test.jpg', 100);

        $uploadData = [
            'file' => $file,
            'file_type' => 'payment_proof',
        ];

        // Act
        $response = $this->post("/rooms/{$room->id}/upload", $uploadData);

        // Assert
        $response->assertJson([
            'success' => false,
            'message' => 'Unauthorized for this room',
        ]);

        $this->assertDatabaseMissing('transaction_files', [
            'file_name' => 'test.jpg',
        ]);
    }

    /** @test */
    public function it_validates_upload_file_size()
    {
        // Arrange
        $room = Room::factory()->create();
        $roomUser = RoomUser::factory()->create([
            'room_id' => $room->id,
        ]);

        // Mock middleware data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $roomUser,
        ]);

        $file = UploadedFile::fake()->create('large_file.jpg', 6000); // 6MB, exceeds 5MB limit

        $uploadData = [
            'file' => $file,
            'file_type' => 'payment_proof',
        ];

        // Act
        $response = $this->post("/rooms/{$room->id}/upload", $uploadData);

        // Assert
        $response->assertSessionHasErrors(['file']);
    }
}