<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class TransactionFile extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_id',
        'transaction_id',
        'file_type',
        'file_path',
        'file_name',
        'file_size',
        'mime_type',
        'uploaded_by',
        'verified_by',
        'rejection_reason',
        'status',
        'verified_at',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
        'status' => 'string',
        'file_size' => 'integer',
    ];

    protected $appends = [
        'file_url',
        'file_size_formatted',
    ];

    /**
     * Get the room that owns the transaction file.
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /**
     * Get the transaction that owns the file.
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /**
     * Get the GM user who verified the file.
     */
    public function verifier(): BelongsTo
    {
        return $this->belongsTo(GmUser::class, 'verified_by');
    }

    /**
     * Get the file URL.
     */
    public function getFileUrlAttribute(): string
    {
        return Storage::url($this->file_path);
    }

    /**
     * Get formatted file size.
     */
    public function getFileSizeFormattedAttribute(): string
    {
        $bytes = $this->file_size;
        $units = ['B', 'KB', 'MB', 'GB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }

    /**
     * Check if file is a payment proof.
     */
    public function isPaymentProof(): bool
    {
        return $this->file_type === 'payment_proof';
    }

    /**
     * Check if file is a shipping receipt.
     */
    public function isShippingReceipt(): bool
    {
        return $this->file_type === 'shipping_receipt';
    }

    /**
     * Check if file is verified.
     */
    public function isVerified(): bool
    {
        return $this->status === 'verified';
    }

    /**
     * Check if file is rejected.
     */
    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }

    /**
     * Check if file is pending verification.
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Mark file as verified.
     */
    public function markAsVerified(int $gmUserId): void
    {
        $this->update([
            'status' => 'verified',
            'verified_by' => $gmUserId,
            'verified_at' => now(),
            'rejection_reason' => null,
        ]);
    }

    /**
     * Mark file as rejected.
     */
    public function markAsRejected(int $gmUserId, string $reason): void
    {
        $this->update([
            'status' => 'rejected',
            'verified_by' => $gmUserId,
            'verified_at' => now(),
            'rejection_reason' => $reason,
        ]);
    }

    /**
     * Reset file to pending status.
     */
    public function resetToPending(): void
    {
        $this->update([
            'status' => 'pending',
            'verified_by' => null,
            'verified_at' => null,
            'rejection_reason' => null,
        ]);
    }

    /**
     * Get the display name for file type.
     */
    public function getFileTypeDisplayName(): string
    {
        return match ($this->file_type) {
            'payment_proof' => 'Payment Proof',
            'shipping_receipt' => 'Shipping Receipt',
            default => 'Unknown File Type',
        };
    }

    /**
     * Get the CSS class for file type badge.
     */
    public function getFileTypeBadgeClass(): string
    {
        return match ($this->file_type) {
            'payment_proof' => 'bg-blue-100 text-blue-800',
            'shipping_receipt' => 'bg-green-100 text-green-800',
            default => 'bg-gray-100 text-gray-800',
        };
    }

    /**
     * Get the CSS class for status badge.
     */
    public function getStatusBadgeClass(): string
    {
        return match ($this->status) {
            'pending' => 'bg-yellow-100 text-yellow-800',
            'verified' => 'bg-green-100 text-green-800',
            'rejected' => 'bg-red-100 text-red-800',
            default => 'bg-gray-100 text-gray-800',
        };
    }

    /**
     * Check if file can be deleted by the uploader.
     */
    public function canBeDeletedBy(?int $userId): bool
    {
        if (!$userId) {
            return false;
        }

        // Get the room user ID for the uploader
        $uploaderRoomUser = RoomUser::where('room_id', $this->room_id)
            ->where('role', $this->uploaded_by)
            ->first();

        if (!$uploaderRoomUser) {
            return false;
        }

        return $uploaderRoomUser->id === $userId;
    }

    /**
     * Get file path for storage operations.
     */
    public function getStoragePath(): string
    {
        return $this->file_path;
    }

    /**
     * Delete file from storage and database.
     */
    public function deleteWithFile(): bool
    {
        try {
            // Delete file from storage
            if (Storage::exists($this->file_path)) {
                Storage::delete($this->file_path);
            }

            // Delete database record
            return $this->delete();
        } catch (\Exception $e) {
            \Log::error('Failed to delete transaction file', [
                'file_id' => $this->id,
                'file_path' => $this->file_path,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Scope to get files by type.
     */
    public function scopeByType($query, string $type)
    {
        return $query->where('file_type', $type);
    }

    /**
     * Scope to get files by status.
     */
    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to get files for a specific room.
     */
    public function scopeForRoom($query, int $roomId)
    {
        return $query->where('room_id', $roomId);
    }

    /**
     * Scope to get files for a specific transaction.
     */
    public function scopeForTransaction($query, int $transactionId)
    {
        return $query->where('transaction_id', $transactionId);
    }

    /**
     * Scope to get files uploaded by a specific role.
     */
    public function scopeUploadedBy($query, string $role)
    {
        return $query->where('uploaded_by', $role);
    }
}