<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class RoomUser extends Model
{
    protected $fillable = [
        'room_id',
        'name',
        'phone',
        'role',
        'session_token',
        'joined_at',
        'is_online',
        'last_seen',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
        'last_seen' => 'datetime',
        'is_online' => 'boolean',
    ];

    protected $hidden = [
        'session_token',
    ];

    public static function boot()
    {
        parent::boot();

        static::creating(function ($roomUser) {
            if (empty($roomUser->session_token)) {
                $roomUser->session_token = Str::random(32);
            }
            if (empty($roomUser->joined_at)) {
                $roomUser->joined_at = now();
            }
        });
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(RoomMessage::class, 'sender_role', 'role')
                    ->where('sender_name', $this->name);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(RoomActivityLog::class)
                    ->where('user_name', $this->name)
                    ->where('role', $this->role);
    }

    public function isBuyer(): bool
    {
        return $this->role === 'buyer';
    }

    public function isSeller(): bool
    {
        return $this->role === 'seller';
    }

    public function updateLastSeen(): void
    {
        $this->update([
            'last_seen' => now(),
            'is_online' => true,
        ]);
    }

    public function markAsOffline(): void
    {
        $this->update([
            'is_online' => false,
            'last_seen' => now(),
        ]);
    }
}
