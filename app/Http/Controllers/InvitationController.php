<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomInvitation;
use App\Models\User;
use App\Services\RoomUrlService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class InvitationController extends Controller
{
    protected RoomUrlService $roomUrlService;

    public function __construct(RoomUrlService $roomUrlService)
    {
        $this->roomUrlService = $roomUrlService;
        $this->middleware('auth')->except(['showInvitation', 'verifyPin', 'joinRoom']);
    }

    /**
     * Create a new room invitation
     */
    public function create(Request $request, Room $room): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'role' => ['required', Rule::in(['buyer', 'seller'])],
            'hours_valid' => 'integer|min:1|max:168' // Max 7 days
        ]);

        // For now, allow any authenticated user to create invitations
        // TODO: Add proper room ownership/permission checks

        $invitation = $this->roomUrlService->createInvitation(
            $room,
            Auth::user(),
            $request->email,
            $request->role,
            $request->hours_valid ?? 24
        );

        $invitationPackage = $this->roomUrlService->generateInvitationPackage($invitation);

        Log::info('Room invitation created', [
            'room_id' => $room->id,
            'invitation_id' => $invitation->id,
            'inviter_id' => Auth::id(),
            'invitee_email' => $request->email,
            'role' => $request->role,
            'ip' => $request->ip()
        ]);

        return response()->json([
            'invitation' => $invitationPackage,
            'message' => 'Invitation created successfully'
        ]);
    }

    /**
     * List invitations for a room
     */
    public function index(Request $request, Room $room): JsonResponse
    {
        // For now, allow any authenticated user to manage invitations
        // TODO: Add proper room ownership/permission checks

        $invitations = $room->invitations()
            ->with(['inviter', 'invitee'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($invitation) {
                return [
                    'id' => $invitation->id,
                    'email' => $invitation->email,
                    'role' => $invitation->role,
                    'status' => $invitation->isAccepted() ? 'accepted' : ($invitation->isExpired() ? 'expired' : 'pending'),
                    'expires_at' => $invitation->expires_at,
                    'accepted_at' => $invitation->accepted_at,
                    'joined_at' => $invitation->joined_at,
                    'pin_attempts' => $invitation->pin_attempts,
                    'is_pin_locked' => $invitation->isPinLocked(),
                    'inviter' => $invitation->inviter->name,
                    'invitee' => $invitation->invitee?->name
                ];
            });

        return response()->json(['invitations' => $invitations]);
    }

    /**
     * Show invitation join page
     */
    public function showInvitation(string $token)
    {
        $invitation = $this->roomUrlService->findInvitationByToken($token);

        if (!$invitation) {
            abort(404, 'Invitation not found or expired');
        }

        if ($invitation->isExpired()) {
            return inertia('rooms/invitation-expired', [
                'token' => $token,
                'invitation' => [
                    'id' => $invitation->id,
                    'email' => $invitation->email,
                    'role' => $invitation->role,
                    'room_name' => $invitation->room->name ?? "Room #{$invitation->room->room_number}",
                    'expires_at' => $invitation->expires_at->toISOString(),
                    'inviter' => $invitation->inviter->name
                ]
            ]);
        }

        if ($invitation->isAccepted() && $invitation->isJoined()) {
            return redirect()->route('rooms.show', ['room' => $invitation->room_id])
                ->with('info', 'You have already joined this room');
        }

        return inertia('rooms/invitation', [
            'invitation' => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'role' => $invitation->role,
                'room_name' => $invitation->room->name ?? "Room #{$invitation->room->room_number}",
                'expires_at' => $invitation->expires_at->toISOString(),
                'inviter' => $invitation->inviter->name
            ],
            'room' => [
                'id' => $invitation->room->id,
                'name' => $invitation->room->name ?? "Room #{$invitation->room->room_number}",
                'room_number' => $invitation->room->room_number,
                'owner' => [
                    'name' => $invitation->room->owner ? $invitation->room->owner->name : 'System'
                ]
            ],
            'token' => $token,
            'requires_pin' => true,
            'auth' => auth()->check() ? [
                'user' => [
                    'id' => auth()->id(),
                    'email' => auth()->user()->email,
                    'name' => auth()->user()->name
                ]
            ] : null
        ]);
    }

    /**
     * Verify PIN for invitation
     */
    public function verifyPin(Request $request, string $token): JsonResponse
    {
        $request->validate([
            'pin' => 'required|string|size:6'
        ]);

        $invitation = $this->roomUrlService->findInvitationByToken($token);

        if (!$invitation) {
            return response()->json(['error' => 'Invalid invitation'], 404);
        }

        if ($invitation->isExpired()) {
            return response()->json(['error' => 'Invitation has expired'], 410);
        }

        if (!$invitation->canAttemptPin()) {
            $lockedUntil = $invitation->pin_locked_until;
            return response()->json([
                'error' => 'Too many failed attempts. Please try again later.',
                'locked_until' => $lockedUntil,
                'attempts_remaining' => 0
            ], 429);
        }

        $isValid = $this->roomUrlService->verifyPin($invitation, $request->pin);

        if ($isValid) {
            Log::info('PIN verified successfully', [
                'invitation_id' => $invitation->id,
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'PIN verified successfully',
                'attempts_remaining' => 5
            ]);
        }

        $attemptsRemaining = max(0, 5 - $invitation->pin_attempts);

        Log::warning('Failed PIN attempt', [
            'invitation_id' => $invitation->id,
            'attempts' => $invitation->pin_attempts,
            'ip' => $request->ip()
        ]);

        return response()->json([
            'error' => 'Invalid PIN',
            'attempts_remaining' => $attemptsRemaining
        ], 401);
    }

    /**
     * Join room after PIN verification
     */
    public function joinRoom(Request $request, string $token)
    {
        $invitation = $this->roomUrlService->findInvitationByToken($token);

        if (!$invitation) {
            abort(404, 'Invitation not found or expired');
        }

        if (!Auth::check()) {
            return redirect()->route('login')
                ->with('intended', route('rooms.invite.join', ['token' => $token]))
                ->with('info', 'Please login to join the room');
        }

        if (Auth::user()->email !== $invitation->email) {
            abort(403, 'This invitation is not for your email address');
        }

        if ($invitation->isExpired()) {
            abort(410, 'Invitation has expired');
        }

        if ($invitation->isJoined()) {
            return redirect()->route('rooms.show', ['room' => $invitation->room_id])
                ->with('info', 'You have already joined this room');
        }

        // Validate session if already set
        if ($invitation->session_id && !$this->roomUrlService->validateSession($invitation)) {
            abort(403, 'Session validation failed');
        }

        // Check if user is already in room with different role
        $existingMembership = $invitation->room->users()->where('user_id', Auth::id())->first();
        if ($existingMembership && $existingMembership->role !== $invitation->role) {
            abort(403, 'You are already a member of this room with a different role');
        }

        // Add user to room
        $invitation->room->users()->syncWithoutDetaching([
            Auth::id() => [
                'role' => $invitation->role,
                'joined_at' => now(),
                'invitation_token' => $token
            ]
        ]);

        // Accept invitation
        $invitation->accept(
            Auth::user(),
            Session::getId(),
            $request->ip(),
            $request->userAgent()
        );

        $invitation->markAsJoined();

        Log::info('User joined room via invitation', [
            'room_id' => $invitation->room_id,
            'invitation_id' => $invitation->id,
            'user_id' => Auth::id(),
            'role' => $invitation->role,
            'ip' => $request->ip()
        ]);

        return redirect()->route('rooms.show', ['room' => $invitation->room_id])
            ->with('success', "You have joined the room as a {$invitation->role}");
    }

    /**
     * Revoke an invitation
     */
    public function revoke(Request $request, Room $room, RoomInvitation $invitation): JsonResponse
    {
        if ($room->id !== $invitation->room_id) {
            return response()->json(['error' => 'Invitation does not belong to this room'], 404);
        }

        // For now, allow any authenticated user to manage invitations
        // TODO: Add proper room ownership/permission checks

        $invitation->update(['is_active' => false]);

        Log::info('Invitation revoked', [
            'room_id' => $room->id,
            'invitation_id' => $invitation->id,
            'revoker_id' => Auth::id()
        ]);

        return response()->json(['message' => 'Invitation revoked successfully']);
    }

    /**
     * Delete an invitation permanently
     */
    public function destroy(Request $request, Room $room, RoomInvitation $invitation): JsonResponse
    {
        if ($room->id !== $invitation->room_id) {
            return response()->json(['error' => 'Invitation does not belong to this room'], 404);
        }

        // For now, allow any authenticated user to delete invitations
        // TODO: Add proper room ownership/permission checks

        $invitation->delete();

        Log::info('Invitation deleted', [
            'room_id' => $room->id,
            'invitation_id' => $invitation->id,
            'deleter_id' => Auth::id()
        ]);

        return response()->json(['message' => 'Invitation deleted successfully']);
    }
}
