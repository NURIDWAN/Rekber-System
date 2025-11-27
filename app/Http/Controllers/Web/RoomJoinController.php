<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomUser;
use App\Services\RoomUrlService;
use App\Services\MultiSessionManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Illuminate\Http\JsonResponse;

class RoomJoinController extends Controller
{
    /**
     * Handle room enter with multi-session support.
     */
    public function enter($room)
    {
        $roomUrlService = app(RoomUrlService::class);
        $multiSessionManager = app(MultiSessionManager::class);
        $roomId = $room instanceof Room ? $room->id : $room;
        $encryptedRoomId = request('encrypted_room_id') ?: $roomUrlService->encryptRoomId($roomId);

        // Check if user has session (multi-session aware)
        $userIdentifier = $multiSessionManager->getUserIdentifierFromCookie();
        $roomUser = null;

        if ($userIdentifier) {
            $roomUser = RoomUser::where('room_id', $roomId)
                ->where('user_identifier', $userIdentifier)
                ->first();
        }

        if (!$roomUser) {
            $roles = ['buyer', 'seller'];
            foreach ($roles as $role) {
                $cookieName = $multiSessionManager->generateCookieName($roomId, $role, $userIdentifier);
                $sessionToken = request()->cookie($cookieName);

                if (!$sessionToken) {
                    $cookiePrefix = 'rekber_session_' . $roomId . '_' . $role . '_';
                    foreach (request()->cookie() as $name => $value) {
                        if (str_starts_with($name, $cookiePrefix) && $value) {
                            $sessionToken = $value;
                            break;
                        }
                    }
                }

                if (!$sessionToken) {
                    $sessionToken = request()->cookie('room_session_' . $roomId);
                }

                if ($sessionToken) {
                    $roomUser = RoomUser::where('room_id', $roomId)
                        ->where('session_token', $sessionToken)
                        ->first();
                }

                if ($roomUser) {
                    break;
                }
            }
        }

        if ($roomUser) {
            if ($roomUser->user_identifier && $roomUser->user_identifier !== $userIdentifier) {
                Cookie::queue('rekber_user_identifier', $roomUser->user_identifier, 60 * 24 * 30);
            } elseif (!$roomUser->user_identifier && $userIdentifier) {
                $roomUser->update(['user_identifier' => $userIdentifier]);
            }
        }

        if (!$roomUser) {
            return redirect()->route('rooms.join', ['room' => $encryptedRoomId]);
        }

        if (!$roomUser->is_online) {
            $roomUser->update(['is_online' => true, 'last_seen' => now()]);
        }

        return redirect()->route('rooms.show', ['room' => $encryptedRoomId]);
    }

    /**
     * Handle direct token access and redirect to token join page.
     */
    public function tokenRedirect($token)
    {
        $roomUrlService = app(RoomUrlService::class);
        $decrypted = $roomUrlService->decryptToken($token);

        if (!$decrypted) {
            return abort(404, 'Invalid or expired token');
        }

        $params = ['token' => $token];
        if (!empty($decrypted['pin'])) {
            $params['pin'] = $decrypted['pin'];
        }

        return redirect()->route('rooms.join.token', $params);
    }

    /**
     * Handle encrypted token join page.
     */
    public function tokenJoin(Request $request, $token)
    {
        $roomUrlService = app(RoomUrlService::class);
        $multiSessionManager = app(MultiSessionManager::class);
        $decrypted = $roomUrlService->decryptToken($token);

        if (!$decrypted) {
            return abort(404, 'Invalid or expired token');
        }

        if (!empty($decrypted['pin']) && $request->get('pin') !== $decrypted['pin']) {
            return abort(403, 'PIN required or invalid');
        }

        $room = Room::findOrFail($decrypted['room_id']);

        // Check if user already has a session for this room (multi-session aware)
        $userIdentifier = $multiSessionManager->getUserIdentifierFromCookie();
        $existingRoomUser = null;
        $sessionToken = null;

        if ($userIdentifier) {
            $existingRoomUser = RoomUser::where('room_id', $room->id)
                ->where('user_identifier', $userIdentifier)
                ->where('is_online', true)
                ->first();
        }

        // Fallback to namespaced cookies if identifier mismatch or missing
        if (!$existingRoomUser) {
            $cookieName = $multiSessionManager->generateCookieName($room->id, $decrypted['role'], $userIdentifier);
            $sessionToken = $request->cookie($cookieName);

            if (!$sessionToken) {
                // Try any namespaced session cookie for this room/role
                $cookiePrefix = 'rekber_session_' . $room->id . '_' . $decrypted['role'] . '_';
                foreach ($request->cookie() as $name => $value) {
                    if (str_starts_with($name, $cookiePrefix) && $value) {
                        $sessionToken = $value;
                        break;
                    }
                }
            }

            // Legacy fallback
            if (!$sessionToken) {
                $sessionToken = $request->cookie('room_session_' . $room->id);
            }

            if ($sessionToken) {
                $existingRoomUser = RoomUser::where('room_id', $room->id)
                    ->where('session_token', $sessionToken)
                    ->first();
            }
        }

        // Align identifier cookie with stored session identifier
        if ($existingRoomUser) {
            if ($existingRoomUser->user_identifier && $existingRoomUser->user_identifier !== $userIdentifier) {
                Cookie::queue('rekber_user_identifier', $existingRoomUser->user_identifier, 60 * 24 * 30);
            } elseif (!$existingRoomUser->user_identifier && $userIdentifier) {
                $existingRoomUser->update(['user_identifier' => $userIdentifier]);
            }
        }

        if ($existingRoomUser && !$existingRoomUser->is_online) {
            $existingRoomUser->update(['is_online' => true, 'last_seen' => now()]);
        }

        Log::info('Token join check', [
            'room_id' => $room->id,
            'role' => $decrypted['role'],
            'session_exists' => ($sessionToken || $existingRoomUser) ? 'yes' : 'no',
            'existing_user' => $existingRoomUser ? [
                'name' => $existingRoomUser->name,
                'role' => $existingRoomUser->role,
                'same_role' => $existingRoomUser->role === $decrypted['role']
            ] : 'no'
        ]);

        if ($existingRoomUser && $existingRoomUser->role === $decrypted['role']) {
            // User is already registered for this role, redirect to room
            $encryptedRoomId = $roomUrlService->encryptRoomId($room->id);
            return redirect()->route('rooms.show', ['room' => $encryptedRoomId]);
        }

        return Inertia::render('rooms/[id]/join', [
            'room' => [
                'id' => $room->id,
                'room_number' => $room->room_number,
                'status' => $room->status,
                'has_buyer' => $room->hasBuyer(),
                'has_seller' => $room->hasSeller(),
                'buyer_name' => $room->users()->where('role', 'buyer')->first()?->name,
                'seller_name' => $room->users()->where('role', 'seller')->first()?->name,
                'current_user_role' => $existingRoomUser?->role,
                'current_user_name' => $existingRoomUser?->name,
            ],
            'role' => $decrypted['role'],
            'share_links' => app(RoomUrlService::class)->generateShareableLinks($room->id),
            'token' => $token
        ]);
    }

    /**
     * Handle encrypted token enter - direct entry to room.
     */
    public function tokenEnter(Request $request, $token)
    {
        $roomUrlService = app(RoomUrlService::class);
        $multiSessionManager = app(MultiSessionManager::class);
        $decrypted = $roomUrlService->decryptToken($token);

        if (!$decrypted) {
            return abort(404, 'Invalid or expired token');
        }

        if (!empty($decrypted['pin']) && $request->get('pin') !== $decrypted['pin']) {
            return abort(403, 'PIN required or invalid');
        }

        $roomModel = Room::findOrFail($decrypted['room_id']);
        $roomId = $roomModel->id;

        // Check if user has session (multi-session aware)
        $userIdentifier = $multiSessionManager->getUserIdentifierFromCookie();
        $roomUser = null;
        $sessionToken = null;

        if ($userIdentifier) {
            $roomUser = RoomUser::where('room_id', $roomId)
                ->where('user_identifier', $userIdentifier)
                ->first();
        }

        if (!$roomUser) {
            $cookieName = $multiSessionManager->generateCookieName($roomId, $decrypted['role'], $userIdentifier);
            $sessionToken = $request->cookie($cookieName);

            if (!$sessionToken) {
                $cookiePrefix = 'rekber_session_' . $roomId . '_' . $decrypted['role'] . '_';
                foreach ($request->cookie() as $name => $value) {
                    if (str_starts_with($name, $cookiePrefix) && $value) {
                        $sessionToken = $value;
                        break;
                    }
                }
            }

            if (!$sessionToken) {
                $sessionToken = $request->cookie('room_session_' . $roomId);
            }

            if ($sessionToken) {
                $roomUser = RoomUser::where('room_id', $roomId)
                    ->where('session_token', $sessionToken)
                    ->first();
            }
        }

        if ($roomUser) {
            if ($roomUser->user_identifier && $roomUser->user_identifier !== $userIdentifier) {
                Cookie::queue('rekber_user_identifier', $roomUser->user_identifier, 60 * 24 * 30);
            } elseif (!$roomUser->user_identifier && $userIdentifier) {
                $roomUser->update(['user_identifier' => $userIdentifier]);
            }
        }

        if (!$roomUser) {
            return redirect()->route('rooms.join.token', ['token' => $token]);
        }

        if (!$roomUser->is_online) {
            $roomUser->update(['is_online' => true, 'last_seen' => now()]);
        }

        $encryptedRoomId = $roomUrlService->encryptRoomId($roomId);

        return redirect()->route('rooms.show', ['room' => $encryptedRoomId]);
    }

    /**
     * Get share links for a room.
     */
    public function shareLinks($room): JsonResponse
    {
        $roomModel = Room::findOrFail($room);
        $roomUrlService = app(RoomUrlService::class);

        $shareLinks = [];

        // Check what roles are needed
        if ($roomModel->isAvailableForBuyer()) {
            $shareLinks['buyer'] = [
                'join_url' => $roomUrlService->generateJoinUrl($roomModel->id, 'buyer'),
                'role' => 'buyer',
                'label' => 'Buyer Link',
                'description' => 'Share this link with someone who wants to buy'
            ];
        }

        if ($roomModel->isAvailableForSeller()) {
            $shareLinks['seller'] = [
                'join_url' => $roomUrlService->generateJoinUrl($roomModel->id, 'seller'),
                'role' => 'seller',
                'label' => 'Seller Link',
                'description' => 'Share this link with someone who wants to sell'
            ];
        }

        return response()->json([
            'success' => true,
            'room_id' => $roomModel->id,
            'room_number' => $roomModel->room_number,
            'status' => $roomModel->status,
            'has_buyer' => $roomModel->hasBuyer(),
            'has_seller' => $roomModel->hasSeller(),
            'is_full' => $roomModel->isFull(),
            'needs_buyer' => $roomModel->isAvailableForBuyer(),
            'needs_seller' => $roomModel->isAvailableForSeller(),
            'share_links' => $shareLinks,
            'token_expiry_minutes' => RoomUrlService::TOKEN_EXPIRY_MINUTES,
        ]);
    }
}
