<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\RoomActivityLog;
use App\Services\MultiSessionManager;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RoomJoinController extends Controller
{
    /**
     * Join a room using a token with multi-session support and auto-switch role
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
            $requestedRole = $request->input('role_from_token');
            $tokenTimestamp = $request->input('token_timestamp');

            if (!$roomId || !$requestedRole) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid token data',
                ], 400);
            }

            // Find the room
            $room = Room::findOrFail($roomId);

            // Validate PIN if enabled
            if ($room->pin_enabled) {
                if (empty($validated['pin'])) {
                    return response()->json([
                        'success' => false,
                        'message' => 'PIN is required for this room',
                        'requires_pin' => true
                    ], 401);
                }

                if ($validated['pin'] !== $room->pin) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Invalid PIN',
                        'requires_pin' => true
                    ], 401);
                }
            }
            $multiSessionManager = app(MultiSessionManager::class);

            // Get or create user identifier
            $identifierResult = $multiSessionManager->ensureUserIdentifier($request);
            $userIdentifier = $identifierResult['identifier'];

            // Check if user can join room with auto-switch logic
            $joinCheck = $multiSessionManager->canJoinRoom($roomId, $requestedRole, $userIdentifier);

            \Log::info('Room join check', [
                'room_id' => $roomId,
                'requested_role' => $requestedRole,
                'user_identifier' => $userIdentifier,
                'can_join' => $joinCheck['can_join'],
                'reason' => $joinCheck['reason'],
                'suggested_action' => $joinCheck['suggested_action'],
                'existing_session' => $joinCheck['existing_session']
            ]);

            // Handle different scenarios based on join check
            if (!$joinCheck['can_join']) {
                // Auto-switch role if alternative is available
                if (isset($joinCheck['alternative_role'])) {
                    $suggestedRole = $joinCheck['alternative_role'];
                    return response()->json([
                        'success' => false,
                        'message' => "Role {$requestedRole} is not available. Would you like to join as {$suggestedRole} instead?",
                        'requires_role_switch' => true,
                        'suggested_role' => $suggestedRole,
                        'room_id' => $roomId,
                        'room_number' => $room->room_number,
                    ], 409); // 409 Conflict
                }

                return response()->json([
                    'success' => false,
                    'message' => $joinCheck['reason'],
                ], 400);
            }

            // Process the join/switch based on suggested action
            $roomUser = null;
            $actualRole = $requestedRole;
            $action = $joinCheck['suggested_action'];

            DB::beginTransaction();
            try {
                switch ($action) {
                    case 'reconnect':
                        // User already has session - just reactivate it
                        $roomUser = RoomUser::where('room_id', $roomId)
                            ->where('user_identifier', $userIdentifier)
                            ->where('role', $requestedRole)
                            ->first();

                        if ($roomUser) {
                            $roomUser->update([
                                'is_online' => true,
                                'last_seen' => now(),
                                'name' => $validated['name'],
                                'phone' => $validated['phone'],
                            ]);

                            // Log reconnection
                            RoomActivityLog::create([
                                'room_id' => $roomId,
                                'user_name' => $validated['name'],
                                'role' => $requestedRole,
                                'action' => 'reconnected',
                                'description' => "{$validated['name']} reconnected as {$requestedRole}",
                                'timestamp' => now(),
                            ]);
                        }
                        break;

                    case 'switch_role':
                        // User wants to switch roles in the same room
                        $existingSession = RoomUser::where('room_id', $roomId)
                            ->where('user_identifier', $userIdentifier)
                            ->where('is_online', true)
                            ->first();

                        if ($existingSession) {
                            $roomUser = $existingSession->switchRole($requestedRole);
                            $actualRole = $roomUser->role;

                            // Log role switch
                            RoomActivityLog::create([
                                'room_id' => $roomId,
                                'user_name' => $validated['name'],
                                'role' => $actualRole,
                                'action' => 'role_switch',
                                'description' => "{$validated['name']} switched from {$existingSession->role} to {$actualRole}",
                                'timestamp' => now(),
                            ]);
                        }
                        break;

                    case 'join':
                    default:
                        // New user joining
                        // Use ensureUserIdentifier to get consistent identifier
                        $identifierResult = $multiSessionManager->ensureUserIdentifier($request);
                        $userIdentifier = $identifierResult['identifier'];

                        $sessionToken = $multiSessionManager->generateSessionToken($roomId, $requestedRole, $userIdentifier);
                        $deviceFingerprint = RoomUser::generateDeviceFingerprint();

                        \Log::info('API: Creating room user', [
                            'room_id' => $roomId,
                            'name' => $validated['name'],
                            'role' => $requestedRole,
                            'user_identifier' => $userIdentifier,
                            'session_token' => substr($sessionToken, 0, 8) . '...',
                            'device_fingerprint' => substr($deviceFingerprint, 0, 8) . '...'
                        ]);

                        $roomUser = RoomUser::create([
                            'room_id' => $roomId,
                            'name' => $validated['name'],
                            'phone' => $validated['phone'],
                            'role' => $requestedRole,
                            'session_token' => $sessionToken,
                            'user_identifier' => $userIdentifier,
                            'device_fingerprint' => $deviceFingerprint,
                            'session_context' => [
                                'joined_via' => 'token',
                                'token_timestamp' => $tokenTimestamp,
                                'user_agent' => $request->userAgent(),
                                'ip_address' => $request->ip(),
                            ],
                            'joined_at' => now(),
                            'is_online' => true,
                            'last_seen' => now(),
                        ]);

                        // Log the activity
                        RoomActivityLog::create([
                            'room_id' => $roomId,
                            'user_name' => $validated['name'],
                            'role' => $requestedRole,
                            'action' => 'joined_room',
                            'description' => "{$validated['name']} joined as {$requestedRole}",
                            'timestamp' => now(),
                        ]);

                        $actualRole = $requestedRole;
                        break;
                }

                if (!$roomUser) {
                    throw new \Exception('Failed to create or retrieve room user session');
                }

                // Update room status if needed
                $this->updateRoomStatus($room);

                DB::commit();

                // Generate cookie name for response
                $cookieName = $multiSessionManager->generateCookieName($roomId, $actualRole, $userIdentifier);

                // Get user's other active sessions
                $otherSessions = $multiSessionManager->getUserSessions($userIdentifier);

                $response = response()->json([
                    'success' => true,
                    'message' => $this->getSuccessMessage($action, $actualRole),
                    'data' => [
                        'room_id' => $roomId,
                        'room_number' => $room->room_number,
                        'role' => $actualRole,
                        'session_token' => $roomUser->session_token,
                        'user_name' => $validated['name'],
                        'user_identifier' => $userIdentifier,
                        'cookie_name' => $cookieName,
                        'action_performed' => $action,
                        'other_active_sessions' => $otherSessions,
                    ]
                ]);

                // Attach session cookie
                $response->withCookie(cookie($cookieName, $roomUser->session_token, 120));

                // Attach user identifier cookie if needed
                // We always attach it to ensure it's refreshed/set
                $response->withCookie(cookie('rekber_user_identifier', $userIdentifier, 60 * 24 * 30));

                return $response;

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
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while joining the room',
            ], 500);
        }
    }

    /**
     * Get appropriate success message based on action performed
     */
    private function getSuccessMessage(string $action, string $role): string
    {
        return match ($action) {
            'reconnect' => "Successfully reconnected to the room as {$role}",
            'switch_role' => "Successfully switched to {$role} role in the room",
            'join' => "Successfully joined the room as {$role}",
            default => "Successfully joined the room as {$role}",
        };
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