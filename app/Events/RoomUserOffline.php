<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RoomUserOffline implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $room;
    public $user;

    /**
     * Create a new event instance.
     */
    public function __construct($room, $user)
    {
        $this->room = $room;
        $this->user = $user;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PresenceChannel('presence-room-' . $this->room->id),
        ];
    }

    public function broadcastAs()
    {
        return 'RoomUserOffline';
    }

    public function broadcastWith()
    {
        return [
            'room_id' => $this->room->id,
            'user_id' => $this->user->id,
            'name' => $this->user->name,
            'role' => $this->user->role,
        ];
    }
}
