<?php

namespace Tests\Unit\Controllers\Web;

use App\Http\Controllers\Web\GmController;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\RoomMessage;
use App\Models\Transaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class GmControllerTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected function setUp(): void
    {
        parent::setUp();

        // Mock RoomUrlService for dashboard test
        $this->mock(\App\Services\RoomUrlService::class, function ($mock) {
            $mock->shouldReceive('encryptRoomId')
                 ->andReturn('encrypted_room_id');

            $mock->shouldReceive('generateRoomUrl')
                 ->andReturn('https://example.com/room/encrypted_room_id');
        });
    }

    /** @test */
    public function it_can_display_gm_rooms_page()
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

        // Act
        $response = $this->get('/gm/rooms');

        // Assert
        $response->assertOk();
        $response->assertInertia('gm/room-management', [
            'rooms' => function ($rooms) {
                $this->assertCount(3, $rooms);
                return $rooms->map(function ($room) {
                    return [
                        'id' => $room->id,
                        'room_number' => $room->room_number,
                        'status' => $room->status,
                        'created_at' => $room->created_at->toISOString(),
                        'updated_at' => $room->updated_at->toISOString(),
                        'has_buyer' => $room->hasBuyer(),
                        'has_seller' => $room->hasSeller(),
                        'is_available_for_buyer' => $room->isAvailableForBuyer(),
                        'is_available_for_seller' => $room->isAvailableForSeller(),
                        'participants' => function ($room) {
                            $participants = [];
                            if ($room->hasBuyer()) {
                                $participants[] = 'Buyer';
                            }
                            if ($room->hasSeller()) {
                                $participants[] = 'Seller';
                            }
                            $participants[] = 'GM';
                            return $participants;
                        },
                    ];
                });
            },
            'stats' => [
                'total_rooms' => 4,
                'free_rooms' => 1,
                'in_use_rooms' => 2,
                'active_users' => RoomUser::where('is_online', true)->count(),
            ]
        ]);
    }

    /** @test */
    public function it_can_display_gm_dashboard()
    {
        // Arrange
        Room::factory()->count(5)->create(['status' => 'in_use']);

        // Mock transaction stats
        $transactionStats = [
            'total_transactions' => 10,
            'pending_payment' => 3,
            'active_transactions' => 5,
            'completed_transactions' => 2,
            'disputed_transactions' => 0,
            'total_volume' => 50000000,
            'total_commission' => 2500000,
            'pending_payment_amount' => 15000000,
        ];

        // Mock recent transactions
        $recentTransactions = collect([
            [
                'id' => 1,
                'transaction_number' => 'TRX-001',
                'amount' => 10000000,
                'currency' => 'IDR',
                'status' => 'completed',
                'room_number' => 101,
                'buyer_name' => 'Test Buyer',
                'seller_name' => 'Test Seller',
                'created_at' => now()->subDays(5)->toISOString(),
            ],
            [
                'id' => 2,
                'transaction_number' => 'TRX-002',
                'amount' => 7500000,
                'currency' => 'IDR',
                'status' => 'pending_payment',
                'room_number' => 102,
                'buyer_name' => 'Test Buyer 2',
                'seller_name' => null,
                'created_at' => now()->subDays(3)->toISOString(),
            ],
        ]);

        // Act
        $response = $this->get('/dashboard');

        // Assert
        $response->assertOk();
        $response->assertInertia('dashboard', [
            'rooms' => function ($rooms) {
                $this->assertCount(5, $rooms);
                return $rooms->map(function ($room) {
                    return [
                        'id' => $room->id,
                        'room_number' => $room->room_number,
                        'status' => $room->status,
                        'buyer' => $room->buyer->first() ? [
                            'name' => $room->buyer->first()->name,
                            'is_online' => $room->buyer->first()->is_online,
                            'joined_at' => $room->buyer->first()->joined_at,
                        ] : null,
                        'seller' => $room->seller->first() ? [
                            'name' => $room->seller->first()->name,
                            'is_online' => $room->seller->first()->is_online,
                            'joined_at' => $room->seller->first()->joined_at,
                        ] : null,
                        'last_message' => $room->messages->first(),
                        'activity_count' => $room->activityLogs()->count(),
                    ];
                });
            },
            'stats' => $transactionStats,
            'recentTransactions' => $recentTransactions,
        ]);
    }

    /** @test */
    public function it_can_display_room_details()
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
            'is_online' => false,
        ]);

        $message1 = RoomMessage::factory()->create([
            'room_id' => $room->id,
            'sender_role' => 'buyer',
            'sender_name' => 'Test Buyer',
            'message' => 'Test message 1',
            'type' => 'text',
            'created_at' => now()->subMinutes(10),
        ]);
        $message2 = RoomMessage::factory()->create([
            'room_id' => $room->id,
            'sender_role' => 'seller',
            'sender_name' => 'Test Seller',
            'message' => 'Test message 2',
            'type' => 'text',
            'created_at' => now()->subMinutes(5),
        ]);

        $activityLog1 = RoomActivityLog::factory()->create([
            'room_id' => $room->id,
            'action' => 'message_sent',
            'user_name' => 'Test Buyer',
            'role' => 'buyer',
            'description' => 'Sent a text message',
            'timestamp' => now()->subMinutes(10),
        ]);
        $activityLog2 = RoomActivityLog::factory()->create([
            'room_id' => $room->id,
            'action' => 'message_sent',
            'user_name' => 'Test Seller',
            'role' => 'seller',
            'description' => 'Sent a text message',
            'timestamp' => now()->subMinutes(5),
        ]);

        // Mock services
        $this->mock(\App\Services\RoomUrlService::class, function ($mock) {
            $mock->shouldReceive('encryptRoomId')
                 ->andReturn('encrypted_room_id');
        });

        // Mock request data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $buyer,
            'user_identifier' => 'user_identifier_123',
            'encrypted_room_id' => 'encrypted_room_id',
        ]);

        // Act
        $response = $this->get("/room/{$room->id}");

        // Assert
        $response->assertOk();
        $response->assertInertia('gm/room-details', [
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
                    'is_online' => false,
                ],
                'messages' => [
                    [
                        'id' => $message1->id,
                        'sender_role' => $message1->sender_role,
                        'sender_name' => $message1->sender_name,
                        'message' => $message1->message,
                        'type' => $message1->type,
                        'created_at' => $message1->created_at->toISOString(),
                    ],
                    [
                        'id' => $message2->id,
                        'sender_role' => $message2->sender_role,
                        'sender_name' => $message2->sender_name,
                        'message' => $message2->message,
                        'type' => $message2->type,
                        'created_at' => $message2->created_at->toISOString(),
                    ],
                ],
                'activity_logs' => [
                    [
                        'id' => $activityLog1->id,
                        'action' => $activityLog1->action,
                        'user_name' => $activityLog1->user_name,
                        'role' => $activityLog1->role,
                        'description' => $activityLog1->description,
                        'timestamp' => $activityLog1->timestamp->toISOString(),
                    ],
                    [
                        'id' => $activityLog2->id,
                        'action' => $activityLog2->action,
                        'user_name' => $activityLog2->user_name,
                        'role' => $activityLog2->role,
                        'description' => $activityLog2->description,
                        'timestamp' => $activityLog2->timestamp->toISOString(),
                    ],
                ],
            ],
        ]);
    }
}