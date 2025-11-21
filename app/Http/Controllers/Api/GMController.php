<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GmUser;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\RoomActivityLog;
use App\Models\RoomMessage;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class GMController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:gm')->except(['login']);
    }

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
        $rooms = Room::with(['buyer', 'seller', 'messages' => function ($query) {
                $query->latest()->limit(1);
            }])
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
}
