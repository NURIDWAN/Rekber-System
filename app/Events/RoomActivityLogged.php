<?php

namespace App\Events;

use App\Models\RoomActivityLog;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RoomActivityLogged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $activityLog;

    /**
     * Create a new event instance.
     */
    public function __construct(RoomActivityLog $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('room-' . $this->activityLog->room_id),
            new PresenceChannel('presence-room-' . $this->activityLog->room_id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'new-activity';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'room_id' => $this->activityLog->room_id,
            'action' => $this->activityLog->action,
            'user_name' => $this->activityLog->user_name,
            'role' => $this->activityLog->role,
            'description' => $this->activityLog->description,
            'timestamp' => $this->activityLog->timestamp->toISOString(),
        ];
    }
}