<?php

namespace App\Services;

use App\Models\RoomUser;
use Illuminate\Support\Str;
use Carbon\Carbon;

class MultiSessionManager
{
    /**
     * Generate unique session identifier for user
     */
    public function generateUserIdentifier(): string
    {
        return 'user_' . Str::random(16) . '_' . now()->timestamp;
    }

    /**
     * Generate namespace-based cookie name
     */
    public function generateCookieName(int $roomId, string $role, ?string $userIdentifier = null): string
    {
        $userIdPart = $userIdentifier ? $this->extractUserIdFromIdentifier($userIdentifier) : 'anon';
        return "rekber_session_{$roomId}_{$role}_{$userIdPart}";
    }

    /**
     * Extract user ID from identifier
     */
    private function extractUserIdFromIdentifier(string $identifier): string
    {
        // Extract meaningful part from user identifier
        $parts = explode('_', $identifier);
        return isset($parts[1]) ? substr($parts[1], 0, 8) : 'anon';
    }

    /**
     * Generate session token with namespace
     */
    public function generateSessionToken(int $roomId, string $role, string $userIdentifier): string
    {
        $timestamp = now()->timestamp;
        $randomKey = Str::random(16);

        return hash('sha256', $roomId . $role . $userIdentifier . $timestamp . $randomKey . config('app.key'));
    }

    /**
     * Validate session token format
     */
    public function validateSessionToken(string $token): bool
    {
        return strlen($token) === 64 && ctype_xdigit($token);
    }

    /**
     * Get all active sessions for user
     */
    public function getUserSessions(string $userIdentifier): array
    {
        return RoomUser::where('user_identifier', $userIdentifier)
            ->where('is_online', true)
            ->with('room')
            ->get()
            ->map(function ($roomUser) {
                return [
                    'room_id' => $roomUser->room_id,
                    'room_number' => $roomUser->room->room_number,
                    'role' => $roomUser->role,
                    'name' => $roomUser->name,
                    'joined_at' => $roomUser->joined_at->toISOString(),
                    'last_seen' => $roomUser->last_seen->toISOString(),
                    'cookie_name' => $this->generateCookieName(
                        $roomUser->room_id,
                        $roomUser->role,
                        $roomUser->user_identifier
                    )
                ];
            })
            ->toArray();
    }

    /**
     * Check if user can join room with specific role
     */
    public function canJoinRoom(int $roomId, string $role, string $userIdentifier): array
    {
        $room = \App\Models\Room::with('users')->findOrFail($roomId);
        $existingUserSession = $room->users()
            ->where('user_identifier', $userIdentifier)
            ->first();

        $result = [
            'can_join' => false,
            'reason' => '',
            'suggested_action' => null,
            'existing_session' => $existingUserSession ? [
                'role' => $existingUserSession->role,
                'name' => $existingUserSession->name
            ] : null
        ];

        // Check if user already has a session in this room
        if ($existingUserSession) {
            if ($existingUserSession->role === $role) {
                $result['can_join'] = true;
                $result['reason'] = 'User already has session in this room';
                $result['suggested_action'] = 'reconnect';
            } else {
                // User wants to switch role - check if new role is available
                if ($this->isRoleAvailable($room, $role)) {
                    $result['can_join'] = true;
                    $result['reason'] = "Can switch from {$existingUserSession->role} to {$role}";
                    $result['suggested_action'] = 'switch_role';
                } else {
                    $result['reason'] = "Role {$role} is not available in this room";
                }
            }
        } else {
            // New user - check role availability
            if ($this->isRoleAvailable($room, $role)) {
                $result['can_join'] = true;
                $result['reason'] = "Role {$role} is available";
                $result['suggested_action'] = 'join';
            } else {
                $result['reason'] = "Role {$role} is not available in this room";
                // Suggest alternative role
                $alternativeRole = $this->suggestAlternativeRole($room, $role);
                if ($alternativeRole) {
                    $result['suggested_action'] = 'switch_role';
                    $result['alternative_role'] = $alternativeRole;
                }
            }
        }

        return $result;
    }

    /**
     * Check if role is available in room
     */
    private function isRoleAvailable(\App\Models\Room $room, string $role): bool
    {
        if ($role === 'buyer') {
            // Buyer can join if room is free OR no buyer exists (online or offline)
            return $room->status === 'free' || !$room->hasAnyBuyer();
        } elseif ($role === 'seller') {
            // Seller can join if room has a buyer (online or offline) but no seller (online or offline)
            return $room->hasAnyBuyer() && !$room->hasAnySeller();
        }

        return false;
    }

    /**
     * Suggest alternative role
     */
    private function suggestAlternativeRole(\App\Models\Room $room, string $requestedRole): ?string
    {
        if ($requestedRole === 'buyer' && $this->isRoleAvailable($room, 'seller')) {
            return 'seller';
        } elseif ($requestedRole === 'seller' && $this->isRoleAvailable($room, 'buyer')) {
            return 'buyer';
        }

        return null;
    }

    /**
     * Get user identifier from cookie
     */
    public function getUserIdentifierFromCookie(): ?string
    {
        // Try to get from dedicated cookie first
        $identifier = request()->cookie('rekber_user_identifier');

        if ($identifier) {
            return $identifier;
        }

        // Try to extract from existing room session cookies
        $cookies = request()->cookie();
        foreach ($cookies as $name => $value) {
            if (str_starts_with($name, 'rekber_session_') && $value) {
                // Find corresponding RoomUser and return user_identifier
                $parts = explode('_', $name);
                if (count($parts) >= 4) {
                    $roomId = $parts[2];
                    $role = $parts[3];

                    $roomUser = RoomUser::where('room_id', $roomId)
                        ->where('role', $role)
                        ->where('session_token', $value)
                        ->first();

                    if ($roomUser && $roomUser->user_identifier) {
                        return $roomUser->user_identifier;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Ensure user has an identifier, generating one if needed
     * Returns array with identifier and whether it's new
     */
    public function ensureUserIdentifier(\Illuminate\Http\Request $request): array
    {
        $identifier = $this->getUserIdentifierFromCookie();
        $isNew = false;

        if (!$identifier) {
            $identifier = $this->generateUserIdentifier();
            $isNew = true;
        }

        return [
            'identifier' => $identifier,
            'is_new' => $isNew
        ];
    }

    /**
     * Clean up expired sessions
     */
    public function cleanupExpiredSessions(): int
    {
        $expiredThreshold = Carbon::now()->subHours(2);

        return RoomUser::where('last_seen', '<', $expiredThreshold)
            ->where('is_online', true)
            ->update([
                'is_online' => false,
                'offline_at' => now()
            ]);
    }

    /**
     * Migrate legacy session tokens
     */
    public function migrateLegacySession(string $legacyToken): ?array
    {
        if (!$legacyToken || strlen($legacyToken) !== 32) {
            return null;
        }

        $roomUser = RoomUser::where('session_token', $legacyToken)->first();

        if (!$roomUser) {
            return null;
        }

        // Generate new user identifier and session token
        $userIdentifier = $this->generateUserIdentifier();
        $newSessionToken = $this->generateSessionToken(
            $roomUser->room_id,
            $roomUser->role,
            $userIdentifier
        );

        // Update RoomUser record
        $roomUser->update([
            'user_identifier' => $userIdentifier,
            'session_token' => $newSessionToken,
            'migrated_at' => now()
        ]);

        return [
            'user_identifier' => $userIdentifier,
            'session_token' => $newSessionToken,
            'cookie_name' => $this->generateCookieName(
                $roomUser->room_id,
                $roomUser->role,
                $userIdentifier
            ),
            'room_id' => $roomUser->room_id,
            'role' => $roomUser->role
        ];
    }

    /**
     * Get RoomUrlService instance
     */
    public function getRoomUrlService(): \App\Services\RoomUrlService
    {
        return app(\App\Services\RoomUrlService::class);
    }
}