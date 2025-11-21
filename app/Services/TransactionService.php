<?php

namespace App\Services;

use App\Models\Room;
use App\Models\RoomUser;
use App\Models\RoomActivityLog;
use App\Models\RoomMessage;
use App\Events\RoomMessageSent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class TransactionService
{
    /**
     * Process buyer payment proof upload
     */
    public function processPaymentProof(Room $room, RoomUser $buyer, $fileUrl, $fileName)
    {
        try {
            DB::beginTransaction();

            // Create activity log
            RoomActivityLog::logActivity(
                $room->id,
                'payment_proof_uploaded',
                $buyer->name,
                'buyer',
                "Payment proof uploaded: {$fileName}"
            );

            // Create system message
            $message = RoomMessage::createSystemMessage(
                $room->id,
                "🔐 Payment proof has been uploaded by {$buyer->name}. GM will verify the payment."
            );

            // Update room status to payment_pending
            $room->update(['status' => 'payment_pending']);

            // Notify seller and GM
            $this->notifyPaymentProofUploaded($room, $buyer);

            DB::commit();

            return [
                'success' => true,
                'message' => 'Payment proof uploaded successfully',
                'data' => $message
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * GM verifies payment proof
     */
    public function verifyPaymentProof(Room $room, $verified = true, $notes = '')
    {
        try {
            DB::beginTransaction();

            if ($verified) {
                RoomActivityLog::logActivity(
                    $room->id,
                    'payment_verified',
                    'GM',
                    'gm',
                    "Payment verified. " . ($notes ? "Notes: {$notes}" : '')
                );

                $message = RoomMessage::createSystemMessage(
                    $room->id,
                    "✅ Payment has been verified by GM. " . ($notes ? "Notes: {$notes}" : '')
                );

                // Update room status to payment_verified
                $room->update(['status' => 'payment_verified']);

                $this->notifyPaymentVerified($room);
            } else {
                RoomActivityLog::logActivity(
                    $room->id,
                    'payment_rejected',
                    'GM',
                    'gm',
                    "Payment rejected. " . ($notes ? "Reason: {$notes}" : '')
                );

                $message = RoomMessage::createSystemMessage(
                    $room->id,
                    "❌ Payment has been rejected by GM. " . ($notes ? "Reason: {$notes}" : '')
                );

                // Reset room status for buyer to upload new proof
                $room->update(['status' => 'payment_rejected']);

                $this->notifyPaymentRejected($room);
            }

            DB::commit();

            return [
                'success' => true,
                'message' => $verified ? 'Payment verified successfully' : 'Payment rejected',
                'data' => $message
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Process seller shipping receipt upload
     */
    public function processShippingReceipt(Room $room, RoomUser $seller, $fileUrl, $fileName)
    {
        try {
            DB::beginTransaction();

            // Create activity log
            RoomActivityLog::logActivity(
                $room->id,
                'shipping_receipt_uploaded',
                $seller->name,
                'seller',
                "Shipping receipt uploaded: {$fileName}"
            );

            // Create system message
            $message = RoomMessage::createSystemMessage(
                $room->id,
                "📦 Shipping receipt has been uploaded by {$seller}. Please wait for buyer confirmation."
            );

            // Update room status to shipped
            $room->update(['status' => 'shipped']);

            // Notify buyer and GM
            $this->notifyShipped($room, $seller);

            DB::commit();

            return [
                'success' => true,
                'message' => 'Shipping receipt uploaded successfully',
                'data' => $message
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Buyer confirms receipt of goods
     */
    public function confirmReceipt(Room $room, RoomUser $buyer, $notes = '')
    {
        try {
            DB::beginTransaction();

            RoomActivityLog::logActivity(
                $room->id,
                'goods_received',
                $buyer->name,
                'buyer',
                "Buyer confirmed receipt of goods. " . ($notes ? "Notes: {$notes}" : '')
            );

            $message = RoomMessage::createSystemMessage(
                $room->id,
                "🎉 Buyer has confirmed receipt of goods! " . ($notes ? "Notes: {$notes}" : '')
            );

            // Update room status to goods_received
            $room->update(['status' => 'goods_received']);

            // Notify seller and GM
            $this->notifyGoodsReceived($room, $buyer);

            DB::commit();

            return [
                'success' => true,
                'message' => 'Receipt confirmed successfully',
                'data' => $message
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * GM completes transaction and releases funds
     */
    public function completeTransaction(Room $room, $notes = '')
    {
        try {
            DB::beginTransaction();

            RoomActivityLog::logActivity(
                $room->id,
                'transaction_completed',
                'GM',
                'gm',
                "Transaction completed. Funds released to seller. " . ($notes ? "Notes: {$notes}" : '')
            );

            $message = RoomMessage::createSystemMessage(
                $room->id,
                "🎊 Transaction completed successfully! Funds have been released to the seller. " . ($notes ? "Notes: {$notes}" : '')
            );

            // Update room status to completed
            $room->update(['status' => 'completed']);

            // Notify all parties
            $this->notifyTransactionCompleted($room);

            // Schedule room reset after 24 hours
            $this->scheduleRoomReset($room);

            DB::commit();

            return [
                'success' => true,
                'message' => 'Transaction completed successfully',
                'data' => $message
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Get transaction status for a room
     */
    public function getTransactionStatus(Room $room)
    {
        $latestActivities = RoomActivityLog::where('room_id', $room->id)
            ->whereIn('action', [
                'payment_proof_uploaded',
                'payment_verified',
                'payment_rejected',
                'shipping_receipt_uploaded',
                'goods_received',
                'transaction_completed'
            ])
            ->latest('timestamp')
            ->limit(5)
            ->get();

        $statusSteps = [
            'payment_proof_uploaded' => 'Payment proof uploaded',
            'payment_verified' => 'Payment verified',
            'shipping_receipt_uploaded' => 'Goods shipped',
            'goods_received' => 'Goods received',
            'transaction_completed' => 'Transaction completed'
        ];

        $currentStatus = $room->status;
        $completedSteps = [];
        $pendingSteps = [];

        foreach ($statusSteps as $stepKey => $stepLabel) {
            $hasActivity = $latestActivities->where('action', $stepKey)->isNotEmpty();
            if ($hasActivity) {
                $completedSteps[$stepKey] = [
                    'label' => $stepLabel,
                    'completed_at' => $latestActivities->where('action', $stepKey)->first()->timestamp,
                    'description' => $latestActivities->where('action', $stepKey)->first()->description
                ];
            } else {
                $pendingSteps[$stepKey] = $stepLabel;
            }
        }

        return [
            'current_status' => $currentStatus,
            'completed_steps' => $completedSteps,
            'pending_steps' => $pendingSteps,
            'progress_percentage' => $this->calculateProgressPercentage($completedSteps, count($statusSteps))
        ];
    }

    /**
     * Helper methods for notifications
     */
    private function notifyPaymentProofUploaded(Room $room, RoomUser $buyer)
    {
        // In real implementation, this would send notifications via Pusher, email, etc.
        // For now, we'll create system messages
        RoomMessage::createSystemMessage(
            $room->id,
            "📢 Seller: Please wait for GM to verify the payment proof from {$buyer->name}."
        );
    }

    private function notifyPaymentVerified(Room $room)
    {
        RoomMessage::createSystemMessage(
            $room->id,
            "📢 Seller: Payment has been verified! You can now ship the goods and upload the receipt."
        );
    }

    private function notifyPaymentRejected(Room $room)
    {
        RoomMessage::createSystemMessage(
            $room->id,
            "📢 Buyer: Payment was rejected. Please upload a valid payment proof."
        );
    }

    private function notifyShipped(Room $room, RoomUser $seller)
    {
        RoomMessage::createSystemMessage(
            $room->id,
            "📢 Buyer: Goods have been shipped by {$seller->name}. Please confirm receipt once received."
        );
    }

    private function notifyGoodsReceived(Room $room, RoomUser $buyer)
    {
        RoomMessage::createSystemMessage(
            $room->id,
            "📢 GM: {$buyer->name} has confirmed receipt of goods. Please complete the transaction."
        );
    }

    private function notifyTransactionCompleted(Room $room)
    {
        RoomMessage::createSystemMessage(
            $room->id,
            "🎊 Congratulations! The transaction has been completed successfully. Thank you for using our service!"
        );
    }

    private function scheduleRoomReset(Room $room)
    {
        // In real implementation, this would schedule a job to reset the room after 24 hours
        // For now, we'll just log the intention
        RoomActivityLog::logActivity(
            $room->id,
            'room_reset_scheduled',
            'System',
            'system',
            "Room scheduled for reset in 24 hours"
        );
    }

    private function calculateProgressPercentage($completedSteps, $totalSteps)
    {
        if ($totalSteps === 0) return 0;
        return round((count($completedSteps) / $totalSteps) * 100);
    }

    /**
     * Get transaction history for a room
     */
    public function getTransactionHistory(Room $room)
    {
        return RoomActivityLog::where('room_id', $room->id)
            ->whereIn('action', [
                'room_joined',
                'payment_proof_uploaded',
                'payment_verified',
                'payment_rejected',
                'shipping_receipt_uploaded',
                'goods_received',
                'transaction_completed',
                'gm_message_sent'
            ])
            ->with(['room'])
            ->orderBy('timestamp', 'desc')
            ->get();
    }

    /**
     * Create transaction summary report
     */
    public function generateTransactionSummary(Room $room)
    {
        $buyer = $room->buyer()->first();
        $seller = $room->seller()->first();
        $transactionStatus = $this->getTransactionStatus($room);
        $history = $this->getTransactionHistory($room);

        return [
            'room_number' => $room->room_number,
            'status' => $room->status,
            'buyer' => $buyer ? [
                'name' => $buyer->name,
                'phone' => $buyer->phone,
                'joined_at' => $buyer->joined_at,
            ] : null,
            'seller' => $seller ? [
                'name' => $seller->name,
                'phone' => $seller->phone,
                'joined_at' => $seller->joined_at,
            ] : null,
            'transaction_progress' => $transactionStatus,
            'timeline' => $history,
            'created_at' => $room->created_at,
            'updated_at' => $room->updated_at,
        ];
    }
}