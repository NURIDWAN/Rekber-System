<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\RoomUser;
use App\Models\Room;
use Symfony\Component\HttpFoundation\Response;

class RoomSession
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $roomId = $request->route('room');

        if (!$roomId) {
            return response()->json([
                'success' => false,
                'message' => 'Room ID is required',
            ], 400);
        }

        $room = Room::find($roomId);
        if (!$room) {
            return response()->json([
                'success' => false,
                'message' => 'Room not found',
            ], 404);
        }

        $sessionToken = $request->cookie('room_session_' . $room->id);

        if (!$sessionToken) {
            return response()->json([
                'success' => false,
                'message' => 'No session found for this room',
            ], 401);
        }

        $roomUser = RoomUser::where('room_id', $room->id)
                           ->where('session_token', $sessionToken)
                           ->first();

        if (!$roomUser) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid session token',
            ], 401);
        }

        $roomUser->updateLastSeen();

        $request->merge([
            'current_room_user' => $roomUser,
            'current_room' => $room,
        ]);

        return $next($request);
    }
}
