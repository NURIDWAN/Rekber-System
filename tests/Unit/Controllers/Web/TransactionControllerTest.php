<?php

namespace Tests\Unit\Controllers\Web;

use App\Http\Controllers\Web\TransactionController;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\Transaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use Inertia\Testing\AssertableInertia;

class TransactionControllerTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected function setUp(): void
    {
        parent::setUp();
    }

    /** @test */
    public function it_can_display_user_transactions()
    {
        // Arrange
        $room = Room::factory()->create();
        $roomUser = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'name' => 'Test User',
            'is_online' => true,
            'user_identifier' => 'user_identifier_123',
            'session_token' => 'session_token_123',
        ]);

        $transactions = Transaction::factory()->count(3)->create([
            'room_id' => $room->id,
            'buyer_id' => $roomUser->id,
            'amount' => 1000000,
            'currency' => 'IDR',
            'status' => 'completed',
            'description' => "Transaction for Room #{$room->room_number}",
        ]);

        // Mock request data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $roomUser,
            'user_identifier' => 'user_identifier_123',
        ]);

        // Act
        $response = $this->get('/user/transactions');

        // Assert
        $response->assertOk();
        $response->assertInertia('user/transactions/index', [
            'transactions' => function ($transactions) {
                $this->assertCount(3, $transactions);
                return $transactions->map(function ($transaction) {
                    return [
                        'id' => $transaction->id,
                        'transaction_number' => $transaction->transaction_number,
                        'amount' => $transaction->amount,
                        'currency' => $transaction->currency,
                        'status' => $transaction->status,
                        'status_label' => $transaction->getStatusLabel(),
                        'room_number' => $transaction->room->room_number,
                        'buyer_name' => $transaction->buyer->name,
                        'seller_name' => $transaction->seller?->name,
                        'description' => $transaction->description,
                        'created_at' => $transaction->created_at->format('Y-m-d H:i:s'),
                        'updated_at' => $transaction->updated_at->format('Y-m-d H:i:s'),
                        'can_view' => $transaction->uploaded_by === $roomUser->role ||
                                     in_array($transaction->status, ['approved', 'verified']),
                        'files' => $transaction->files->map(function ($file) use ($transaction, $roomUser) {
                            return [
                                'id' => $file->id,
                                'file_type' => $file->file_type,
                                'file_name' => $file->file_name,
                                'file_size' => $file->file_size,
                                'mime_type' => $file->mime_type,
                                'status' => $file->status,
                                'uploaded_by' => $file->uploaded_by,
                                'can_view' => $file->uploaded_by === $roomUser->role ||
                                             in_array($file->status, ['approved', 'verified']),
                                'file_url' => $file->status === 'approved' || $file->status === 'verified'
                                    ? Storage::url($file->file_path)
                                    : null,
                                'verified_at' => $file->verified_at?->format('Y-m-d H:i:s'),
                                'created_at' => $file->created_at->format('Y-m-d H:i:s'),
                            ];
                        }),
                    ];
                });
            },
            'stats' => [
                'total_transactions' => 3,
                'pending_transactions' => 0,
                'active_transactions' => 1,
                'completed_transactions' => 2,
                'total_amount' => 25000000,
            ],
            'currentUser' => [
                'name' => $roomUser->name,
                'role' => $roomUser->role,
                'room_id' => $roomUser->room_id,
                'user_role_in_transaction' => 'buyer',
            ],
        ]);
    }

    /** @test */
    public function it_can_display_transaction_details()
    {
        // Arrange
        $room = Room::factory()->create();
        $buyer = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'name' => 'Test Buyer',
            'is_online' => true,
        ]);

        $transaction = Transaction::factory()->create([
            'room_id' => $room->id,
            'buyer_id' => $buyer->id,
            'seller_id' => null,
            'amount' => 5000000,
            'currency' => 'IDR',
            'status' => 'completed',
            'description' => "Transaction for Room #{$room->room_number}",
            'created_at' => now()->subDays(2),
            'updated_at' => now(),
        ]);

        // Mock request data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $buyer,
            'user_identifier' => 'user_identifier_123',
        ]);

        // Act
        $response = $this->get("/user/transactions/{$transaction->id}");

        // Assert
        $response->assertOk();
        $response->assertInertia('user/transactions/show', [
            'transaction' => [
                'id' => $transaction->id,
                'transaction_number' => $transaction->transaction_number,
                'amount' => $transaction->amount,
                'currency' => $transaction->currency,
                'status' => $transaction->status,
                'status_label' => $transaction->getStatusLabel(),
                'room' => [
                    'id' => $room->id,
                    'room_number' => $room->room_number,
                ],
                'buyer' => [
                    'name' => $transaction->buyer->name,
                ],
                'seller' => null,
                'description' => $transaction->description,
                'timestamps' => [
                    'created_at' => $transaction->created_at->format('Y-m-d H:i:s'),
                    'updated_at' => $transaction->updated_at->format('Y-m-d H:i:s'),
                ],
            ],
            'activities' => function ($activities) {
                $this->assertCount(0, $activities);
            },
            'currentUser' => [
                'name' => $buyer->name,
                'role' => $buyer->role,
                'room_id' => $buyer->room_id,
                'user_role_in_transaction' => 'buyer',
            ],
        ]);
    }

    /** @test */
    public function it_cannot_access_transactions_without_session()
    {
        // Arrange
        Room::factory()->create();

        // Act
        $response = $this->get('/user/transactions');

        // Assert
        $response->assertRedirect('/rooms')
            ->assertSessionHasErrors(['error' => 'Please join a room first to view transactions']);
    }

    /** @test */
    public function it_cannot_access_transaction_without_permission()
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

        $transaction = Transaction::factory()->create([
            'room_id' => $room->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount' => 5000000,
            'currency' => 'IDR',
            'status' => 'completed',
        ]);

        // Mock request as seller user
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $seller,
            'user_identifier' => 'user_identifier_123',
        ]);

        // Act
        $response = $this->get("/user/transactions/{$transaction->id}");

        // Assert
        $response->assertRedirect('/rooms')
            ->assertSessionHasErrors(['error' => 'You do not have access to this transaction']);
    }
}