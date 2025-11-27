<?php

namespace Tests\Unit\Controllers\Web;

use App\Http\Controllers\Web\RoomPollingController;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\Transaction;
use App\Models\TransactionFile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RoomPollingControllerTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected function setUp(): void
    {
        parent::setUp();
    }

    /** @test */
    public function it_can_get_polling_data_with_transaction()
    {
        // Arrange
        $room = Room::factory()->create();
        $buyer = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'buyer',
            'name' => 'Test Buyer',
        ]);
        $seller = RoomUser::factory()->create([
            'room_id' => $room->id,
            'role' => 'seller',
            'name' => 'Test Seller',
        ]);

        $transaction = Transaction::factory()->create([
            'room_id' => $room->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount' => 1000000,
            'currency' => 'IDR',
            'status' => 'awaiting_payment_verification',
            'description' => "Transaction for Room #{$room->room_number}",
        ]);

        $transactionFile1 = TransactionFile::factory()->create([
            'transaction_id' => $transaction->id,
            'file_type' => 'payment_proof',
            'file_name' => 'payment_proof.jpg',
            'file_path' => 'room-files/1/payment_proof.jpg',
            'file_size' => 1024000,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => 'buyer',
            'status' => 'pending',
            'verified_at' => null,
        ]);

        $transactionFile2 = TransactionFile::factory()->create([
            'transaction_id' => $transaction->id,
            'file_type' => 'shipping_receipt',
            'file_name' => 'shipping_receipt.jpg',
            'file_path' => 'room-files/1/shipping_receipt.jpg',
            'file_size' => 512000,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => 'seller',
            'status' => 'verified',
            'verified_at' => now()->subHours(2),
        ]);

        // Mock request data
        request()->merge([
            'current_room' => $room,
            'current_room_user' => $buyer,
            'user_identifier' => 'user_identifier_123',
        ]);

        Storage::fake();

        // Act
        $response = $this->get("/rooms/{$room->id}/polling-data");

        // Assert
        $response->assertJson([
            'success' => true,
            'data' => [
                'transactions' => [
                    [
                        'id' => $transaction->id,
                        'transaction_number' => $transaction->transaction_number,
                        'status' => $transaction->status,
                        'amount' => $transaction->amount,
                        'currency' => $transaction->currency,
                        'room_id' => $transaction->room_id,
                        'room_number' => $room->room_number,
                        'room_status' => $room->status,
                        'buyer_name' => $buyer->name,
                        'progress' => 25,
                        'current_action' => 'Payment verification pending',
                    ],
                ],
                'files' => [
                    [
                        'id' => $transactionFile1->id,
                        'file_type' => 'payment_proof',
                        'file_name' => 'payment_proof.jpg',
                        'file_size' => $transactionFile1->file_size,
                        'mime_type' => $transactionFile1->mime_type,
                        'status' => $transactionFile1->status,
                        'verified_at' => $transactionFile1->verified_at,
                        'rejection_reason' => $transactionFile1->rejection_reason,
                        'uploaded_by' => $transactionFile1->uploaded_by,
                        'file_url' => Storage::url($transactionFile1->file_path),
                        'transaction_id' => $transaction->id,
                        'transaction_number' => $transaction->transaction_number,
                        'transaction_status' => $transaction->status,
                        'transaction_progress' => 25,
                        'transaction_current_action' => 'Payment verification pending',
                        'room_id' => $room->id,
                        'room_number' => $room->room_number,
                    ],
                    [
                        'id' => $transactionFile2->id,
                        'file_type' => 'shipping_receipt',
                        'file_name' => 'shipping_receipt.jpg',
                        'file_size' => $transactionFile2->file_size,
                        'mime_type' => $transactionFile2->mime_type,
                        'status' => $transactionFile2->status,
                        'verified_at' => $transactionFile2->verified_at,
                        'rejection_reason' => $transactionFile2->rejection_reason,
                        'uploaded_by' => $transactionFile2->uploaded_by,
                        'file_url' => Storage::url($transactionFile2->file_path),
                        'transaction_id' => $transaction->id,
                        'transaction_number' => $transaction->transaction_number,
                        'transaction_status' => $transaction->status,
                        'transaction_progress' => 25,
                        'transaction_current_action' => 'Shipping verification pending',
                        'room_id' => $room->id,
                        'room_number' => $room->room_number,
                    ],
                ],
            ],
        ]);
    }

    /** @test */
    public function it_can_get_polling_data_without_transaction()
    {
        // Arrange
        $room = Room::factory()->create();

        // Act
        $response = $this->get("/rooms/{$room->id}/polling-data");

        // Assert
        $response->assertJson([
            'success' => true,
            'data' => [
                'transactions' => [],
                'files' => [],
            ],
        ]);
    }
}