<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Room extends Model
{
    use HasFactory;
    protected $fillable = [
        'room_number',
        'status',
        'pin',
        'pin_enabled',
        'expires_at',
    ];

    protected $casts = [
        'status' => 'string',
        'pin_enabled' => 'boolean',
        'expires_at' => 'datetime',
    ];

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::creating(function ($room) {
            if (!$room->expires_at) {
                $room->expires_at = now()->addDays(7);
            }
        });
    }

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
        return $this->hasBuyer() && !$this->hasSeller();
    }

    public function hasBuyer(): bool
    {
        return $this->buyer()->where('is_online', true)->exists();
    }

    public function hasSeller(): bool
    {
        return $this->seller()->where('is_online', true)->exists();
    }

    public function hasAnyBuyer(): bool
    {
        return $this->buyer()->exists();
    }

    public function hasAnySeller(): bool
    {
        return $this->seller()->exists();
    }

    public function isFull(): bool
    {
        return $this->hasBuyer() && $this->hasSeller();
    }


    /**
     * Get the active transaction for this room.
     */
    public function activeTransaction()
    {
        return $this->hasOne(Transaction::class)->whereIn('status', [
            'pending_payment',
            'awaiting_payment_verification',
            'paid',
            'awaiting_shipping_verification',
            'shipped',
            'delivered'
        ])->latest();
    }

    /**
     * Get the latest transaction for this room.
     */
    public function latestTransaction()
    {
        return $this->hasOne(Transaction::class)->latest();
    }

    /**
     * Check if room has any transaction
     */
    public function hasTransaction(): bool
    {
        return $this->transactions()->exists();
    }

    /**
     * Check if room has active transaction
     */
    public function hasActiveTransaction(): bool
    {
        return $this->activeTransaction()->exists();
    }

    /**
     * Get transaction files for this room
     */
    public function transactionFiles()
    {
        return $this->hasMany(TransactionFile::class);
    }

    /**
     * Get payment proof files for this room
     */
    public function paymentProofFiles()
    {
        return $this->transactionFiles()->where('file_type', 'payment_proof');
    }

    /**
     * Get shipping receipt files for this room
     */
    public function shippingReceiptFiles()
    {
        return $this->transactionFiles()->where('file_type', 'shipping_receipt');
    }

    /**
     * Check if the room is expired
     */
    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }
}
