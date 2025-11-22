<?php

namespace App\Http\Middleware;

use App\Services\RoomUrlService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DecryptRoomId
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $route = $request->route();

        if (!$route) {
            return $next($request);
        }

        $roomParameter = $route->parameter('room');

        if ($roomParameter) {
            $roomUrlService = app(RoomUrlService::class);

            // Try to decrypt if it's an encrypted ID
            $decryptedRoomId = $roomUrlService->decryptRoomId($roomParameter);

            if ($decryptedRoomId === null) {
                // If this is actually a token (missing /join), redirect to the proper join route
                $tokenPayload = $roomUrlService->decryptToken($roomParameter);
                if ($tokenPayload) {
                    $params = ['token' => $roomParameter];
                    if (!empty($tokenPayload['pin'])) {
                        $params['pin'] = $tokenPayload['pin'];
                    }
                    return redirect()->route('rooms.join.token', $params);
                }

                return response()->json([
                    'success' => false,
                    'message' => 'Invalid room identifier',
                ], 404);
            }

            // Replace the parameter with the decrypted ID
            $route->setParameter('room', $decryptedRoomId);

            // Also add original encrypted ID for potential use in responses
            $request->merge([
                'encrypted_room_id' => $roomParameter,
                'decrypted_room_id' => $decryptedRoomId,
            ]);
        }

        return $next($request);
    }
}
