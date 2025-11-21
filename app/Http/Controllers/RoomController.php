<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomUser;
use App\Models\RoomMessage;
use App\Models\RoomActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class RoomController extends Controller
{
    /**
     * Get all rooms with their current status
     */
    public function index(): JsonResponse
    {
        $rooms = Room::with(['users' => function($query) {
            $query->select('id', 'room_id', 'name', 'role', 'is_online');
        }])
        ->orderBy('room_number')
        ->get()
        ->map(function ($room) {
            return [
                'id' => $room->id,
                'room_number' => $room->room_number,
                'status' => $room->status,
                'has_buyer' => $room->hasBuyer(),
                'has_seller' => $room->hasSeller(),
                'buyer_online' => $room->users()->where('role', 'buyer')->where('is_online', true)->exists(),
                'seller_online' => $room->users()->where('role', 'seller')->where('is_online', true)->exists(),
            ];
        });

        return response()->json([
            'rooms' => $rooms
        ]);
    }

    /**
     * Get room details by ID
     */
    public function show($roomId): JsonResponse
    {
        $room = Room::with(['users' => function($query) {
            $query->select('id', 'room_id', 'name', 'role', 'is_online', 'joined_at');
        }])
        ->findOrFail($roomId);

        return response()->json([
            'room' => [
                'id' => $room->id,
                'room_number' => $room->room_number,
                'status' => $room->status,
                'users' => $room->users,
                'has_buyer' => $room->hasBuyer(),
                'has_seller' => $room->hasSeller(),
                'is_full' => $room->isFull(),
                'is_available_for_buyer' => $room->isAvailableForBuyer(),
                'is_available_for_seller' => $room->isAvailableForSeller(),
            ]
        ]);
    }

    /**
     * Join a room as buyer (first person to join)
     */
    public function join(Request $request, $roomId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $room = Room::findOrFail($roomId);

        // Check if room is available for buyer
        if (!$room->isAvailableForBuyer()) {
            return response()->json([
                'error' => 'Room is not available for buyer'
            ], 403);
        }

        // Check if user is already in another room
        $existingSession = $request->cookie('room_session_token');
        if ($existingSession) {
            $existingUser = RoomUser::where('session_token', $existingSession)->first();
            if ($existingUser) {
                return response()->json([
                    'error' => 'You are already in another room'
                ], 403);
            }
        }

        // Create room user
        $sessionToken = Str::random(32);
        $roomUser = RoomUser::create([
            'room_id' => $room->id,
            'name' => $request->name,
            'phone' => $request->phone,
            'role' => 'buyer',
            'session_token' => $sessionToken,
            'joined_at' => now(),
            'is_online' => true,
            'last_seen' => now(),
        ]);

        // Update room status
        if ($room->status === 'free') {
            $room->status = 'in_use';
            $room->save();
        }

        // Log activity
        RoomActivityLog::create([
            'room_id' => $room->id,
            'action' => 'buyer_joined',
            'user_name' => $request->name,
            'role' => 'buyer',
            'description' => 'Buyer joined the room',
            'timestamp' => now(),
        ]);

        $cookie = cookie('room_session_token', $sessionToken, 120 * 60, '/', null, false, true, false, 'None');

        return response()->json([
            'success' => true,
            'message' => 'Successfully joined room as buyer',
            'user' => [
                'id' => $roomUser->id,
                'name' => $roomUser->name,
                'role' => $roomUser->role,
                'session_token' => $roomUser->session_token,
            ],
            'room' => [
                'id' => $room->id,
                'room_number' => $room->room_number,
                'status' => $room->status,
            ]
        ])->cookie($cookie);
    }

    /**
     * Enter a room as seller (second person to join)
     */
    public function enter(Request $request, $roomId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $room = Room::findOrFail($roomId);

        // Check if room is available for seller
        if (!$room->isAvailableForSeller()) {
            return response()->json([
                'error' => 'Room is not available for seller'
            ], 403);
        }

        // Check if user is already in another room
        $existingSession = $request->cookie('room_session_token');
        if ($existingSession) {
            $existingUser = RoomUser::where('session_token', $existingSession)->first();
            if ($existingUser) {
                return response()->json([
                    'error' => 'You are already in another room'
                ], 403);
            }
        }

        // Create room user
        $sessionToken = Str::random(32);
        $roomUser = RoomUser::create([
            'room_id' => $room->id,
            'name' => $request->name,
            'phone' => $request->phone,
            'role' => 'seller',
            'session_token' => $sessionToken,
            'joined_at' => now(),
            'is_online' => true,
            'last_seen' => now(),
        ]);

        // Log activity
        RoomActivityLog::create([
            'room_id' => $room->id,
            'action' => 'seller_joined',
            'user_name' => $request->name,
            'role' => 'seller',
            'description' => 'Seller joined the room',
            'timestamp' => now(),
        ]);

        $cookie = cookie('room_session_token', $sessionToken, 120 * 60, '/', null, false, true, false, 'None');

        return response()->json([
            'success' => true,
            'message' => 'Successfully entered room as seller',
            'user' => [
                'id' => $roomUser->id,
                'name' => $roomUser->name,
                'role' => $roomUser->role,
                'session_token' => $roomUser->session_token,
            ],
            'room' => [
                'id' => $room->id,
                'room_number' => $room->room_number,
                'status' => $room->status,
            ]
        ])->cookie($cookie);
    }

    /**
     * Get messages for a room
     */
    public function messages($roomId): JsonResponse
    {
        $room = Room::findOrFail($roomId);

        $messages = RoomMessage::where('room_id', $roomId)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($message) {
                return [
                    'id' => $message->id,
                    'sender_role' => $message->sender_role,
                    'sender_name' => $message->sender_name,
                    'message' => $message->message,
                    'type' => $message->type,
                    'created_at' => $message->created_at->toISOString(),
                ];
            });

        return response()->json([
            'messages' => $messages
        ]);
    }

    /**
     * Send a message to a room
     */
    public function sendMessage(Request $request, $roomId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'message' => 'required|string|max:2000',
            'type' => ['required', Rule::in(['text', 'image'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Validate room session
        $sessionToken = $request->cookie('room_session_token');
        if (!$sessionToken) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $roomUser = RoomUser::where('room_id', $roomId)
            ->where('session_token', $sessionToken)
            ->first();

        if (!$roomUser) {
            return response()->json(['error' => 'Unauthorized for this room'], 403);
        }

        $room = Room::findOrFail($roomId);

        // Create message
        $message = RoomMessage::create([
            'room_id' => $roomId,
            'sender_role' => $roomUser->role,
            'sender_name' => $roomUser->name,
            'message' => $request->message,
            'type' => $request->type,
        ]);

        // Log activity
        RoomActivityLog::create([
            'room_id' => $room->id,
            'action' => 'message_sent',
            'user_name' => $roomUser->name,
            'role' => $roomUser->role,
            'description' => 'Sent a ' . $request->type . ' message',
            'timestamp' => now(),
        ]);

        // Broadcast message (will be implemented with Pusher)
        broadcast(new \App\Events\RoomMessageSent($message))->toOthers();

        return response()->json([
            'success' => true,
            'message' => [
                'id' => $message->id,
                'sender_role' => $message->sender_role,
                'sender_name' => $message->sender_name,
                'message' => $message->message,
                'type' => $message->type,
                'created_at' => $message->created_at->toISOString(),
            ]
        ]);
    }

    /**
     * Upload file (payment proof or shipping receipt)
     */
    public function uploadFile(Request $request, $roomId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|image|max:5120', // 5MB max
            'file_type' => ['required', Rule::in(['payment_proof', 'shipping_receipt'])],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Validate room session
        $sessionToken = $request->cookie('room_session_token');
        if (!$sessionToken) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $roomUser = RoomUser::where('room_id', $roomId)
            ->where('session_token', $sessionToken)
            ->first();

        if (!$roomUser) {
            return response()->json(['error' => 'Unauthorized for this room'], 403);
        }

        $room = Room::findOrFail($roomId);

        // Upload file
        $file = $request->file('file');
        $filename = time() . '_' . Str::random(10) . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('room-files/' . $roomId, $filename, 'public');

        // Create system message about file upload
        $message = RoomMessage::create([
            'room_id' => $roomId,
            'sender_role' => 'system',
            'sender_name' => 'System',
            'message' => $path,
            'type' => 'image',
        ]);

        // Log activity
        $action = $request->file_type === 'payment_proof' ? 'payment_proof_uploaded' : 'shipping_receipt_uploaded';
        $description = $request->file_type === 'payment_proof' ?
            'Uploaded payment proof' : 'Uploaded shipping receipt';

        RoomActivityLog::create([
            'room_id' => $room->id,
            'action' => $action,
            'user_name' => $roomUser->name,
            'role' => $roomUser->role,
            'description' => $description,
            'timestamp' => now(),
        ]);

        // Broadcast file upload
        broadcast(new \App\Events\RoomMessageSent($message))->toOthers();

        return response()->json([
            'success' => true,
            'file_url' => Storage::url($path),
            'message' => $description . ' uploaded successfully',
        ]);
    }

    /**
     * Get room activity logs
     */
    public function activityLogs($roomId): JsonResponse
    {
        $room = Room::findOrFail($roomId);

        $logs = RoomActivityLog::where('room_id', $roomId)
            ->orderBy('timestamp', 'desc')
            ->limit(50)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'user_name' => $log->user_name,
                    'role' => $log->role,
                    'description' => $log->description,
                    'timestamp' => $log->timestamp->toISOString(),
                ];
            });

        return response()->json([
            'logs' => $logs
        ]);
    }

    /**
     * Update user online status
     */
    public function updateOnlineStatus(Request $request, $roomId): JsonResponse
    {
        $sessionToken = $request->cookie('room_session_token');
        if (!$sessionToken) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $roomUser = RoomUser::where('room_id', $roomId)
            ->where('session_token', $sessionToken)
            ->first();

        if (!$roomUser) {
            return response()->json(['error' => 'Unauthorized for this room'], 403);
        }

        $roomUser->update([
            'is_online' => $request->boolean('online', true),
            'last_seen' => now(),
        ]);

        // Broadcast status change
        broadcast(new \App\Events\RoomUserStatusChanged($roomUser))->toOthers();

        return response()->json([
            'success' => true,
            'online_status' => $roomUser->is_online,
        ]);
    }

    /**
     * Leave room
     */
    public function leave(Request $request, $roomId): JsonResponse
    {
        $sessionToken = $request->cookie('room_session_token');
        if (!$sessionToken) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $roomUser = RoomUser::where('room_id', $roomId)
            ->where('session_token', $sessionToken)
            ->first();

        if (!$roomUser) {
            return response()->json(['error' => 'Unauthorized for this room'], 403);
        }

        $room = Room::findOrFail($roomId);

        // Log activity
        RoomActivityLog::create([
            'room_id' => $room->id,
            'action' => 'user_left',
            'user_name' => $roomUser->name,
            'role' => $roomUser->role,
            'description' => $roomUser->role . ' left the room',
            'timestamp' => now(),
        ]);

        // Delete room user
        $roomUser->delete();

        // Check if room is now empty and reset status
        if ($room->users()->count() === 0) {
            $room->status = 'free';
            $room->save();
        }

        // Clear session cookie
        $cookie = cookie('room_session_token', '', -1, '/');

        return response()->json([
            'success' => true,
            'message' => 'Successfully left the room'
        ])->cookie($cookie);
    }
}