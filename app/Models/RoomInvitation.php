<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Carbon\Carbon;

class RoomInvitation extends Model
{
    use HasUuids;

    protected $fillable = [
        'room_id',
        'inviter_id',
        'invitee_id',
        'email',
        'encrypted_token',
        'pin',
        'role',
        'expires_at',
        'accepted_at',
        'joined_at',
        'session_id',
        'ip_address',
        'user_agent',
        'pin_attempts',
        'pin_locked_until',
        'is_active',
        'metadata'
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
        'joined_at' => 'datetime',
        'pin_locked_until' => 'datetime',
        'metadata' => 'array',
        'is_active' => 'boolean'
    ];

    protected $hidden = [
        'pin',
        'encrypted_token'
    ];

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function inviter()
    {
        return $this->belongsTo(User::class, 'inviter_id');
    }

    public function invitee()
    {
        return $this->belongsTo(User::class, 'invitee_id');
    }

    public function isExpired()
    {
        return $this->expires_at->isPast();
    }

    public function isAccepted()
    {
        return !is_null($this->accepted_at);
    }

    public function isJoined()
    {
        return !is_null($this->joined_at);
    }

    public function isPinLocked()
    {
        return $this->pin_locked_until && $this->pin_locked_until->isFuture();
    }

    public function canAttemptPin()
    {
        return !$this->isPinLocked() && $this->pin_attempts < 5;
    }

    public function incrementPinAttempts()
    {
        $this->increment('pin_attempts');

        if ($this->pin_attempts >= 5) {
            $this->update(['pin_locked_until' => Carbon::now()->addMinutes(30)]);
        }

        return $this;
    }

    public function resetPinAttempts()
    {
        return $this->update([
            'pin_attempts' => 0,
            'pin_locked_until' => null
        ]);
    }

    public function generateEncryptedToken()
    {
        $payload = [
            'room_id' => $this->room_id,
            'role' => $this->role,
            'email' => $this->email,
            'expires_at' => $this->expires_at->timestamp,
            'nonce' => Str::random(16)
        ];

        $this->encrypted_token = Crypt::encrypt($payload);
        $this->save();

        return $this->encrypted_token;
    }

    public static function generatePin()
    {
        return str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    public static function createInvitation($room, $inviter, $email, $role, $hoursValid = 24)
    {
        return static::create([
            'room_id' => $room->id,
            'inviter_id' => $inviter->id,
            'email' => $email,
            'pin' => static::generatePin(),
            'role' => $role,
            'expires_at' => Carbon::now()->addHours($hoursValid),
        ]);
    }

    public function accept($user = null, $sessionId = null, $ipAddress = null, $userAgent = null)
    {
        return $this->update([
            'invitee_id' => $user?->id,
            'accepted_at' => Carbon::now(),
            'session_id' => $sessionId,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent
        ]);
    }

    public function markAsJoined()
    {
        return $this->update([
            'joined_at' => Carbon::now()
        ]);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeNotExpired($query)
    {
        return $query->where('expires_at', '>', Carbon::now());
    }

    public function scopeForRoom($query, $roomId)
    {
        return $query->where('room_id', $roomId);
    }

    public function scopeForEmail($query, $email)
    {
        return $query->where('email', $email);
    }
}
