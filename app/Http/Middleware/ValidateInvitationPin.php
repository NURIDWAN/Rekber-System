<?php

namespace App\Http\Middleware;

use App\Models\RoomInvitation;
use App\Services\RoomUrlService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ValidateInvitationPin
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

        $invitation = $this->roomUrlService->findInvitationByToken($token);

        if (!$invitation) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'Invalid or expired invitation'], 404);
            }
            abort(404, 'Invitation not found or expired');
        }

        if ($invitation->isExpired()) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'Invitation has expired'], 410);
            }
            return redirect()->route('rooms.invite.expired', ['token' => $token]);
        }

        // Check if PIN is already verified in this session
        $pinVerifiedKey = "invitation_pin_verified_{$invitation->id}";
        if (session($pinVerifiedKey)) {
            // Add invitation to request for later use
            $request->merge(['verified_invitation' => $invitation]);
            return $next($request);
        }

        // Handle PIN verification requests
        if ($request->isMethod('POST') && $request->has('pin')) {
            return $this->handlePinVerification($request, $invitation, $next);
        }

        // For AJAX requests that need PIN verification
        if ($request->expectsJson() && $request->route()->getName() !== 'rooms.invite.verify-pin') {
            return response()->json([
                'error' => 'PIN verification required',
                'requires_pin' => true,
                'invitation_id' => $invitation->id,
                'verify_url' => route('rooms.invite.verify-pin', ['token' => $token])
            ], 402);
        }

        // For web requests, let the React component handle PIN verification
        if (!$request->expectsJson()) {
            return $next($request);
        }

        return $next($request);
    }

    private function handlePinVerification(Request $request, RoomInvitation $invitation, Closure $next): Response
    {
        $request->validate([
            'pin' => 'required|string|size:6'
        ]);

        if (!$invitation->canAttemptPin()) {
            $message = 'Too many failed attempts. Please try again later.';
            if ($invitation->isPinLocked()) {
                $message .= ' PIN locked until ' . $invitation->pin_locked_until->format('H:i');
            }

            if ($request->expectsJson()) {
                return response()->json([
                    'error' => $message,
                    'locked_until' => $invitation->pin_locked_until,
                    'attempts_remaining' => 0
                ], 429);
            }

            return back()->with('error', $message);
        }

        $isValid = $this->roomUrlService->verifyPin($invitation, $request->pin);

        if ($isValid) {
            // Mark PIN as verified in session
            $pinVerifiedKey = "invitation_pin_verified_{$invitation->id}";
            session([$pinVerifiedKey => true]);

            // Add invitation to request for later use
            $request->merge(['verified_invitation' => $invitation]);

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => 'PIN verified successfully',
                    'attempts_remaining' => 5
                ]);
            }

            // Redirect to original destination if exists
            $intended = session('intended');
            if ($intended) {
                session()->forget('intended');
                return redirect($intended);
            }

            return $next($request);
        }

        $attemptsRemaining = max(0, 5 - $invitation->pin_attempts);
        $message = "Invalid PIN. {$attemptsRemaining} attempts remaining.";

        if ($request->expectsJson()) {
            return response()->json([
                'error' => $message,
                'attempts_remaining' => $attemptsRemaining,
                'is_locked' => $invitation->isPinLocked(),
                'locked_until' => $invitation->pin_locked_until
            ], 401);
        }

        return back()->with('error', $message);
    }
