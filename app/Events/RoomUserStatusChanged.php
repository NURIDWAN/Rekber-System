<?php

namespace App\Events;

use App\Models\RoomUser;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RoomUserStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $roomUser;

    /**
     * Create a new event instance.
     */
    public function __construct(RoomUser $roomUser)
    {
        $this->roomUser = $roomUser;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('room-' . $this->roomUser->room_id),
            new PresenceChannel('presence-room-' . $this->roomUser->room_id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'user-status-changed';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'room_id' => $this->roomUser->room_id,
            'user_id' => $this->roomUser->id,
            'user_name' => $this->roomUser->name,
            'role' => $this->roomUser->role,
            'is_online' => $this->roomUser->is_online,
            'last_seen' => $this->roomUser->last_seen?->toISOString(),
            'timestamp' => now()->toISOString(),
        ];
    }
}