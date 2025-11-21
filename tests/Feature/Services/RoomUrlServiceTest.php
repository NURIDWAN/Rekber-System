<?php

namespace Tests\Feature\Services;

use App\Services\RoomUrlService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use Carbon\Carbon;

class RoomUrlServiceTest extends TestCase
{
    private RoomUrlService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new RoomUrlService();
    }

    /**
     * Test token generation for buyer
     */
    public function test_generate_token_for_buyer(): void
    {
        $roomId = 1;
        $role = 'buyer';

        $token = $this->service->generateToken($roomId, $role);

        $this->assertIsString($token);
        $this->assertNotEmpty($token);

        // Verify it's a valid encrypted string
        $this->assertStringStartsWith('eyJ', $token);
    }

    /**
     * Test token generation for seller
     */
    public function test_generate_token_for_seller(): void
    {
        $roomId = 2;
        $role = 'seller';

        $token = $this->service->generateToken($roomId, $role);

        $this->assertIsString($token);
        $this->assertNotEmpty($token);

        // Verify it's a valid encrypted string
        $this->assertStringStartsWith('eyJ', $token);
    }

    /**
     * Test token decryption works correctly
     */
    public function test_decrypt_valid_token(): void
    {
        $roomId = 5;
        $role = 'buyer';

        $token = $this->service->generateToken($roomId, $role);
        $decrypted = $this->service->decryptToken($token);

        $this->assertIsArray($decrypted);
        $this->assertArrayHasKey('room_id', $decrypted);
        $this->assertArrayHasKey('role', $decrypted);
        $this->assertArrayHasKey('timestamp', $decrypted);

        $this->assertEquals($roomId, $decrypted['room_id']);
        $this->assertEquals($role, $decrypted['role']);
        $this->assertIsInt($decrypted['timestamp']);
    }

    /**
     * Test token decryption fails with invalid token
     */
    public function test_decrypt_invalid_token(): void
    {
        $invalidToken = 'invalid.token.string';

        $result = $this->service->decryptToken($invalidToken);

        $this->assertNull($result);
    }

    /**
     * Test token decryption fails with empty token
     */
    public function test_decrypt_empty_token(): void
    {
        $result = $this->service->decryptToken('');

        $this->assertNull($result);
    }

    /**
     * Test token expiry validation
     */
    public function test_token_expiry(): void
    {
        $roomId = 1;
        $role = 'buyer';

        $token = $this->service->generateToken($roomId, $role);
        $decrypted = $this->service->decryptToken($token);

        // Token should be valid immediately
        $this->assertNotNull($decrypted);

        // Test the isTokenExpired method
        $this->assertFalse($this->service->isTokenExpired($decrypted['timestamp']));

        // Test with expired timestamp (6 minutes ago)
        $expiredTimestamp = now()->subMinutes(6)->timestamp;
        $this->assertTrue($this->service->isTokenExpired($expiredTimestamp));
    }

    /**
     * Test generateJoinUrl method
     */
    public function test_generate_join_url(): void
    {
        $roomId = 10;
        $role = 'seller';

        $url = $this->service->generateJoinUrl($roomId, $role);

        $this->assertIsString($url);
        $this->assertStringContainsString('rooms/', $url);
        $this->assertStringContainsString('/join', $url);
    }

    /**
     * Test generateEnterUrl method
     */
    public function test_generate_enter_url(): void
    {
        $roomId = 15;
        $role = 'buyer';

        $url = $this->service->generateEnterUrl($roomId, $role);

        $this->assertIsString($url);
        $this->assertStringContainsString('rooms/', $url);
        $this->assertStringContainsString('/enter', $url);
    }

    /**
     * Test generateShareableLinks method
     */
    public function test_generate_shareable_links(): void
    {
        $roomId = 20;

        $links = $this->service->generateShareableLinks($roomId);

        $this->assertIsArray($links);
        $this->assertArrayHasKey('buyer', $links);
        $this->assertArrayHasKey('seller', $links);

        // Test buyer links
        $this->assertArrayHasKey('join', $links['buyer']);
        $this->assertArrayHasKey('enter', $links['buyer']);
        $this->assertIsString($links['buyer']['join']);
        $this->assertIsString($links['buyer']['enter']);

        // Test seller links
        $this->assertArrayHasKey('join', $links['seller']);
        $this->assertArrayHasKey('enter', $links['seller']);
        $this->assertIsString($links['seller']['join']);
        $this->assertIsString($links['seller']['enter']);

        // Verify URLs contain expected paths
        $this->assertStringContainsString('/join', $links['buyer']['join']);
        $this->assertStringContainsString('/enter', $links['buyer']['enter']);
        $this->assertStringContainsString('/join', $links['seller']['join']);
        $this->assertStringContainsString('/enter', $links['seller']['enter']);
    }

    /**
     * Test invalid role in token generation
     */
    public function test_invalid_role_token_generation(): void
    {
        $roomId = 1;
        $invalidRole = 'invalid_role';

        // Even with invalid role, token should be generated (validation happens elsewhere)
        $token = $this->service->generateToken($roomId, $invalidRole);
        $this->assertIsString($token);

        // But decryption should filter out invalid roles
        $decrypted = $this->service->decryptToken($token);
        $this->assertNull($decrypted);
    }

    /**
     * Test token uniqueness
     */
    public function test_token_uniqueness(): void
    {
        $roomId = 1;
        $role = 'buyer';

        // Generate multiple tokens
        $token1 = $this->service->generateToken($roomId, $role);
        $token2 = $this->service->generateToken($roomId, $role);

        // Tokens should be different due to random key and timestamp
        $this->assertNotEquals($token1, $token2);
    }
}
