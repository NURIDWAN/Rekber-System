<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GmUser;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\RoomActivityLog;
use App\Models\RoomMessage;
use App\Models\Transaction;
use App\Models\TransactionFile;
use App\Events\TransactionUpdated;
use App\Events\FileVerificationUpdated;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class GMController extends Controller
{
    // Constructor removed as middleware is handled in routes

    /**
     * GM Login
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $credentials = $request->only('email', 'password');

        if (!Auth::guard('gm')->attempt($credentials)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials',
            ], 401);
        }

        $gm = Auth::guard('gm')->user();

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'id' => $gm->id,
                'name' => $gm->name,
                'email' => $gm->email,
            ],
        ]);
    }

    /**
     * GM Dashboard - Get all rooms with details
     */
    public function dashboard(): JsonResponse
    {
        $rooms = Room::with([
            'buyer',
            'seller',
            'messages' => function ($query) {
                $query->latest()->limit(1);
            }
        ])
            ->get()
            ->map(function ($room) {
                return [
                    'id' => $room->id,
                    'room_number' => $room->room_number,
                    'status' => $room->status,
                    'buyer' => $room->buyer->first() ? [
                        'name' => $room->buyer->first()->name,
                        'phone' => $room->buyer->first()->phone,
                        'is_online' => $room->buyer->first()->is_online,
                        'joined_at' => $room->buyer->first()->joined_at,
                    ] : null,
                    'seller' => $room->seller->first() ? [
                        'name' => $room->seller->first()->name,
                        'phone' => $room->seller->first()->phone,
                        'is_online' => $room->seller->first()->is_online,
                        'joined_at' => $room->seller->first()->joined_at,
                    ] : null,
                    'last_message' => $room->messages->first(),
                    'activity_count' => $room->activityLogs()->count(),
                ];
            });

        $stats = [
            'total_rooms' => Room::count(),
            'free_rooms' => Room::where('status', 'free')->count(),
            'in_use_rooms' => Room::where('status', 'in_use')->count(),
            'active_users' => RoomUser::where('is_online', true)->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'rooms' => $rooms,
                'stats' => $stats,
            ],
        ]);
    }

    /**
     * Get specific room details for GM
     */
    public function roomDetails(Room $room): JsonResponse
    {
        $room->load([
            'buyer',
            'seller',
            'messages' => function ($query) {
                $query->ordered()->limit(100);
            },
            'activityLogs' => function ($query) {
                $query->recent(50);
            }
        ]);

        $roomData = [
            'id' => $room->id,
            'room_number' => $room->room_number,
            'status' => $room->status,
            'buyer' => $room->buyer->first(),
            'seller' => $room->seller->first(),
            'messages' => $room->messages->map(function ($message) {
                return [
                    'id' => $message->id,
                    'sender_role' => $message->sender_role,
                    'sender_name' => $message->sender_name,
                    'message' => $message->message,
                    'type' => $message->type,
                    'created_at' => $message->created_at,
                ];
            }),
            'activity_logs' => $room->activityLogs->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'user_name' => $log->user_name,
                    'role' => $log->role,
                    'description' => $log->description,
                    'timestamp' => $log->timestamp,
                ];
            }),
        ];

        return response()->json([
            'success' => true,
            'data' => $roomData,
        ]);
    }

    /**
     * Send GM message to room
     */
    public function sendMessage(Request $request, Room $room): JsonResponse
    {
        $request->validate([
            'message' => 'required|string|max:1000',
        ]);

        $gm = Auth::guard('gm')->user();

        $message = RoomMessage::create([
            'room_id' => $room->id,
            'sender_role' => 'gm',
            'sender_name' => $gm->name . ' (GM)',
            'message' => $request->message,
            'type' => 'system',
            'created_at' => now(),
        ]);

        RoomActivityLog::logActivity(
            $room->id,
            'gm_message_sent',
            $gm->name,
            'gm',
            'GM sent: ' . $request->message
        );

        return response()->json([
            'success' => true,
            'message' => 'GM message sent successfully',
            'data' => [
                'id' => $message->id,
                'sender_name' => $message->sender_name,
                'message' => $message->message,
                'created_at' => $message->created_at,
            ],
        ]);
    }

    /**
     * Reset room to free state
     */
    public function resetRoom(Request $request, Room $room): JsonResponse
    {
        $request->validate([
            'reason' => 'sometimes|string|max:500',
        ]);

        $gm = Auth::guard('gm')->user();
        $reason = $request->get('reason', 'Room reset by GM');

        try {
            DB::beginTransaction();

            RoomActivityLog::logActivity(
                $room->id,
                'room_reset',
                $gm->name,
                'gm',
                'Room reset: ' . $reason
            );

            RoomMessage::createSystemMessage(
                $room->id,
                'Room has been reset by GM. Reason: ' . $reason
            );

            RoomUser::where('room_id', $room->id)->delete();

            $room->update(['status' => 'free']);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Room reset successfully',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Room reset error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to reset room',
            ], 500);
        }
    }

    /**
     * Get room activity logs
     */
    public function getActivityLogs(Room $room, Request $request): JsonResponse
    {
        $request->validate([
            'limit' => 'sometimes|integer|min:1|max:200',
        ]);

        $limit = $request->get('limit', 50);

        $logs = $room->activityLogs()
            ->recent($limit)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'user_name' => $log->user_name,
                    'role' => $log->role,
                    'description' => $log->description,
                    'timestamp' => $log->timestamp,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }

    /**
     * Mark transaction as complete
     */
    public function markTransactionComplete(Request $request, Room $room): JsonResponse
    {
        $request->validate([
            'notes' => 'sometimes|string|max:500',
        ]);

        $gm = Auth::guard('gm')->user();
        $notes = $request->get('notes', 'Transaction completed by GM');

        if (!$room->isFull()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot complete transaction. Room is not full.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            RoomActivityLog::logActivity(
                $room->id,
                'transaction_completed',
                $gm->name,
                'gm',
                'Transaction marked as complete: ' . $notes
            );

            RoomMessage::createSystemMessage(
                $room->id,
                'Transaction has been completed successfully by GM! 🎉'
            );

            RoomMessage::create([
                'room_id' => $room->id,
                'sender_role' => 'gm',
                'sender_name' => $gm->name . ' (GM)',
                'message' => 'Transaction completed: ' . $notes,
                'type' => 'system',
                'created_at' => now(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Transaction marked as complete',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Transaction completion error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to complete transaction',
            ], 500);
        }
    }

    /**
     * GM Logout
     */
    public function logout(): JsonResponse
    {
        Auth::guard('gm')->logout();

        return response()->json([
            'success' => true,
            'message' => 'Logout successful',
        ]);
    }

    // MVP ESCROW SYSTEM METHODS

    /**
     * Get transactions requiring GM attention
     */
    public function getPendingTransactions(Request $request): JsonResponse
    {
        $gmUser = Auth::guard('gm')->user();

        // Fallback to current_room_user for backward compatibility
        if (!$gmUser) {
            $currentUser = $request->input('current_room_user');
            if ($currentUser && isset($currentUser->gm_user) && $currentUser->gm_user) {
                $gmUser = $currentUser->gm_user;
            }
        }

        if (!$gmUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized - GM access required',
            ], 403);
        }

        $status = $request->input('status', 'all');
        $limit = $request->input('limit', 20);

        try {
            $query = Transaction::with(['room', 'buyer', 'seller', 'files']);

            if ($status !== 'all') {
                $query->where('status', $status);
            } else {
                $query->requiringGMAttention();
            }

            $transactions = $query->orderBy('updated_at', 'desc')
                ->paginate($limit);

            return response()->json([
                'success' => true,
                'data' => $transactions,
            ]);

        } catch (\Exception $e) {
            \Log::error('Get pending transactions failed', [
                'status' => $status,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to get pending transactions',
            ], 500);
        }
    }

    /**
     * Get files pending verification
     */
    public function getPendingFiles(Request $request): JsonResponse
    {
        $gmUser = Auth::guard('gm')->user();

        // Fallback to current_room_user for backward compatibility
        if (!$gmUser) {
            $currentUser = $request->input('current_room_user');
            if ($currentUser && isset($currentUser->gm_user) && $currentUser->gm_user) {
                $gmUser = $currentUser->gm_user;
            }
        }

        if (!$gmUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized - GM access required',
            ], 403);
        }

        $fileType = $request->input('file_type', 'all');
        $limit = $request->input('limit', 20);

        try {
            $query = TransactionFile::with(['transaction.room', 'transaction.buyer', 'transaction.seller'])
                ->where('status', 'pending');

            if ($fileType !== 'all') {
                $query->where('file_type', $fileType);
            }

            $files = $query->orderBy('created_at', 'desc')
                ->paginate($limit);

            return response()->json([
                'success' => true,
                'data' => $files,
            ]);

        } catch (\Exception $e) {
            \Log::error('Get pending files failed', [
                'file_type' => $fileType,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to get pending files',
            ], 500);
        }
    }

    /**
     * Verify payment proof
     */
    public function verifyPaymentProof(Request $request, TransactionFile $file): JsonResponse
    {
        $gmUser = Auth::guard('gm')->user();

        if (!$gmUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized - GM access required',
            ], 403);
        }

        // Validate file is payment proof and pending
        if (!$file->isPaymentProof()) {
            \Log::warning('Payment verification attempted on non-payment proof file', [
                'file_id' => $file->id,
                'file_type' => $file->file_type,
                'status' => $file->status,
                'gm_user_id' => $gmUser->id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'This file is not a payment proof file. File type: ' . $file->file_type,
            ], 400);
        }

        if (!$file->isPending()) {
            \Log::warning('Payment verification attempted on non-pending file', [
                'file_id' => $file->id,
                'file_type' => $file->file_type,
                'status' => $file->status,
                'gm_user_id' => $gmUser->id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'This file has already been processed. Current status: ' . $file->status,
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'action' => 'required|in:approve,reject',
            'reason' => 'required_if:action,reject|string|max:1000',
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

            $transaction = $file->transaction;
            $action = $request->input('action');
            $gmUserId = $gmUser->id;

            if ($action === 'approve') {
                // Verify the file
                $file->markAsVerified($gmUserId);

                // Verify the payment
                $success = $transaction->verifyPayment($gmUserId);

                if ($success) {
                    // Create activity log
                    \App\Models\RoomActivityLog::create([
                        'room_id' => $transaction->room_id,
                        'action' => 'payment_verified',
                        'user_name' => $gmUser->name,
                        'role' => 'gm',
                        'description' => 'Payment proof verified by GM',
                        'timestamp' => now(),
                    ]);

                    DB::commit();

                    // Broadcast events
                    broadcast(new FileVerificationUpdated($file, 'approved'));
                    broadcast(new TransactionUpdated($transaction, 'payment_verified', [
                        'gm_name' => $gmUser->name,
                        'file_id' => $file->id,
                    ]));

                    return response()->json([
                        'success' => true,
                        'message' => 'Payment proof verified successfully',
                        'data' => [
                            'transaction' => [
                                'status' => $transaction->status,
                                'progress' => $transaction->getProgressPercentage(),
                                'current_action' => $transaction->getCurrentAction(),
                            ],
                            'file' => [
                                'status' => $file->status,
                                'verified_at' => $file->verified_at,
                            ],
                        ],
                    ]);
                } else {
                    throw new \Exception('Failed to verify payment');
                }
            } else {
                // Reject the file
                $reason = $request->input('reason');
                $file->markAsRejected($gmUserId, $reason);

                // Reject the payment
                $success = $transaction->rejectPayment($gmUserId, $reason);

                if ($success) {
                    // Create activity log
                    \App\Models\RoomActivityLog::create([
                        'room_id' => $transaction->room_id,
                        'action' => 'payment_rejected',
                        'user_name' => $gmUser->name,
                        'role' => 'gm',
                        'description' => 'Payment proof rejected: ' . $reason,
                        'timestamp' => now(),
                    ]);

                    DB::commit();

                    // Broadcast events
                    broadcast(new FileVerificationUpdated($file, 'rejected', $reason));
                    broadcast(new TransactionUpdated($transaction, 'payment_rejected', [
                        'gm_name' => $gmUser->name,
                        'file_id' => $file->id,
                        'rejection_reason' => $reason,
                    ]));

                    return response()->json([
                        'success' => true,
                        'message' => 'Payment proof rejected successfully',
                        'data' => [
                            'transaction' => [
                                'status' => $transaction->status,
                                'progress' => $transaction->getProgressPercentage(),
                                'current_action' => $transaction->getCurrentAction(),
                                'payment_rejection_reason' => $transaction->payment_rejection_reason,
                            ],
                            'file' => [
                                'status' => $file->status,
                                'verified_at' => $file->verified_at,
                                'rejection_reason' => $file->rejection_reason,
                            ],
                        ],
                    ]);
                } else {
                    throw new \Exception('Failed to reject payment');
                }
            }

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Payment proof verification failed', [
                'file_id' => $file->id,
                'action' => $action,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to process payment proof verification',
            ], 500);
        }
    }

    /**
     * Verify shipping receipt
     */
    public function verifyShippingReceipt(Request $request, TransactionFile $file): JsonResponse
    {
        $gmUser = Auth::guard('gm')->user();

        if (!$gmUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized - GM access required',
            ], 403);
        }

        // Validate file is shipping receipt and pending
        if (!$file->isShippingReceipt()) {
            \Log::warning('Shipping verification attempted on non-shipping receipt file', [
                'file_id' => $file->id,
                'file_type' => $file->file_type,
                'status' => $file->status,
                'gm_user_id' => $gmUser->id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'This file is not a shipping receipt file. File type: ' . $file->file_type,
            ], 400);
        }

        if (!$file->isPending()) {
            \Log::warning('Shipping verification attempted on non-pending file', [
                'file_id' => $file->id,
                'file_type' => $file->file_type,
                'status' => $file->status,
                'gm_user_id' => $gmUser->id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'This file has already been processed. Current status: ' . $file->status,
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'action' => 'required|in:approve,reject',
            'reason' => 'required_if:action,reject|string|max:1000',
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

            $transaction = $file->transaction;
            $action = $request->input('action');
            $gmUserId = $gmUser->id;

            if ($action === 'approve') {
                // Verify the file
                $file->markAsVerified($gmUserId);

                // Verify the shipping
                $success = $transaction->verifyShipping($gmUserId);

                if ($success) {
                    // Create activity log
                    \App\Models\RoomActivityLog::create([
                        'room_id' => $transaction->room_id,
                        'action' => 'shipping_verified',
                        'user_name' => $gmUser->name,
                        'role' => 'gm',
                        'description' => 'Shipping receipt verified by GM',
                        'timestamp' => now(),
                    ]);

                    DB::commit();

                    // Broadcast events
                    broadcast(new FileVerificationUpdated($file, 'approved'));
                    broadcast(new TransactionUpdated($transaction, 'shipping_verified', [
                        'gm_name' => $gmUser->name,
                        'file_id' => $file->id,
                    ]));

                    return response()->json([
                        'success' => true,
                        'message' => 'Shipping receipt verified successfully',
                        'data' => [
                            'transaction' => [
                                'status' => $transaction->status,
                                'progress' => $transaction->getProgressPercentage(),
                                'current_action' => $transaction->getCurrentAction(),
                            ],
                            'file' => [
                                'status' => $file->status,
                                'verified_at' => $file->verified_at,
                            ],
                        ],
                    ]);
                } else {
                    throw new \Exception('Failed to verify shipping');
                }
            } else {
                // Reject the file
                $reason = $request->input('reason');
                $file->markAsRejected($gmUserId, $reason);

                // Reject the shipping
                $success = $transaction->rejectShipping($gmUserId, $reason);

                if ($success) {
                    // Create activity log
                    \App\Models\RoomActivityLog::create([
                        'room_id' => $transaction->room_id,
                        'action' => 'shipping_rejected',
                        'user_name' => $gmUser->name,
                        'role' => 'gm',
                        'description' => 'Shipping receipt rejected: ' . $reason,
                        'timestamp' => now(),
                    ]);

                    DB::commit();

                    // Broadcast events
                    broadcast(new FileVerificationUpdated($file, 'rejected', $reason));
                    broadcast(new TransactionUpdated($transaction, 'shipping_rejected', [
                        'gm_name' => $gmUser->name,
                        'file_id' => $file->id,
                        'rejection_reason' => $reason,
                    ]));

                    return response()->json([
                        'success' => true,
                        'message' => 'Shipping receipt rejected successfully',
                        'data' => [
                            'transaction' => [
                                'status' => $transaction->status,
                                'progress' => $transaction->getProgressPercentage(),
                                'current_action' => $transaction->getCurrentAction(),
                                'shipping_rejection_reason' => $transaction->shipping_rejection_reason,
                            ],
                            'file' => [
                                'status' => $file->status,
                                'verified_at' => $file->verified_at,
                                'rejection_reason' => $file->rejection_reason,
                            ],
                        ],
                    ]);
                } else {
                    throw new \Exception('Failed to reject shipping');
                }
            }

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Shipping receipt verification failed', [
                'file_id' => $file->id,
                'action' => $action,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to process shipping receipt verification',
            ], 500);
        }
    }

    /**
     * Release funds to complete transaction
     */
    public function releaseFunds(Request $request, Transaction $transaction): JsonResponse
    {
        $gmUser = Auth::guard('gm')->user();

        if (!$gmUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized - GM access required',
            ], 403);
        }

        // Validate transaction is ready for fund release
        // Validate transaction is ready for fund release
        if (!in_array($transaction->status, ['delivered', 'goods_received'])) {
            return response()->json([
                'success' => false,
                'message' => 'Transaction is not ready for fund release',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'notes' => 'nullable|string|max:2000',
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

            $gmUserId = $gmUser->id;
            $notes = $request->input('notes', '');

            // Release funds
            $success = $transaction->releaseFunds($gmUserId);

            if ($success) {
                // Update GM notes if provided
                if ($notes) {
                    $transaction->update([
                        'gm_notes' => $transaction->gm_notes . "\n\n[Fund Release] " . $notes,
                    ]);
                }

                // Create activity log
                \App\Models\RoomActivityLog::create([
                    'room_id' => $transaction->room_id,
                    'action' => 'funds_released',
                    'user_name' => $gmUser->name,
                    'role' => 'gm',
                    'description' => 'Funds released and transaction completed',
                    'timestamp' => now(),
                ]);

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Funds released successfully - Transaction completed',
                    'data' => [
                        'transaction' => [
                            'status' => $transaction->status,
                            'progress' => $transaction->getProgressPercentage(),
                            'completed_at' => $transaction->completed_at,
                            'funds_released_at' => $transaction->funds_released_at,
                        ],
                        'room' => [
                            'status' => $transaction->room->status,
                        ],
                    ],
                ]);
            } else {
                throw new \Exception('Failed to release funds');
            }

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Fund release failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to release funds',
            ], 500);
        }
    }

    /**
     * Get transaction details for GM
     */
    public function getTransactionDetails(Transaction $transaction): JsonResponse
    {
        $gmUser = Auth::guard('gm')->user();

        if (!$gmUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized - GM access required',
            ], 403);
        }

        try {
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

        } catch (\Exception $e) {
            \Log::error('Get transaction details failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to get transaction details',
            ], 500);
        }
    }

    /**
     * Get file details for GM verification
     */
    public function getFileDetails(TransactionFile $file): JsonResponse
    {
        $gmUser = Auth::guard('gm')->user();

        if (!$gmUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized - GM access required',
            ], 403);
        }

        try {
            $file->load([
                'transaction.room',
                'transaction.buyer',
                'transaction.seller',
                'verifier'
            ]);

            return response()->json([
                'success' => true,
                'data' => $file,
            ]);

        } catch (\Exception $e) {
            \Log::error('Get file details failed', [
                'file_id' => $file->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to get file details',
            ], 500);
        }
    }

    /**
     * Update GM notes for transaction
     */
    public function updateNotes(Request $request, Transaction $transaction): JsonResponse
    {
        $gmUser = Auth::guard('gm')->user();

        if (!$gmUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized - GM access required',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'notes' => 'required|string|max:5000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $transaction->update([
                'gm_notes' => $request->input('notes'),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Notes updated successfully',
                'data' => [
                    'gm_notes' => $transaction->gm_notes,
                ],
            ]);

        } catch (\Exception $e) {
            \Log::error('Update notes failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update notes',
            ], 500);
        }
    }
}
