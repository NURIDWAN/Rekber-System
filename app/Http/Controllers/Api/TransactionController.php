<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\TransactionFile;
use App\Models\RoomUser;
use App\Models\Room;
use App\Events\TransactionUpdated;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    /**
     * Get transaction by room ID
     */
    public function getByRoomId(Request $request, $roomId): JsonResponse
    {
        $transaction = Transaction::where('room_id', $roomId)->first();

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'message' => 'Transaction not found for this room',
            ], 404);
        }

        // Load necessary relationships
        $transaction->load([
            'room',
            'buyer',
            'seller',
            'files' => function ($query) {
                $query->with('verifier');
            },
            'paymentVerifier',
            'shippingVerifier',
            'fundsReleaser'
        ]);

        return response()->json([
            'success' => true,
            'data' => $transaction,
        ]);
    }

    /**
     * Get transaction details
     */
    public function show(Transaction $transaction): JsonResponse
    {
        $transaction->load([
            'room',
            'buyer',
            'seller',
            'files' => function ($query) {
                $query->with('verifier');
            },
            'paymentVerifier',
            'shippingVerifier',
            'fundsReleaser'
        ]);

        return response()->json([
            'success' => true,
            'data' => $transaction,
        ]);
    }

    /**
     * Upload payment proof
     */
    public function uploadPaymentProof(Request $request, Transaction $transaction): JsonResponse
    {
        // Validate user authorization
        if (!$this->canUserUpload($request, $transaction, 'buyer')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to upload payment proof',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|image|max:5120|mimes:jpeg,png,jpg,gif',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Upload file
            $file = $request->file('file');
            $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs("room-files/{$transaction->room_id}/payment_proof", $filename, 'public');

            // Create transaction file record
            $transactionFile = TransactionFile::create([
                'room_id' => $transaction->room_id,
                'transaction_id' => $transaction->id,
                'file_type' => 'payment_proof',
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
                'uploaded_by' => 'buyer',
                'status' => 'pending',
            ]);

            // Update transaction status
            $transaction->update([
                'status' => 'awaiting_payment_verification',
                'payment_proof_uploaded_at' => now(),
                'payment_proof_uploaded_by' => $transaction->buyer_id,
            ]);

            // Create activity log
            $buyer = $transaction->buyer;
            \App\Models\RoomActivityLog::create([
                'room_id' => $transaction->room_id,
                'action' => 'payment_proof_uploaded',
                'user_name' => $buyer->name ?? 'Buyer',
                'role' => 'buyer',
                'description' => 'Payment proof uploaded successfully',
                'timestamp' => now(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Payment proof uploaded successfully',
                'data' => [
                    'file' => [
                        'id' => $transactionFile->id,
                        'file_url' => Storage::url($path),
                        'file_name' => $transactionFile->file_name,
                        'file_size' => $transactionFile->file_size_formatted,
                        'mime_type' => $transactionFile->mime_type,
                    ],
                    'transaction' => [
                        'status' => $transaction->status,
                        'progress' => $transaction->getProgressPercentage(),
                    ],
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Payment proof upload failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to upload payment proof. Please try again.',
            ], 500);
        }
    }

    /**
     * Upload shipping receipt
     */
    public function uploadShippingReceipt(Request $request, Transaction $transaction): JsonResponse
    {
        // Validate user authorization
        if (!$this->canUserUpload($request, $transaction, 'seller')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to upload shipping receipt',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|image|max:5120|mimes:jpeg,png,jpg,gif',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Upload file
            $file = $request->file('file');
            $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs("room-files/{$transaction->room_id}/shipping_receipt", $filename, 'public');

            // Create transaction file record
            $transactionFile = TransactionFile::create([
                'room_id' => $transaction->room_id,
                'transaction_id' => $transaction->id,
                'file_type' => 'shipping_receipt',
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
                'uploaded_by' => 'seller',
                'status' => 'pending',
            ]);

            // Update transaction status
            $transaction->update([
                'status' => 'awaiting_shipping_verification',
                'shipping_receipt_uploaded_at' => now(),
                'shipping_receipt_uploaded_by' => $transaction->seller_id,
            ]);

            // Create activity log
            $seller = $transaction->seller;
            \App\Models\RoomActivityLog::create([
                'room_id' => $transaction->room_id,
                'action' => 'shipping_receipt_uploaded',
                'user_name' => $seller->name ?? 'Seller',
                'role' => 'seller',
                'description' => 'Shipping receipt uploaded successfully',
                'timestamp' => now(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Shipping receipt uploaded successfully',
                'data' => [
                    'file' => [
                        'id' => $transactionFile->id,
                        'file_url' => Storage::url($path),
                        'file_name' => $transactionFile->file_name,
                        'file_size' => $transactionFile->file_size_formatted,
                        'mime_type' => $transactionFile->mime_type,
                    ],
                    'transaction' => [
                        'status' => $transaction->status,
                        'progress' => $transaction->getProgressPercentage(),
                    ],
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Shipping receipt upload failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to upload shipping receipt. Please try again.',
            ], 500);
        }
    }

    /**
     * Mark as delivered (buyer action)
     */
    public function markAsDelivered(Request $request, Transaction $transaction): JsonResponse
    {
        // Validate user authorization
        if (!$this->canUserAction($request, $transaction, 'buyer')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to confirm delivery',
            ], 403);
        }

        try {
            $success = $transaction->markAsDelivered();

            if ($success) {
                // Create activity log
                $buyer = $transaction->buyer;
                \App\Models\RoomActivityLog::create([
                    'room_id' => $transaction->room_id,
                    'action' => 'delivery_confirmed',
                    'user_name' => $buyer->name ?? 'Buyer',
                    'role' => 'buyer',
                    'description' => 'Delivery confirmed by buyer',
                    'timestamp' => now(),
                ]);

                // Broadcast transaction update
                broadcast(new TransactionUpdated($transaction, 'delivery_confirmed', [
                    'user_name' => $buyer->name ?? 'Buyer',
                    'user_role' => 'buyer',
                ]));

                return response()->json([
                    'success' => true,
                    'message' => 'Delivery confirmed successfully',
                    'data' => [
                        'transaction' => [
                            'status' => $transaction->status,
                            'progress' => $transaction->getProgressPercentage(),
                        ],
                    ],
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to confirm delivery',
            ], 500);

        } catch (\Exception $e) {
            \Log::error('Delivery confirmation failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to confirm delivery. Please try again.',
            ], 500);
        }
    }

    /**
     * Create dispute
     */
    public function createDispute(Request $request, Transaction $transaction): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:1000',
            'description' => 'nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Validate user authorization
        $currentUser = request('current_room_user');
        if (!$currentUser || !$this->canUserAction($request, $transaction, $currentUser->role)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to create dispute',
            ], 403);
        }

        try {
            DB::beginTransaction();

            // Update transaction status
            $transaction->update([
                'status' => 'disputed',
                'disputed_at' => now(),
                'disputed_by' => $currentUser->id,
            ]);

            // Create activity log
            \App\Models\RoomActivityLog::create([
                'room_id' => $transaction->room_id,
                'action' => 'dispute_created',
                'user_name' => $currentUser->name,
                'role' => $currentUser->role,
                'description' => 'Dispute created: ' . $request->reason,
                'timestamp' => now(),
            ]);

            DB::commit();

            // Broadcast transaction update
            broadcast(new TransactionUpdated($transaction, 'dispute_created', [
                'user_name' => $currentUser->name,
                'user_role' => $currentUser->role,
                'reason' => $request->reason,
                'description' => $request->description,
            ]));

            return response()->json([
                'success' => true,
                'message' => 'Dispute created successfully',
                'data' => [
                    'transaction' => [
                        'status' => $transaction->status,
                        'disputed_at' => $transaction->disputed_at,
                    ],
                ],
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Dispute creation failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to create dispute. Please try again.',
            ], 500);
        }
    }

    /**
     * Get transaction files
     */
    public function getFiles(Transaction $transaction): JsonResponse
    {
        $files = $transaction->files()->with('verifier')->get();

        return response()->json([
            'success' => true,
            'data' => $files,
        ]);
    }

    /**
     * Delete file (only if pending)
     */
    public function deleteFile(Request $request, TransactionFile $file): JsonResponse
    {
        // Check if file belongs to transaction
        if ($file->transaction_id !== $transaction->id) {
            return response()->json([
                'success' => false,
                'message' => 'File not found in this transaction',
            ], 404);
        }

        // Check if file is pending (can only delete pending files)
        if ($file->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete verified file',
            ], 400);
        }

        // Check if user can delete (only uploader or GM)
        $currentUser = request('current_room_user');
        if (!$currentUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $canDelete = $file->uploaded_by === $currentUser->role ||
                     (isset($currentUser->gm_user) && $currentUser->gm_user);

        if (!$canDelete) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to delete this file',
            ], 403);
        }

        try {
            $success = $file->deleteWithFile();

            if ($success) {
                return response()->json([
                    'success' => true,
                    'message' => 'File deleted successfully',
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete file',
            ], 500);

        } catch (\Exception $e) {
            \Log::error('File deletion failed', [
                'file_id' => $file->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete file. Please try again.',
            ], 500);
        }
    }

    /**
     * Check if user can upload file
     */
    private function canUserUpload(Request $request, Transaction $transaction, string $requiredRole): bool
    {
        $currentUser = $request->input('current_room_user');

        if (!$currentUser) {
            return false;
        }

        // Check if user role matches
        if ($currentUser->role !== $requiredRole) {
            return false;
        }

        // Check if user belongs to transaction
        $userField = $requiredRole . '_id';
        if ($transaction->$userField !== $currentUser->id) {
            return false;
        }

        // Check if transaction status allows upload
        return match ($transaction->status) {
            'pending_payment' => $requiredRole === 'buyer',
            'paid' => $requiredRole === 'seller',
            default => false,
        };
    }

    /**
     * Check if user can perform action
     */
    private function canUserAction(Request $request, Transaction $transaction, string $userRole): bool
    {
        $currentUser = $request->input('current_room_user');

        if (!$currentUser) {
            return false;
        }

        // Check if user role matches
        if ($currentUser->role !== $userRole) {
            return false;
        }

        // Check if user belongs to transaction
        $userField = $userRole . '_id';
        if ($transaction->$userField !== $currentUser->id) {
            return false;
        }

        return $transaction->canBeEditedBy($userRole, $currentUser->id);
    }
}