<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\Transaction;
use App\Models\RoomUser;

class TransactionUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $transaction;
    public $room;
    public $event_type;
    public $data;

    /**
     * Create a new event instance.
     */
    public function __construct(Transaction $transaction, string $eventType, array $data = [])
    {
        $this->transaction = $transaction;
        $this->room = $transaction->room;
        $this->event_type = $eventType;
        $this->data = $data;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        $channels = [];

        // Broadcast to room channel for all participants
        $channels[] = new PrivateChannel('room.' . $this->room->id);

        // Broadcast to GM channel for GM notifications
        $channels[] = new PrivateChannel('gm.transactions');

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'transaction.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'event_type' => $this->event_type,
            'transaction' => [
                'id' => $this->transaction->id,
                'transaction_number' => $this->transaction->transaction_number,
                'status' => $this->transaction->status,
                'amount' => $this->transaction->amount,
                'currency' => $this->transaction->currency,
                'room_id' => $this->transaction->room_id,
                'buyer_id' => $this->transaction->buyer_id,
                'seller_id' => $this->transaction->seller_id,
                'payment_verified_at' => $this->transaction->payment_verified_at,
                'shipping_verified_at' => $this->transaction->shipping_verified_at,
                'funds_released_at' => $this->transaction->funds_released_at,
                'completed_at' => $this->transaction->completed_at,
                'progress' => $this->transaction->getProgressPercentage(),
                'current_action' => $this->transaction->getCurrentAction(),
            ],
            'room' => [
                'id' => $this->room->id,
                'room_number' => $this->room->number,
                'status' => $this->room->status,
            ],
            'data' => $this->data,
            'timestamp' => now()->toISOString(),
        ];
    }
}