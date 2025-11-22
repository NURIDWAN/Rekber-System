<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Transaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_id',
        'buyer_id',
        'seller_id',
        'transaction_number',
        'amount',
        'currency',
        'status',
        'payment_status',
        'description',
        'buyer_notes',
        'seller_notes',
        'gm_notes',
        'commission',
        'fee',
        'total_amount',
        'paid_at',
        'shipped_at',
        'delivered_at',
        'completed_at',
        'cancelled_at',
        'gm_user_id',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'commission' => 'decimal:2',
        'fee' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'metadata' => 'array',
    ];

    /**
     * Boot the model
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($transaction) {
            if (empty($transaction->transaction_number)) {
                $transaction->transaction_number = 'TRX-' . date('Ymd') . '-' . strtoupper(Str::random(8));
            }

            // Calculate total amount
            $transaction->total_amount = $transaction->amount + $transaction->commission + $transaction->fee;
        });
    }

    /**
     * Get the room that owns the transaction
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /**
     * Get the buyer for this transaction
     */
    public function buyer(): BelongsTo
    {
        return $this->belongsTo(RoomUser::class, 'buyer_id');
    }

    /**
     * Get the seller for this transaction
     */
    public function seller(): BelongsTo
    {
        return $this->belongsTo(RoomUser::class, 'seller_id');
    }

    /**
     * Get the GM user who handled this transaction
     */
    public function gmUser(): BelongsTo
    {
        return $this->belongsTo(GmUser::class);
    }

    /**
     * Scope a query to only include transactions with a specific status
     */
    public function scopeStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope a query to only include pending payment transactions
     */
    public function scopePendingPayment($query)
    {
        return $query->where('status', 'pending_payment');
    }

    /**
     * Scope a query to only include active transactions
     */
    public function scopeActive($query)
    {
        return $query->whereIn('status', ['paid', 'shipped', 'delivered']);
    }

    /**
     * Scope a query to only include completed transactions
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope a query to only include disputed transactions
     */
    public function scopeDisputed($query)
    {
        return $query->where('status', 'disputed');
    }

    /**
     * Check if transaction is active
     */
    public function isActive(): bool
    {
        return in_array($this->status, ['paid', 'shipped', 'delivered']);
    }

    /**
     * Check if transaction is completed
     */
    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    /**
     * Check if transaction is disputed
     */
    public function isDisputed(): bool
    {
        return $this->status === 'disputed';
    }

    /**
     * Get status label with color
     */
    public function getStatusLabel(): array
    {
        $labels = [
            'pending_payment' => ['text' => 'Pending Payment', 'color' => 'yellow'],
            'paid' => ['text' => 'Paid', 'color' => 'blue'],
            'shipped' => ['text' => 'Shipped', 'color' => 'purple'],
            'delivered' => ['text' => 'Delivered', 'color' => 'indigo'],
            'completed' => ['text' => 'Completed', 'color' => 'green'],
            'disputed' => ['text' => 'Disputed', 'color' => 'red'],
            'cancelled' => ['text' => 'Cancelled', 'color' => 'gray'],
            'refunded' => ['text' => 'Refunded', 'color' => 'orange'],
        ];

        return $labels[$this->status] ?? ['text' => 'Unknown', 'color' => 'gray'];
    }
}
