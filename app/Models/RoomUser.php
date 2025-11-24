<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class RoomUser extends Model
{
    use HasFactory;
    protected $fillable = [
        'room_id',
        'name',
        'phone',
        'role',
        'session_token',
        'user_identifier',
        'device_fingerprint',
        'session_context',
        'joined_at',
        'is_online',
        'last_seen',
        'offline_at',
        'migrated_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
        'last_seen' => 'datetime',
        'offline_at' => 'datetime',
        'migrated_at' => 'datetime',
        'is_online' => 'boolean',
        'session_context' => 'array',
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
            if (empty($roomUser->user_identifier)) {
                // Use MultiSessionManager to generate proper identifier
                $roomUser->user_identifier = app(\App\Services\MultiSessionManager::class)->generateUserIdentifier();
            }
        });

        static::updating(function ($roomUser) {
            // Update last_seen when is_online changes to true
            if ($roomUser->isDirty('is_online') && $roomUser->is_online) {
                $roomUser->last_seen = now();
            }

            // Set offline_at when going offline
            if ($roomUser->isDirty('is_online') && !$roomUser->is_online) {
                $roomUser->offline_at = now();
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
            'offline_at' => now(),
        ]);
    }

    /**
     * Scope to get online users for a specific user identifier
     */
    public function scopeOnlineForUser($query, string $userIdentifier)
    {
        return $query->where('user_identifier', $userIdentifier)
                    ->where('is_online', true);
    }

    /**
     * Scope to get all sessions for a user
     */
    public function scopeForUser($query, string $userIdentifier)
    {
        return $query->where('user_identifier', $userIdentifier);
    }

    /**
     * Get session context with device information
     */
    public function getSessionContext(): array
    {
        $context = $this->session_context ?? [];

        return array_merge([
            'user_agent' => request()->userAgent(),
            'ip_address' => request()->ip(),
            'device_fingerprint' => $this->device_fingerprint,
        ], $context);
    }

    /**
     * Set session context information
     */
    public function setSessionContext(array $context): void
    {
        $this->update([
            'session_context' => array_merge($this->session_context ?? [], $context)
        ]);
    }

    /**
     * Check if this is the same user based on identifier
     */
    public function isSameUser(RoomUser $other): bool
    {
        return $this->user_identifier === $other->user_identifier;
    }

    /**
     * Check if user has active sessions in other rooms
     */
    public function getOtherActiveSessions(): \Illuminate\Database\Eloquent\Collection
    {
        return static::where('user_identifier', $this->user_identifier)
                     ->where('id', '!=', $this->id)
                     ->where('is_online', true)
                     ->with('room')
                     ->get();
    }

    /**
     * Get user's other roles in the same room
     */
    public function getOtherRolesInRoom(): \Illuminate\Database\Eloquent\Collection
    {
        return static::where('room_id', $this->room_id)
                     ->where('user_identifier', $this->user_identifier)
                     ->where('id', '!=', $this->id)
                     ->get();
    }

    /**
     * Migrate from legacy session to multi-session
     */
    public function migrateToMultiSession(): void
    {
        if ($this->migrated_at) {
            return; // Already migrated
        }

        $multiSessionManager = app(\App\Services\MultiSessionManager::class);

        $this->update([
            'user_identifier' => $this->user_identifier ?? $multiSessionManager->generateUserIdentifier(),
            'session_context' => array_merge($this->session_context ?? [], [
                'migrated_from_legacy' => true,
                'migration_date' => now()->toISOString(),
            ]),
            'migrated_at' => now(),
        ]);
    }

    /**
     * Generate device fingerprint from request
     */
    public static function generateDeviceFingerprint(): string
    {
        $userAgent = request()->userAgent() ?? '';
        $ip = request()->ip() ?? '';
        $acceptLanguage = request()->header('Accept-Language') ?? '';

        return hash('sha256', $userAgent . $ip . $acceptLanguage);
    }

    /**
     * Switch role in the same room
     */
    public function switchRole(string $newRole): ?self
    {
        // Check if user already has session with new role in this room
        $existingSession = static::where('room_id', $this->room_id)
                                ->where('user_identifier', $this->user_identifier)
                                ->where('role', $newRole)
                                ->first();

        if ($existingSession) {
            // Activate existing session and deactivate current
            $this->update(['is_online' => false]);
            $existingSession->update(['is_online' => true, 'last_seen' => now()]);
            return $existingSession;
        }

        // Create new session with different role
        $newSession = $this->replicate();
        $newSession->role = $newRole;
        $newSession->session_token = Str::random(32);
        $newSession->joined_at = now();
        $newSession->is_online = true;
        $newSession->last_seen = now();
        $newSession->save();

        // Deactivate current session
        $this->update(['is_online' => false]);

        return $newSession;
    }
}
