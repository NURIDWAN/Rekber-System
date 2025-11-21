<?php

namespace App\Broadcasting;

use App\Models\Room;
use App\Models\RoomUser;
use App\Models\GmUser;
use Illuminate\Http\Request;

class RoomChannel
{
    /**
     * Create a new channel instance.
     */
    public function __construct()
    {
        //
    }

    /**
     * Authenticate the user's access to the channel.
     */
    public function join($user, $roomId)
    {
        $room = Room::find($roomId);

        if (!$room) {
            return false;
        }

        if ($user instanceof GmUser) {
            return [
                'id' => 'gm_' . $user->id,
                'name' => $user->name,
                'role' => 'gm',
            ];
        }

        $roomUser = RoomUser::where('room_id', $roomId)
                            ->where('name', $user->name ?? null)
                            ->first();

        if ($roomUser) {
            return [
                'id' => $roomUser->id,
                'name' => $roomUser->name,
                'role' => $roomUser->role,
                'room_id' => $roomUser->room_id,
            ];
        }

        return false;
    }
}
