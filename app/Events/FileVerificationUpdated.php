<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\TransactionFile;
use App\Models\Transaction;
use App\Models\Room;

class FileVerificationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $file;
    public $transaction;
    public $room;
    public $action;
    public $reason;

    /**
     * Create a new event instance.
     */
    public function __construct(TransactionFile $file, string $action, ?string $reason = null)
    {
        $this->file = $file;
        $this->action = $action;
        $this->reason = $reason;
        $this->transaction = $file->transaction;
        $this->room = $file->room;
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

        // Broadcast to GM channel for notifications
        $channels[] = new PrivateChannel('gm.verification');

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'file.verification.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'file' => [
                'id' => $this->file->id,
                'file_type' => $this->file->file_type,
                'file_name' => $this->file->file_name,
                'status' => $this->file->status,
                'verified_at' => $this->file->verified_at,
                'rejection_reason' => $this->file->rejection_reason,
                'uploaded_by' => $this->file->uploaded_by,
                'file_url' => $this->file->file_url,
            ],
            'transaction' => [
                'id' => $this->transaction->id,
                'transaction_number' => $this->transaction->transaction_number,
                'status' => $this->transaction->status,
                'progress' => $this->transaction->getProgressPercentage(),
                'current_action' => $this->transaction->getCurrentAction(),
            ],
            'room' => [
                'id' => $this->room->id,
                'room_number' => $this->room->number,
            ],
            'reason' => $this->reason,
            'timestamp' => now()->toISOString(),
        ];
    }
}