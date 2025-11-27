<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\Invitation;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;

class InvitationController extends Controller
{
    /**
     * Display expired invitation page.
     */
    public function expired($token)
    {
        return inertia('rooms/invitation-expired', ['token' => $token]);
    }

    /**
     * Display room invitations management page.
     */
    public function index($room)
    {
        $roomModel = Room::findOrFail($room);
        $invitations = $roomModel->invitations()
            ->with(['inviter', 'invitee'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($invitation) {
                return [
                    'id' => $invitation->id,
                    'email' => $invitation->email,
                    'role' => $invitation->role,
                    'status' => $invitation->isAccepted() ? 'accepted' : ($invitation->isExpired() ? 'expired' : 'pending'),
                    'expires_at' => $invitation->expires_at->toISOString(),
                    'accepted_at' => $invitation->accepted_at?->toISOString(),
                    'joined_at' => $invitation->joined_at?->toISOString(),
                    'pin_attempts' => $invitation->pin_attempts,
                    'is_pin_locked' => $invitation->isPinLocked(),
                    'inviter' => $invitation->inviter->name,
                    'invitee' => $invitation->invitee?->name,
                    'can_revoke' => !$invitation->isAccepted() && !$invitation->isExpired(),
                    'can_resend' => $invitation->isExpired() && !$invitation->isAccepted(),
                ];
            });

        $availableRoles = [];
        if (!$roomModel->hasBuyer()) {
            $availableRoles[] = 'buyer';
        }
        if (!$roomModel->hasSeller()) {
            $availableRoles[] = 'seller';
        }

        return inertia('rooms/invitations', [
            'room' => [
                'id' => $roomModel->id,
                'name' => "Room #{$roomModel->room_number}",
                'room_number' => $roomModel->room_number,
                'status' => $roomModel->status,
                'has_buyer' => $roomModel->hasBuyer(),
                'has_seller' => $roomModel->hasSeller(),
                'is_full' => $roomModel->isFull(),
            ],
            'invitations' => $invitations,
            'availableRoles' => $availableRoles,
            'can_create_invitations' => count($availableRoles) > 0,
            'stats' => [
                'total_invitations' => $invitations->count(),
                'pending_invitations' => $invitations->where('status', 'pending')->count(),
                'accepted_invitations' => $invitations->where('status', 'accepted')->count(),
                'expired_invitations' => $invitations->where('status', 'expired')->count(),
            ]
        ]);
    }

    /**
     * Create new invitation.
     */
    public function create(Request $request, $room)
    {
        $validated = $request->validate([
            'email' => 'required|email|max:255',
            'role' => 'required|in:buyer,seller',
            'message' => 'nullable|string|max:1000',
            'expires_hours' => 'nullable|integer|min:1|max:168', // Max 7 days
        ]);

        $roomModel = Room::findOrFail($room);

        // Check if room is available for this role
        if ($validated['role'] === 'buyer' && !$roomModel->isAvailableForBuyer()) {
            return back()->withErrors(['role' => 'Buyer position is already filled']);
        }

        if ($validated['role'] === 'seller' && !$roomModel->isAvailableForSeller()) {
            return back()->withErrors(['role' => 'Seller position is already filled']);
        }

        // Check if invitation already exists for this email and room
        $existingInvitation = Invitation::where('room_id', $roomModel->id)
            ->where('email', $validated['email'])
            ->where('role', $validated['role'])
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($existingInvitation) {
            return back()->withErrors(['email' => 'An invitation for this email and role already exists']);
        }

        // Generate invitation token and PIN
        $token = \Illuminate\Support\Str::random(32);
        $pin = str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        // Set expiry time (default 24 hours)
        $expiresAt = now()->addHours($validated['expires_hours'] ?? 24);

        // Get current user (should be GM or authenticated user)
        $inviterId = auth()->id();

        $invitation = Invitation::create([
            'room_id' => $roomModel->id,
            'inviter_id' => $inviterId,
            'email' => $validated['email'],
            'role' => $validated['role'],
            'token' => $token,
            'pin' => $pin,
            'message' => $validated['message'] ?? null,
            'expires_at' => $expiresAt,
            'status' => 'pending',
            'pin_attempts' => 0,
            'pin_locked_until' => null,
        ]);

        // Log activity
        Log::info('Invitation created', [
            'invitation_id' => $invitation->id,
            'room_id' => $roomModel->id,
            'email' => $validated['email'],
            'role' => $validated['role'],
            'inviter_id' => $inviterId,
            'expires_at' => $expiresAt,
        ]);

        // TODO: Send invitation email (implement email service)

        return back()->with('success', 'Invitation sent successfully');
    }

    /**
     * Revoke an invitation.
     */
    public function revoke(Request $request, $room, $invitation)
    {
        $roomModel = Room::findOrFail($room);
        $invitationModel = Invitation::where('room_id', $roomModel->id)
            ->findOrFail($invitation);

        if ($invitationModel->isAccepted()) {
            return back()->withErrors(['invitation' => 'Cannot revoke accepted invitation']);
        }

        $invitationModel->update([
            'status' => 'revoked',
            'revoked_at' => now(),
            'revoker_id' => auth()->id(),
        ]);

        Log::info('Invitation revoked', [
            'invitation_id' => $invitationModel->id,
            'room_id' => $roomModel->id,
            'email' => $invitationModel->email,
            'revoker_id' => auth()->id(),
        ]);

        return back()->with('success', 'Invitation revoked successfully');
    }

    /**
     * Delete an invitation.
     */
    public function destroy($room, $invitation)
    {
        $roomModel = Room::findOrFail($room);
        $invitationModel = Invitation::where('room_id', $roomModel->id)
            ->findOrFail($invitation);

        // Only allow deletion of expired or revoked invitations
        if (!$invitationModel->isExpired() && !$invitationModel->isRevoked()) {
            return back()->withErrors(['invitation' => 'Can only delete expired or revoked invitations']);
        }

        $invitationModel->delete();

        Log::info('Invitation deleted', [
            'invitation_id' => $invitationModel->id,
            'room_id' => $roomModel->id,
            'email' => $invitationModel->email,
        ]);

        return back()->with('success', 'Invitation deleted successfully');
    }

    /**
     * Verify PIN for invitation.
     */
    public function verifyPin(Request $request, $token)
    {
        $validated = $request->validate([
            'pin' => 'required|string|size:4',
        ]);

        $invitation = Invitation::where('token', $token)
            ->with(['room', 'inviter'])
            ->firstOrFail();

        // Check if invitation is expired
        if ($invitation->isExpired()) {
            return response()->json([
                'success' => false,
                'message' => 'Invitation has expired',
            ], 422);
        }

        // Check if invitation is already accepted
        if ($invitation->isAccepted()) {
            return response()->json([
                'success' => false,
                'message' => 'Invitation has already been accepted',
            ], 422);
        }

        // Check if PIN is locked due to too many attempts
        if ($invitation->isPinLocked()) {
            return response()->json([
                'success' => false,
                'message' => 'Too many failed attempts. Please try again later.',
                'locked_until' => $invitation->pin_locked_until,
            ], 429);
        }

        // Verify PIN
        if ($invitation->pin !== $validated['pin']) {
            $invitation->increment('pin_attempts');

            // Lock PIN after 3 attempts
            if ($invitation->pin_attempts >= 3) {
                $invitation->update([
                    'pin_locked_until' => now()->addMinutes(30),
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Invalid PIN',
                'attempts_remaining' => max(0, 3 - $invitation->pin_attempts),
            ], 422);
        }

        // PIN is correct, reset attempts and mark as verified
        $invitation->update([
            'pin_attempts' => 0,
            'pin_locked_until' => null,
            'pin_verified_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'PIN verified successfully',
            'invitation' => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'role' => $invitation->role,
                'room' => [
                    'id' => $invitation->room->id,
                    'room_number' => $invitation->room->room_number,
                ],
                'inviter' => [
                    'name' => $invitation->inviter->name,
                ],
            ],
        ]);
    }
}