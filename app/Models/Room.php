<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Room extends Model
{
    use HasFactory;
    protected $fillable = [
        'room_number',
        'status',
    ];

    protected $casts = [
        'status' => 'string',
    ];

    public function roomUsers(): HasMany
    {
        return $this->hasMany(RoomUser::class);
    }

    public function users(): HasMany
    {
        return $this->roomUsers();
    }

    public function buyer(): HasMany
    {
        return $this->hasMany(RoomUser::class)->where('role', 'buyer');
    }

    public function seller(): HasMany
    {
        return $this->hasMany(RoomUser::class)->where('role', 'seller');
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(RoomActivityLog::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(RoomMessage::class);
    }

    public function transaction(): HasOne
    {
        return $this->hasOne(Transaction::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(RoomInvitation::class);
    }

    public function isAvailableForBuyer(): bool
    {
        return $this->status === 'free' || !$this->buyer()->exists();
    }

    public function isAvailableForSeller(): bool
    {
        return $this->status === 'in_use' &&
               $this->buyer()->exists() &&
               !$this->seller()->exists();
    }

    public function hasBuyer(): bool
    {
        return $this->buyer()->exists();
    }

    public function hasSeller(): bool
    {
        return $this->seller()->exists();
    }

    public function isFull(): bool
    {
        return $this->hasBuyer() && $this->hasSeller();
    }
}
