<?php

namespace App\Http\Middleware;

use App\Services\RoomUrlService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ValidateRoomToken
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $route = $request->route();
        $token = $route ? $route->parameter('token') : $request->get('token');

        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'Token is required',
            ], 400);
        }

        $roomUrlService = app(RoomUrlService::class);
        $decrypted = $roomUrlService->decryptToken($token);

        if (!$decrypted) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired token',
            ], 400);
        }

        // Enforce optional PIN if present
        if (!empty($decrypted['pin'])) {
            $providedPin = $request->get('pin');
            if (!$providedPin || $providedPin !== $decrypted['pin']) {
                return response()->json([
                    'success' => false,
                    'message' => 'PIN is required for this link',
                ], 403);
            }
        }

        // Add decrypted data to request for later use
        $request->merge([
            'room_id_from_token' => $decrypted['room_id'],
            'role_from_token' => $decrypted['role'],
            'token_timestamp' => $decrypted['timestamp'],
            'pin_from_token' => $decrypted['pin'] ?? null,
        ]);

        return $next($request);
    }
}
