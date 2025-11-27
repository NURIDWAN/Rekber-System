<?php

namespace App\Http\Middleware;

use App\Services\MultiSessionManager;
use Closure;
use Illuminate\Http\Request;
use App\Models\RoomUser;
use App\Models\Room;
use Symfony\Component\HttpFoundation\Response;

class MultiSessionRoomAuth
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $roomParam = $request->route('room');
        $multiSessionManager = app(MultiSessionManager::class);

        if (!$roomParam) {
            return response()->json([
                'success' => false,
                'message' => 'Room ID is required',
            ], 400);
        }

        $roomId = null;
        $room = null;

        if ($roomParam instanceof Room) {
            $room = $roomParam;
            $roomId = $room->id;
        } else {
            $roomId = $roomParam;
            // Handle encrypted room ID
            if (is_string($roomId) && str_starts_with($roomId, 'rm_')) {
                $roomId = $multiSessionManager->getRoomUrlService()->decryptRoomId($roomId);
                if (!$roomId) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Invalid room ID',
                    ], 400);
                }
            }
            $room = Room::find($roomId);
        }

        if (!$room) {
            return response()->json([
                'success' => false,
                'message' => 'Room not found',
            ], 404);
        }

        // Get or create user identifier
        $userIdentifier = $multiSessionManager->getUserIdentifierFromCookie();
        if (!$userIdentifier) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to identify user',
            ], 400);
        }

        // Try to find active session with multiple fallback methods
        $result = $this->findRoomUserWithFallback($roomId, $userIdentifier, $request);
        $roomUser = $result['roomUser'];
        $cookiesToSet = $result['cookies'];

        if (!$roomUser) {
            \Log::info('No valid session found', [
                'room_id' => $roomId,
                'user_identifier' => $userIdentifier,
                'attempted_cookies' => $this->getAttemptedCookieNames($roomId),
                'all_cookies' => array_keys($request->cookie())
            ]);

            // Instead of returning JSON error, redirect to join page for web requests
            $roomUrlService = app(\App\Services\RoomUrlService::class);
            $encryptedRoomId = $roomUrlService->encryptRoomId($roomId);

            // Check if this is an AJAX request (but not Inertia)
            if (($request->ajax() && !$request->header('X-Inertia')) || $request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No active session found for this room',
                    'requires_join' => true,
                    'room_id' => $roomId,
                    'user_identifier' => $userIdentifier,
                    'join_url' => route('rooms.join', ['room' => $encryptedRoomId]),
                ], 401);
            }

            // For web requests, redirect to join page
            return redirect()->route('rooms.join', ['room' => $encryptedRoomId])
                ->with('message', 'Please join the room to continue');
        }

        // Update last seen and online status
        $roomUser->updateLastSeen();

        // Add session data to request
        $request->merge([
            'current_room_user' => $roomUser,
            'current_room' => $room,
            'user_identifier' => $userIdentifier,
        ]);

        // Log session validation success
        \Log::info('Session validated', [
            'room_id' => $roomId,
            'user_identifier' => $userIdentifier,
            'user_role' => $roomUser->role,
            'user_name' => $roomUser->name,
            'session_token' => substr($roomUser->session_token, 0, 8) . '...'
        ]);

        $response = $next($request);

        // Attach any new cookies (e.g. from migration)
        foreach ($cookiesToSet as $cookie) {
            if ($response instanceof Response) {
                $response->headers->setCookie($cookie);
            }
        }

        return $response;
    }

    /**
     * Find room user with multiple fallback methods
     * Returns array ['roomUser' => ?RoomUser, 'cookies' => array]
     */
    private function findRoomUserWithFallback(int $roomId, string $userIdentifier, Request $request): array
    {
        $multiSessionManager = app(MultiSessionManager::class);
        $cookiesToSet = [];

        // Method 1: Try user identifier based lookup (most reliable)
        $roomUser = RoomUser::where('room_id', $roomId)
            ->where('user_identifier', $userIdentifier)
            ->where('is_online', true)
            ->first();

        if ($roomUser && $this->validateSessionToken($roomUser->session_token, $request)) {
            return ['roomUser' => $roomUser, 'cookies' => []];
        }

        // Method 2: Try legacy cookie-based lookup
        $legacyToken = $request->cookie('room_session_token');
        if ($legacyToken) {
            $legacyRoomUser = RoomUser::where('room_id', $roomId)
                ->where('session_token', $legacyToken)
                ->first();

            if ($legacyRoomUser) {
                // Migrate to multi-session
                $migratedSession = $multiSessionManager->migrateLegacySession($legacyToken);
                if ($migratedSession) {
                    // Prepare new cookies
                    $cookiesToSet[] = cookie(
                        $migratedSession['cookie_name'],
                        $migratedSession['session_token'],
                        120 // 2 hours
                    );

                    $cookiesToSet[] = cookie(
                        'rekber_user_identifier',
                        $migratedSession['user_identifier'],
                        60 * 24 * 30 // 30 days
                    );

                    return ['roomUser' => RoomUser::find($legacyRoomUser->id), 'cookies' => $cookiesToSet];
                }
            }
        }

        // Method 3: Try all namespace-based cookies
        $possibleRoles = ['buyer', 'seller'];
        foreach ($possibleRoles as $role) {
            $cookieName = $multiSessionManager->generateCookieName($roomId, $role, $userIdentifier);
            $sessionToken = $this->getCookieValue($request, $cookieName);

            if ($sessionToken) {
                $roomUser = RoomUser::where('room_id', $roomId)
                    ->where('session_token', $sessionToken)
                    ->where('user_identifier', $userIdentifier)
                    ->first();

                if ($roomUser) {
                    // Update user_identifier if missing (migration)
                    if (!$roomUser->user_identifier) {
                        $roomUser->update(['user_identifier' => $userIdentifier]);
                    }
                    return ['roomUser' => $roomUser, 'cookies' => []];
                }
            }
        }

        // Method 4: Try old format cookies as last resort
        $oldCookieName = 'room_session_' . $roomId;
        $oldToken = $this->getCookieValue($request, $oldCookieName);

        if ($oldToken) {
            $roomUser = RoomUser::where('room_id', $roomId)
                ->where('session_token', $oldToken)
                ->first();

            if ($roomUser) {
                // Migrate to new format
                $roomUser->update(['user_identifier' => $userIdentifier]);

                // Set new format cookie
                $newCookieName = $multiSessionManager->generateCookieName($roomId, $roomUser->role, $userIdentifier);
                $cookiesToSet[] = cookie(
                    $newCookieName,
                    $oldToken,
                    120 // 2 hours
                );

                // Clear old cookie
                $cookiesToSet[] = cookie($oldCookieName, '', -1);

                return ['roomUser' => $roomUser, 'cookies' => $cookiesToSet];
            }
        }

        return ['roomUser' => null, 'cookies' => []];
    }

    /**
     * Validate session token format and existence
     */
    private function validateSessionToken(string $token, Request $request): bool
    {
        $multiSessionManager = app(MultiSessionManager::class);

        // Check token format
        if (!$multiSessionManager->validateSessionToken($token)) {
            return false;
        }

        // Additional validation can be added here
        return true;
    }

    /**
     * Get cookie value with multiple methods
     */
    private function getCookieValue(Request $request, string $cookieName): ?string
    {
        // Method 1: Laravel's cookie helper
        $value = $request->cookie($cookieName);
        if ($value) {
            return $value;
        }

        // Method 2: $_COOKIE superglobal
        if (isset($_COOKIE[$cookieName])) {
            return $_COOKIE[$cookieName];
        }

        // Method 3: Parse raw cookie header
        $cookieHeader = $request->header('cookie');
        if ($cookieHeader) {
            $cookies = explode(';', $cookieHeader);
            foreach ($cookies as $cookie) {
                $parts = explode('=', trim($cookie), 2);
                if (count($parts) === 2 && trim($parts[0]) === $cookieName) {
                    return trim($parts[1]);
                }
            }
        }

        return null;
    }

    /**
     * Get list of attempted cookie names for debugging
     */
    private function getAttemptedCookieNames(int $roomId): array
    {
        $multiSessionManager = app(MultiSessionManager::class);
        $userIdentifier = $multiSessionManager->getUserIdentifierFromCookie();

        $names = [];
        if ($userIdentifier) {
            $names[] = $multiSessionManager->generateCookieName($roomId, 'buyer', $userIdentifier);
            $names[] = $multiSessionManager->generateCookieName($roomId, 'seller', $userIdentifier);
        }
        $names[] = 'room_session_' . $roomId;
        $names[] = 'room_session_token';

        return $names;
    }
}