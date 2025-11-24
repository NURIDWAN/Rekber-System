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
        // New fields for MVP
        'payment_verified_by',
        'payment_verified_at',
        'payment_rejection_reason',
        'shipping_verified_by',
        'shipping_verified_at',
        'shipping_rejection_reason',
        'funds_released_by',
        'funds_released_at',
        'payment_proof_uploaded_at',
        'payment_proof_uploaded_by',
        'shipping_receipt_uploaded_at',
        'shipping_receipt_uploaded_by',
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
        // New casts for MVP
        'payment_verified_at' => 'datetime',
        'shipping_verified_at' => 'datetime',
        'funds_released_at' => 'datetime',
        'payment_proof_uploaded_at' => 'datetime',
        'shipping_receipt_uploaded_at' => 'datetime',
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
     * Get the files associated with this transaction.
     */
    public function files()
    {
        return $this->hasMany(TransactionFile::class);
    }

    /**
     * Get the payment proof files for this transaction.
     */
    public function paymentProofFiles()
    {
        return $this->hasMany(TransactionFile::class)->where('file_type', 'payment_proof');
    }

    /**
     * Get the shipping receipt files for this transaction.
     */
    public function shippingReceiptFiles()
    {
        return $this->hasMany(TransactionFile::class)->where('file_type', 'shipping_receipt');
    }

    /**
     * Get the GM user who verified payment.
     */
    public function paymentVerifier(): BelongsTo
    {
        return $this->belongsTo(GmUser::class, 'payment_verified_by');
    }

    /**
     * Get the GM user who verified shipping.
     */
    public function shippingVerifier(): BelongsTo
    {
        return $this->belongsTo(GmUser::class, 'shipping_verified_by');
    }

    /**
     * Get the GM user who released funds.
     */
    public function fundsReleaser(): BelongsTo
    {
        return $this->belongsTo(GmUser::class, 'funds_released_by');
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
            'awaiting_payment_verification' => ['text' => 'Awaiting Payment Verification', 'color' => 'orange'],
            'paid' => ['text' => 'Paid', 'color' => 'blue'],
            'awaiting_shipping_verification' => ['text' => 'Awaiting Shipping Verification', 'color' => 'purple'],
            'shipped' => ['text' => 'Shipped', 'color' => 'indigo'],
            'delivered' => ['text' => 'Delivered', 'color' => 'cyan'],
            'completed' => ['text' => 'Completed', 'color' => 'green'],
            'disputed' => ['text' => 'Disputed', 'color' => 'red'],
            'cancelled' => ['text' => 'Cancelled', 'color' => 'gray'],
            'refunded' => ['text' => 'Refunded', 'color' => 'orange'],
        ];

        return $labels[$this->status] ?? ['text' => 'Unknown', 'color' => 'gray'];
    }

    // MVP ESCROW METHODS

    /**
     * Check if payment proof has been uploaded
     */
    public function hasPaymentProof(): bool
    {
        return $this->payment_proof_uploaded_at !== null;
    }

    /**
     * Check if shipping receipt has been uploaded
     */
    public function hasShippingReceipt(): bool
    {
        return $this->shipping_receipt_uploaded_at !== null;
    }

    /**
     * Check if payment is verified
     */
    public function isPaymentVerified(): bool
    {
        return $this->payment_verified_at !== null;
    }

    /**
     * Check if shipping is verified
     */
    public function isShippingVerified(): bool
    {
        return $this->shipping_verified_at !== null;
    }

    /**
     * Check if funds have been released
     */
    public function areFundsReleased(): bool
    {
        return $this->funds_released_at !== null;
    }

    /**
     * Check if transaction is awaiting payment verification
     */
    public function isAwaitingPaymentVerification(): bool
    {
        return $this->status === 'awaiting_payment_verification';
    }

    /**
     * Check if transaction is awaiting shipping verification
     */
    public function isAwaitingShippingVerification(): bool
    {
        return $this->status === 'awaiting_shipping_verification';
    }

    /**
     * Verify payment proof
     */
    public function verifyPayment(int $gmUserId): bool
    {
        if ($this->status !== 'awaiting_payment_verification') {
            return false;
        }

        return $this->update([
            'status' => 'paid',
            'payment_verified_by' => $gmUserId,
            'payment_verified_at' => now(),
            'payment_rejection_reason' => null,
            'paid_at' => now(),
        ]);
    }

    /**
     * Reject payment proof
     */
    public function rejectPayment(int $gmUserId, string $reason): bool
    {
        if ($this->status !== 'awaiting_payment_verification') {
            return false;
        }

        return $this->update([
            'status' => 'pending_payment',
            'payment_verified_by' => null,
            'payment_verified_at' => null,
            'payment_rejection_reason' => $reason,
        ]);
    }

    /**
     * Verify shipping receipt
     */
    public function verifyShipping(int $gmUserId): bool
    {
        if ($this->status !== 'awaiting_shipping_verification') {
            return false;
        }

        return $this->update([
            'status' => 'shipped',
            'shipping_verified_by' => $gmUserId,
            'shipping_verified_at' => now(),
            'shipping_rejection_reason' => null,
            'shipped_at' => now(),
        ]);
    }

    /**
     * Reject shipping receipt
     */
    public function rejectShipping(int $gmUserId, string $reason): bool
    {
        if ($this->status !== 'awaiting_shipping_verification') {
            return false;
        }

        return $this->update([
            'status' => 'paid',
            'shipping_verified_by' => null,
            'shipping_verified_at' => null,
            'shipping_rejection_reason' => $reason,
        ]);
    }

    /**
     * Release funds and complete transaction
     */
    public function releaseFunds(int $gmUserId): bool
    {
        if ($this->status !== 'delivered') {
            return false;
        }

        $success = $this->update([
            'status' => 'completed',
            'funds_released_by' => $gmUserId,
            'funds_released_at' => now(),
            'completed_at' => now(),
        ]);

        if ($success) {
            // Reset room to free status
            $this->room->update(['status' => 'free']);
        }

        return $success;
    }

    /**
     * Mark as delivered (by buyer)
     */
    public function markAsDelivered(): bool
    {
        if ($this->status !== 'shipped') {
            return false;
        }

        return $this->update([
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);
    }

    /**
     * Get current action required for transaction
     */
    public function getCurrentAction(): ?array
    {
        return match ($this->status) {
            'pending_payment' => [
                'text' => 'Upload Payment Proof',
                'required_by' => 'buyer',
                'next_status' => 'awaiting_payment_verification',
            ],
            'awaiting_payment_verification' => [
                'text' => 'Verify Payment Proof',
                'required_by' => 'gm',
                'next_status' => 'paid',
            ],
            'paid' => [
                'text' => 'Upload Shipping Receipt',
                'required_by' => 'seller',
                'next_status' => 'awaiting_shipping_verification',
            ],
            'awaiting_shipping_verification' => [
                'text' => 'Verify Shipping Receipt',
                'required_by' => 'gm',
                'next_status' => 'shipped',
            ],
            'shipped' => [
                'text' => 'Confirm Receipt',
                'required_by' => 'buyer',
                'next_status' => 'delivered',
            ],
            'delivered' => [
                'text' => 'Release Funds',
                'required_by' => 'gm',
                'next_status' => 'completed',
            ],
            'completed' => null,
            default => null,
        };
    }

    /**
     * Check if transaction can be edited by user role
     */
    public function canBeEditedBy(string $role, ?int $userId = null): bool
    {
        return match ($this->status) {
            'pending_payment', 'awaiting_payment_verification' => $role === 'buyer',
            'paid', 'awaiting_shipping_verification' => $role === 'seller',
            'shipped' => $role === 'buyer',
            default => false,
        };
    }

    /**
     * Get progress percentage
     */
    public function getProgressPercentage(): int
    {
        $steps = [
            'pending_payment' => 0,
            'awaiting_payment_verification' => 25,
            'paid' => 50,
            'awaiting_shipping_verification' => 75,
            'shipped' => 80,
            'delivered' => 90,
            'completed' => 100,
        ];

        return $steps[$this->status] ?? 0;
    }

    /**
     * Scope to get transactions requiring GM attention
     */
    public function scopeRequiringGMAttention($query)
    {
        return $query->whereIn('status', [
            'awaiting_payment_verification',
            'awaiting_shipping_verification',
            'delivered'
        ]);
    }
}
