<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoomActivityLog extends Model
{
    protected $fillable = [
        'room_id',
        'action',
        'user_name',
        'role',
        'description',
        'timestamp',
    ];

    protected $casts = [
        'timestamp' => 'datetime',
    ];

    public $timestamps = false;

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public static function logActivity(int $roomId, string $action, string $userName, ?string $role = null, ?string $description = null): self
    {
        return self::create([
            'room_id' => $roomId,
            'action' => $action,
            'user_name' => $userName,
            'role' => $role,
            'description' => $description,
            'timestamp' => now(),
        ]);
    }

    public function scopeForRoom($query, $roomId)
    {
        return $query->where('room_id', $roomId);
    }

    public function scopeRecent($query, int $limit = 50)
    {
        return $query->orderBy('timestamp', 'desc')->limit($limit);
    }
}
