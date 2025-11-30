<?php

namespace App\Services;

use App\Models\RoomInvitation;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Session;
use Carbon\Carbon;
use Illuminate\Support\Str;

class RoomUrlService
{
    /**
     * Token expiry time in minutes (5 years - effectively long-lived)
     * Expiry is now handled by the Room model's expires_at column
     */
    const TOKEN_EXPIRY_MINUTES = 2628000;

    /**
     * Length of HMAC signature segment (hex characters)
     */
    const SIGNATURE_LENGTH = 16;

    /**
     * Prefix for encrypted room IDs
     */
    const ROOM_ID_PREFIX = 'rm_';

    /**
     * Prefix for invitation tokens
     */
    const INVITATION_PREFIX = 'inv_';

    /**
     * Generate encrypted token for room access
     *
     * @param int $roomId
     * @param string $role (buyer|seller)
     * @return string
     */
    public function generateToken(int $roomId, string $role, ?string $pin = null, bool $compact = false): string
    {
        if ($compact) {
            return $this->generateCompactToken($roomId, $role, $pin);
        }

        $timestamp = now()->timestamp;
        $randomKey = Str::random(16);

        $payload = [
            'room_id' => $roomId,
            'role' => $role,
            'timestamp' => $timestamp,
            'random_key' => $randomKey,
            'pin' => $pin,
            'hash' => hash('sha256', $roomId . $role . $timestamp . $randomKey . ($pin ?? ''))
        ];

        $encrypted = Crypt::encryptString(json_encode($payload));

        // URL-safe encode to keep tokens path-friendly
        return $this->base64UrlEncode($encrypted);
    }

    /**
     * Generate compact HMAC token (shorter for sharing)
     */
    private function generateCompactToken(int $roomId, string $role, ?string $pin = null): string
    {
        $timestamp = now()->timestamp;
        $randomKey = Str::random(6);

        $payload = implode('|', [
            $roomId,
            $role,
            $timestamp,
            $randomKey,
            $pin ?? ''
        ]);

        $signature = substr(hash_hmac('sha256', $payload, config('app.key')), 0, self::SIGNATURE_LENGTH);
        $token = $payload . '|' . $signature;

        return $this->base64UrlEncode($token);
    }

    /**
     * Decrypt and validate token
     *
     * @param string $token
     * @return array|null
     */
    public function decryptToken(string $token): ?array
    {
        // Try compact token first
        $compact = $this->decodeCompactToken($token);
        if ($compact) {
            return $compact;
        }

        // Fallback to encrypted tokens (URL-safe first, then legacy)
        $candidates = [];

        $decoded = $this->base64UrlDecode($token);
        if ($decoded !== false) {
            $candidates[] = $decoded;
        }

        // Legacy non-URL-safe encrypted token
        $candidates[] = $token;

        foreach ($candidates as $candidate) {
            try {
                $decrypted = Crypt::decryptString($candidate);
                $payload = json_decode($decrypted, true);

                if (!$this->isValidEncryptedPayload($payload)) {
                    continue;
                }

                return [
                    'room_id' => (int) $payload['room_id'],
                    'role' => $payload['role'],
                    'timestamp' => $payload['timestamp'],
                    'pin' => $payload['pin'] ?? null,
                ];
            } catch (\Exception $e) {
                continue;
            }
        }

        return null;
    }

    private function decodeCompactToken(string $token): ?array
    {
        try {
            $decoded = $this->base64UrlDecode($token);
            if (!$decoded || !str_contains($decoded, '|')) {
                return null;
            }

            $parts = explode('|', $decoded);
            if (count($parts) < 5) {
                return null;
            }

            [$roomId, $role, $timestamp, $randomKey, $pin, $signature] = array_pad($parts, 6, null);

            if (!$roomId || !$role || !$timestamp || !$randomKey || !$signature) {
                return null;
            }

            $payload = implode('|', [$roomId, $role, $timestamp, $randomKey, $pin ?? '']);
            $expectedSignature = substr(hash_hmac('sha256', $payload, config('app.key')), 0, self::SIGNATURE_LENGTH);

            if (!hash_equals($expectedSignature, $signature)) {
                return null;
            }

            $tokenTime = Carbon::createFromTimestamp((int) $timestamp);
            if ($tokenTime->diffInMinutes(now()) > self::TOKEN_EXPIRY_MINUTES) {
                return null;
            }

            if (!in_array($role, ['buyer', 'seller'])) {
                return null;
            }

            return [
                'room_id' => (int) $roomId,
                'role' => $role,
                'timestamp' => (int) $timestamp,
                'pin' => $pin ?: null,
            ];
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Generate join URL for room
     *
     * @param int $roomId
     * @param string $role
     * @return string
     */
    public function generateJoinUrl(int $roomId, string $role, ?string $pin = null): string
    {
        $token = $this->generateToken($roomId, $role, $pin, true);
        $params = ['token' => $token];
        if ($pin) {
            $params['pin'] = $pin;
        }
        return route('rooms.join.token', $params);
    }

    /**
     * Generate enter URL for room
     *
     * @param int $roomId
     * @param string $role
     * @return string
     */
    public function generateEnterUrl(int $roomId, string $role, ?string $pin = null): string
    {
        $token = $this->generateToken($roomId, $role, $pin, true);
        $params = ['token' => $token];
        if ($pin) {
            $params['pin'] = $pin;
        }
        return route('rooms.enter.token', $params);
    }

    /**
     * Generate shareable links for both buyer and seller
     *
     * @param int $roomId
     * @param string|null $pin
     * @return array
     */
    public function generateShareableLinks(int $roomId, ?string $pin = null): array
    {
        return [
            'buyer' => [
                'join' => $this->generateJoinUrl($roomId, 'buyer', $pin),
                'enter' => $this->generateEnterUrl($roomId, 'buyer', $pin)
            ],
            'seller' => [
                'join' => $this->generateJoinUrl($roomId, 'seller', $pin),
                'enter' => $this->generateEnterUrl($roomId, 'seller', $pin)
            ]
        ];
    }

    /**
     * Check if token is expired
     *
     * @param int $timestamp
     * @return bool
     */
    public function isTokenExpired(int $timestamp): bool
    {
        $tokenTime = Carbon::createFromTimestamp($timestamp);
        return $tokenTime->diffInMinutes(now()) > self::TOKEN_EXPIRY_MINUTES;
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): string|false
    {
        $converted = strtr($data, '-_', '+/');
        $padding = strlen($converted) % 4;
        if ($padding) {
            $converted .= str_repeat('=', 4 - $padding);
        }
        return base64_decode($converted, true);
    }

    private function isValidEncryptedPayload(?array $payload): bool
    {
        if (!$payload || !isset($payload['room_id'], $payload['role'], $payload['timestamp'], $payload['hash'], $payload['random_key'])) {
            return false;
        }

        $expectedHash = hash(
            'sha256',
            $payload['room_id'] .
            $payload['role'] .
            $payload['timestamp'] .
            $payload['random_key'] .
            ($payload['pin'] ?? '')
        );

        if (!hash_equals($expectedHash, $payload['hash'])) {
            return false;
        }

        $tokenTime = Carbon::createFromTimestamp($payload['timestamp']);
        if ($tokenTime->diffInMinutes(now()) > self::TOKEN_EXPIRY_MINUTES) {
            return false;
        }

        return in_array($payload['role'], ['buyer', 'seller']);
    }

    /**
     * Encrypt room ID for URL usage
     *
     * @param int $roomId
     * @return string
     */
    public function encryptRoomId(int $roomId): string
    {
        $timestamp = now()->timestamp;
        $randomKey = Str::random(8);

        $payload = [
            'room_id' => $roomId,
            'timestamp' => $timestamp,
            'random_key' => $randomKey,
            'type' => 'room_id'
        ];

        $encrypted = Crypt::encryptString(json_encode($payload));
        return self::ROOM_ID_PREFIX . $this->base64UrlEncode($encrypted);
    }

    /**
     * Decrypt room ID from URL
     *
     * @param string $encryptedId
     * @return int|null
     */
    public function decryptRoomId(string $encryptedId): ?int
    {
        // Remove prefix
        if (!str_starts_with($encryptedId, self::ROOM_ID_PREFIX)) {
            // Try direct numeric ID (fallback for backwards compatibility)
            if (is_numeric($encryptedId)) {
                return (int) $encryptedId;
            }
            return null;
        }

        $encodedPart = substr($encryptedId, strlen(self::ROOM_ID_PREFIX));

        try {
            $decoded = $this->base64UrlDecode($encodedPart);
            if (!$decoded) {
                return null;
            }

            $decrypted = Crypt::decryptString($decoded);
            $payload = json_decode($decrypted, true);

            if (!$payload || !isset($payload['room_id'], $payload['type']) || $payload['type'] !== 'room_id') {
                return null;
            }

            // Optional: Add timestamp validation for room IDs too
            $tokenTime = Carbon::createFromTimestamp($payload['timestamp']);
            if ($tokenTime->diffInHours(now()) > 24) { // Room IDs valid for 24 hours
                return null;
            }

            return (int) $payload['room_id'];

        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Generate encrypted room URL for room detail page
     *
     * @param int $roomId
     * @return string
     */
    public function generateRoomUrl(int $roomId): string
    {
        $encryptedId = $this->encryptRoomId($roomId);
        return route('rooms.show', ['room' => $encryptedId]);
    }

    /**
     * Generate encrypted room join URL
     *
     * @param int $roomId
     * @param string $role
     * @return string
     */
    public function generateRoomJoinUrl(int $roomId, string $role = 'buyer'): string
    {
        $encryptedId = $this->encryptRoomId($roomId);
        return route('rooms.join', ['room' => $encryptedId, 'role' => $role]);
    }

    /**
     * Create room invitation with encrypted URL and PIN
     *
     * @param mixed $room
     * @param mixed $inviter
     * @param string $email
     * @param string $role
     * @param int $hoursValid
     * @return RoomInvitation
     */
    public function createInvitation($room, $inviter, string $email, string $role, int $hoursValid = 168): RoomInvitation
    {
        $invitation = RoomInvitation::createInvitation($room, $inviter, $email, $role, $hoursValid);
        $invitation->generateEncryptedToken();

        return $invitation;
    }

    /**
     * Generate invitation URL with encrypted token
     *
     * @param RoomInvitation $invitation
     * @return string
     */
    public function generateInvitationUrl(RoomInvitation $invitation): string
    {
        $token = self::INVITATION_PREFIX . $this->base64UrlEncode($invitation->encrypted_token);
        return route('rooms.invite.join', ['token' => $token]);
    }

    /**
     * Validate invitation token and return decrypted data
     *
     * @param string $token
     * @return array|null
     */
    public function validateInvitationToken(string $token): ?array
    {
        if (!str_starts_with($token, self::INVITATION_PREFIX)) {
            return null;
        }

        $encodedToken = substr($token, strlen(self::INVITATION_PREFIX));
        $encryptedToken = $this->base64UrlDecode($encodedToken);

        if (!$encryptedToken) {
            return null;
        }

        try {
            $payload = Crypt::decrypt($encryptedToken);

            if (!isset($payload['room_id'], $payload['role'], $payload['email'], $payload['expires_at'])) {
                return null;
            }

            if (Carbon::createFromTimestamp($payload['expires_at'])->isPast()) {
                return null;
            }

            return $payload;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Find invitation by token
     *
     * @param string $token
     * @return RoomInvitation|null
     */
    public function findInvitationByToken(string $token): ?RoomInvitation
    {
        $payload = $this->validateInvitationToken($token);
        if (!$payload) {
            return null;
        }

        return RoomInvitation::where('encrypted_token', $this->base64UrlDecode(substr($token, strlen(self::INVITATION_PREFIX))))
            ->active()
            ->notExpired()
            ->first();
    }

    /**
     * Validate session for additional security
     *
     * @param RoomInvitation $invitation
     * @param string|null $sessionId
     * @return bool
     */
    public function validateSession(RoomInvitation $invitation, ?string $sessionId = null): bool
    {
        $currentSessionId = $sessionId ?? Session::getId();

        if ($invitation->session_id && $invitation->session_id !== $currentSessionId) {
            return false;
        }

        return true;
    }

    /**
     * Verify PIN for invitation
     *
     * @param RoomInvitation $invitation
     * @param string $pin
     * @return bool
     */
    public function verifyPin(RoomInvitation $invitation, string $pin): bool
    {
        if (!$invitation->canAttemptPin()) {
            return false;
        }

        if (hash_equals($invitation->pin, $pin)) {
            $invitation->resetPinAttempts();
            return true;
        }

        $invitation->incrementPinAttempts();
        return false;
    }

    /**
     * Generate invitation package for sharing
     *
     * @param RoomInvitation $invitation
     * @return array
     */
    public function generateInvitationPackage(RoomInvitation $invitation): array
    {
        return [
            'url' => $this->generateInvitationUrl($invitation),
            'pin' => $invitation->pin,
            'role' => $invitation->role,
            'room_name' => $invitation->room->name,
            'expires_at' => $invitation->expires_at->toISOString(),
            'email' => $invitation->email,
            'inviter' => $invitation->inviter->name
        ];
    }

    /**
     * Check if an ID is encrypted
     *
     * @param string $id
     * @return bool
     */
    public function isEncryptedId(string $id): bool
    {
        return str_starts_with($id, self::ROOM_ID_PREFIX);
    }

    /**
     * Check if token is invitation token
     *
     * @param string $token
     * @return bool
     */
    public function isInvitationToken(string $token): bool
    {
        return str_starts_with($token, self::INVITATION_PREFIX);
    }
}
