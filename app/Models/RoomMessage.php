<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoomMessage extends Model
{
    protected $fillable = [
        'room_id',
        'sender_role',
        'sender_name',
        'message',
        'type',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public $timestamps = false;

    protected $dispatchesEvents = [
        'created' => \App\Events\RoomMessageSent::class,
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function scopeForRoom($query, $roomId)
    {
        return $query->where('room_id', $roomId);
    }

    public function scopeRecent($query, int $limit = 100)
    {
        return $query->orderBy('created_at', 'desc')->limit($limit);
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('created_at', 'asc');
    }

    public function isText(): bool
    {
        return $this->type === 'text';
    }

    public function isImage(): bool
    {
        return $this->type === 'image';
    }

    public function isSystem(): bool
    {
        return $this->type === 'system';
    }

    public static function createSystemMessage(int $roomId, string $message): self
    {
        return self::create([
            'room_id' => $roomId,
            'sender_role' => 'system',
            'sender_name' => 'System',
            'message' => $message,
            'type' => 'system',
            'created_at' => now(),
        ]);
    }

    public static function createUserMessage(int $roomId, string $senderRole, string $senderName, string $message, string $type = 'text'): self
    {
        return self::create([
            'room_id' => $roomId,
            'sender_role' => $senderRole,
            'sender_name' => $senderName,
            'message' => $message,
            'type' => $type,
            'created_at' => now(),
        ]);
    }
}
