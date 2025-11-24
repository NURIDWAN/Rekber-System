<?php

use Illuminate\Support\Facades\Broadcast;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\GmUser;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

// Room channels - users can listen to their own room channels
Broadcast::channel('room.{roomId}', function ($user, $roomId) {
    $room = Room::find($roomId);
    if (!$room) {
        return false;
    }

    // Check if user is in the room
    return RoomUser::where('room_id', $roomId)
        ->where('user_id', $user->id)
        ->exists();
});

// GM channels - only GM users can listen to GM channels
Broadcast::channel('gm.transactions', function ($user) {
    return GmUser::where('user_id', $user->id)->exists();
});

Broadcast::channel('gm.verification', function ($user) {
    return GmUser::where('user_id', $user->id)->exists();
});

// User private channels
Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});