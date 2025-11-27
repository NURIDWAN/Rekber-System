<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Room;
use Illuminate\Http\JsonResponse;

class RoomStatusController extends Controller
{
    /**
     * Get room status updates for WebSocket fallback polling.
     * This would typically get recent status changes from a cache or database.
     */
    public function index(): JsonResponse
    {
        $rooms = Room::with([
            'users' => function ($query) {
                $query->select('id', 'room_id', 'name', 'role', 'is_online');
            }
        ])
            ->orderBy('room_number')
            ->get()
            ->map(function ($room) {
                $firstUser = $room->users()->first();

                return [
                    'room_id' => $room->id,
                    'status' => $room->status,
                    'has_buyer' => $room->hasBuyer(),
                    'has_seller' => $room->hasSeller(),
                    'available_for_buyer' => $room->isAvailableForBuyer(),
                    'available_for_seller' => $room->isAvailableForSeller(),
                    'user_name' => $firstUser?->name ?? '',
                    'role' => $firstUser?->role ?? '',
                    'action' => 'room_updated',
                    'timestamp' => now()->toISOString()
                ];
            });

        return response()->json($rooms);
    }
}