<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\RoomActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RoomJoinController extends Controller
{
    /**
     * Join a room using a token
     */
    public function joinWithToken(Request $request, string $token): JsonResponse
    {
        try {
            // Get validated data from request
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'phone' => 'required|string|max:20',
                'pin' => 'nullable|string|max:10',
            ]);

            // Get room data from middleware (validated by ValidateRoomToken middleware)
            $roomId = $request->input('room_id_from_token');
            $role = $request->input('role_from_token');
            $tokenTimestamp = $request->input('token_timestamp');

            if (!$roomId || !$role) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid token data',
                ], 400);
            }

            // Find the room
            $room = Room::findOrFail($roomId);

            // Check if user already exists for this role in the room (check first)
            $existingUser = RoomUser::where('room_id', $roomId)
                ->where('role', $role)
                ->first();

            if ($existingUser) {
                return response()->json([
                    'success' => false,
                    'message' => 'This role is already taken in this room',
                ], 400);
            }

            // Check if room is available for the specified role
            if (!$this->isRoomAvailableForRole($room, $role)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Room is not available for this role',
                ], 400);
            }

            // Create the room user
            DB::beginTransaction();
            try {
                $sessionToken = Str::random(32);

                \Log::info('API: Creating room user', [
                    'room_id' => $roomId,
                    'name' => $validated['name'],
                    'role' => $role,
                    'session_token' => substr($sessionToken, 0, 8) . '...',
                    'cookie_name' => 'room_session_' . $roomId
                ]);

                $roomUser = RoomUser::create([
                    'room_id' => $roomId,
                    'name' => $validated['name'],
                    'phone' => $validated['phone'],
                    'role' => $role,
                    'session_token' => $sessionToken,
                    'joined_at' => now(),
                    'is_online' => true,
                    'last_seen' => now(),
                ]);

                // Log the activity
                RoomActivityLog::create([
                    'room_id' => $roomId,
                    'user_name' => $validated['name'],
                    'role' => $role,
                    'action' => 'joined_room',
                    'description' => "{$validated['name']} joined as {$role}",
                    'timestamp' => now(),
                ]);

                // Update room status if needed
                $this->updateRoomStatus($room);

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Successfully joined the room',
                    'data' => [
                        'room_id' => $roomId,
                        'role' => $role,
                        'session_token' => $sessionToken,
                        'user_name' => $validated['name'],
                    ]
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Room not found',
            ], 404);
        } catch (\Exception $e) {
            \Log::error('Room join error: ' . $e->getMessage(), [
                'token' => $token,
                'request' => $request->all(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while joining the room',
            ], 500);
        }
    }

    /**
     * Enter a room using a token (for users who have already joined)
     */
    public function enterWithToken(Request $request, string $token): JsonResponse
    {
        try {
            // Get room data from middleware
            $roomId = $request->input('room_id_from_token');
            $role = $request->input('role_from_token');

            if (!$roomId || !$role) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid token data',
                ], 400);
            }

            // Find the room
            $room = Room::findOrFail($roomId);

            // Find the room user
            $roomUser = RoomUser::where('room_id', $roomId)
                ->where('role', $role)
                ->first();

            if (!$roomUser) {
                return response()->json([
                    'success' => false,
                    'message' => 'You have not joined this room yet',
                ], 400);
            }

            // Update online status and last seen
            $roomUser->update([
                'is_online' => true,
                'last_seen' => now(),
            ]);

            // Log the activity
            RoomActivityLog::create([
                'room_id' => $roomId,
                'user_name' => $roomUser->name,
                'role' => $role,
                'action' => 'entered_room',
                'description' => "{$roomUser->name} entered the room",
                'timestamp' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Successfully entered the room',
                'data' => [
                    'room_id' => $roomId,
                    'room_number' => $room->room_number,
                    'role' => $role,
                    'user_name' => $roomUser->name,
                ]
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Room not found',
            ], 404);
        } catch (\Exception $e) {
            \Log::error('Room enter error: ' . $e->getMessage(), [
                'token' => $token,
                'request' => $request->all(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while entering the room',
            ], 500);
        }
    }

    /**
     * Check if a room is available for a specific role
     */
    private function isRoomAvailableForRole(Room $room, string $role): bool
    {
        switch ($role) {
            case 'buyer':
                return $room->status === 'free' || !$room->hasBuyer();
            case 'seller':
                return $room->status === 'in_use' && $room->hasBuyer() && !$room->hasSeller();
            default:
                return false;
        }
    }

    /**
     * Update room status based on current users
     */
    private function updateRoomStatus(Room $room): void
    {
        $hasBuyer = $room->hasBuyer();
        $hasSeller = $room->hasSeller();

        if ($hasBuyer && $hasSeller) {
            $room->status = 'in_use';
        } elseif ($hasBuyer) {
            $room->status = 'in_use';
        } else {
            $room->status = 'free';
        }

        $room->save();
    }
}