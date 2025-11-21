<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RoomMessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $room;
    public $message;
    public $sender;

    /**
     * Create a new event instance.
     */
    public function __construct($room, $message, $sender)
    {
        $this->room = $room;
        $this->message = $message;
        $this->sender = $sender;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('room-' . $this->room->id),
            new PresenceChannel('presence-room-' . $this->room->id),
        ];
    }

    public function broadcastAs()
    {
        return 'RoomMessageSent';
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->message->id,
            'room_id' => $this->room->id,
            'sender_role' => $this->message->sender_role,
            'sender_name' => $this->message->sender_name,
            'message' => $this->message->message,
            'type' => $this->message->type,
            'created_at' => $this->message->created_at,
        ];
    }
}
