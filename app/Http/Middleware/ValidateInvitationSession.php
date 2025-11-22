<?php

namespace App\Http\Middleware;

use App\Models\RoomInvitation;
use App\Services\RoomUrlService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class ValidateInvitationSession
{
    protected RoomUrlService $roomUrlService;

    public function __construct(RoomUrlService $roomUrlService)
    {
        $this->roomUrlService = $roomUrlService;
    }

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->route('token');

        if (!$token || !$this->roomUrlService->isInvitationToken($token)) {
            return $next($request);
        }

        $invitation = $request->get('verified_invitation');

        if (!$invitation) {
            $invitation = $this->roomUrlService->findInvitationByToken($token);
        }

        if (!$invitation) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'Invalid invitation'], 404);
            }
            abort(404, 'Invitation not found');
        }

        // Perform session validation
        $currentSessionId = session()->getId();
        $currentIpAddress = $request->ip();
        $currentUserAgent = $request->userAgent();

        // Check if session ID has changed (potential session hijacking)
        if ($invitation->session_id && $invitation->session_id !== $currentSessionId) {
            Log::warning('Session mismatch detected', [
                'invitation_id' => $invitation->id,
                'expected_session' => $invitation->session_id,
                'current_session' => $currentSessionId,
                'ip' => $currentIpAddress
            ]);

            // Clear PIN verification for security
            $pinVerifiedKey = "invitation_pin_verified_{$invitation->id}";
            session()->forget($pinVerifiedKey);

            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'Session validation failed. Please re-verify your PIN.',
                    'requires_reverification' => true
                ], 401);
            }

            return redirect()->route('rooms.invite.join', ['token' => $token])
                ->with('warning', 'Session validation failed. Please re-enter your PIN.');
        }

        // Optional: Check IP address changes (for additional security)
        if ($invitation->ip_address && $invitation->ip_address !== $currentIpAddress) {
            $ipChanged = true;

            // Log IP change for monitoring
            Log::info('IP address changed for invitation', [
                'invitation_id' => $invitation->id,
                'old_ip' => $invitation->ip_address,
                'new_ip' => $currentIpAddress,
                'session_id' => $currentSessionId
            ]);

            // You can choose to be strict about IP changes or just log them
            // For now, we'll log but allow the request to continue
        }

        // Optional: Check user agent changes (additional security layer)
        if ($invitation->user_agent && $invitation->user_agent !== $currentUserAgent) {
            Log::info('User agent changed for invitation', [
                'invitation_id' => $invitation->id,
                'old_ua' => $invitation->user_agent,
                'new_ua' => $currentUserAgent,
                'session_id' => $currentSessionId
            ]);
        }

        // Add security metadata to request for potential use in controllers
        $request->merge([
            'session_validated' => true,
            'ip_changed' => $ipChanged ?? false,
            'session_metadata' => [
                'session_id' => $currentSessionId,
                'ip_address' => $currentIpAddress,
                'user_agent' => $currentUserAgent
            ]
        ]);

        // Update invitation with current session info if not already set or if accepting
        if (!$invitation->session_id || $request->route()->getName() === 'rooms.invite.join') {
            $invitation->update([
                'session_id' => $currentSessionId,
                'ip_address' => $currentIpAddress,
                'user_agent' => $currentUserAgent
            ]);
        }

        return $next($request);
    }
}
