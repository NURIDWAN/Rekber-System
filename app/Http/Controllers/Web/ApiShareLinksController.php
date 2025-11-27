<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Services\RoomUrlService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ApiShareLinksController extends Controller
{
    /**
     * Generate shareable links for a room.
     */
    public function generateShareLinks(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'room_id' => 'required|integer|exists:rooms,id',
            'pin' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{4,8}$/'],
        ]);

        $room = Room::findOrFail($validated['room_id']);
        $roomUrlService = app(RoomUrlService::class);
        $pin = $validated['pin'] ?? null;

        return response()->json([
            'success' => true,
            'message' => 'Shareable links generated successfully',
            'data' => [
                'room' => [
                    'id' => $room->id,
                    'room_number' => $room->room_number ?? null,
                    'status' => $room->status,
                ],
                'pin_enabled' => !empty($pin),
                'pin' => $pin,
                'links' => $roomUrlService->generateShareableLinks($room->id, $pin),
            ],
        ]);
    }
}