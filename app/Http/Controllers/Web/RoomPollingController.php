<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\Transaction;
use App\Models\TransactionFile;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class RoomPollingController extends Controller
{
    /**
     * Get polling data for room transactions.
     */
    public function pollingData(Request $request, Room $room): JsonResponse
    {
        $transaction = Transaction::where('room_id', $room->id)->first();

        $transactions = [];
        if ($transaction) {
            // Format matches what the frontend expects
            $transactions[] = [
                'id' => $transaction->id,
                'transaction_number' => $transaction->transaction_number,
                'status' => $transaction->status,
                'amount' => $transaction->amount,
                'currency' => $transaction->currency,
                'room_id' => $transaction->room_id,
                'room_number' => $room->room_number,
                'room_status' => $room->status,
                'buyer_name' => $room->buyer()->first()?->name,
                'progress' => $transaction->getProgressPercentage(),
                'current_action' => $transaction->getCurrentAction(),
            ];
        }

        $files = [];
        if ($transaction) {
            $transactionFiles = TransactionFile::where('transaction_id', $transaction->id)->get();
            foreach ($transactionFiles as $file) {
                $files[] = [
                    'id' => $file->id,
                    'file_type' => $file->file_type,
                    'file_name' => $file->file_name,
                    'status' => $file->status,
                    'verified_at' => $file->verified_at,
                    'rejection_reason' => $file->rejection_reason,
                    'uploaded_by' => $file->uploaded_by,
                    'file_url' => Storage::url($file->file_path),
                    'transaction_id' => $transaction->id,
                    'transaction_number' => $transaction->transaction_number,
                    'transaction_status' => $transaction->status,
                    'transaction_progress' => $transaction->getProgressPercentage(),
                    'transaction_current_action' => $transaction->getCurrentAction(),
                    'room_id' => $room->id,
                    'room_number' => $room->room_number,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'transactions' => $transactions,
                'files' => $files,
            ],
        ]);
    }
}