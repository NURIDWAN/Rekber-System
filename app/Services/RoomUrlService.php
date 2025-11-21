<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Carbon\Carbon;
use Illuminate\Support\Str;

class RoomUrlService
{
    /**
     * Token expiry time in minutes
     */
    const TOKEN_EXPIRY_MINUTES = 5;

    /**
     * Generate encrypted token for room access
     *
     * @param int $roomId
     * @param string $role (buyer|seller)
     * @return string
     */
    public function generateToken(int $roomId, string $role): string
    {
        $timestamp = now()->timestamp;
        $randomKey = Str::random(16);

        $payload = [
            'room_id' => $roomId,
            'role' => $role,
            'timestamp' => $timestamp,
            'random_key' => $randomKey,
            'hash' => hash('sha256', $roomId . $role . $timestamp . $randomKey)
        ];

        return Crypt::encryptString(json_encode($payload));
    }

    /**
     * Decrypt and validate token
     *
     * @param string $token
     * @return array|null
     */
    public function decryptToken(string $token): ?array
    {
        try {
            $decrypted = Crypt::decryptString($token);
            $payload = json_decode($decrypted, true);

            if (!$payload || !isset($payload['room_id'], $payload['role'], $payload['timestamp'], $payload['hash'])) {
                return null;
            }

            // Verify hash
            $expectedHash = hash('sha256',
                $payload['room_id'] .
                $payload['role'] .
                $payload['timestamp'] .
                $payload['random_key']
            );

            if (!hash_equals($expectedHash, $payload['hash'])) {
                return null;
            }

            // Check token expiry
            $tokenTime = Carbon::createFromTimestamp($payload['timestamp']);
            if ($tokenTime->diffInMinutes(now()) > self::TOKEN_EXPIRY_MINUTES) {
                return null;
            }

            // Validate role
            if (!in_array($payload['role'], ['buyer', 'seller'])) {
                return null;
            }

            return [
                'room_id' => (int) $payload['room_id'],
                'role' => $payload['role'],
                'timestamp' => $payload['timestamp']
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
    public function generateJoinUrl(int $roomId, string $role): string
    {
        $token = $this->generateToken($roomId, $role);
        return route('rooms.join.token', ['token' => $token]);
    }

    /**
     * Generate enter URL for room
     *
     * @param int $roomId
     * @param string $role
     * @return string
     */
    public function generateEnterUrl(int $roomId, string $role): string
    {
        $token = $this->generateToken($roomId, $role);
        return route('rooms.enter.token', ['token' => $token]);
    }

    /**
     * Generate shareable links for both buyer and seller
     *
     * @param int $roomId
     * @return array
     */
    public function generateShareableLinks(int $roomId): array
    {
        return [
            'buyer' => [
                'join' => $this->generateJoinUrl($roomId, 'buyer'),
                'enter' => $this->generateEnterUrl($roomId, 'buyer')
            ],
            'seller' => [
                'join' => $this->generateJoinUrl($roomId, 'seller'),
                'enter' => $this->generateEnterUrl($roomId, 'seller')
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
}