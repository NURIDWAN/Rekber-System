<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Services\RoomUrlService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class RoomExpiryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake();
    }

    public function test_room_creation_sets_default_expiry()
    {
        $room = Room::factory()->create();

        $this->assertNotNull($room->expires_at);
        // Should be roughly 3 days from now
        $this->assertEqualsWithDelta(now()->addDays(3)->timestamp, $room->expires_at->timestamp, 5);
    }

    public function test_expired_room_cannot_be_accessed_via_token()
    {
        $room = Room::factory()->create([
            'expires_at' => now()->subDay(), // Expired yesterday
        ]);

        $token = app(RoomUrlService::class)->generateToken($room->id, 'buyer');

        $response = $this->get("/rooms/{$token}/join");

        $response->assertStatus(410); // Gone/Expired
    }

    public function test_room_can_be_extended()
    {
        $room = Room::factory()->create([
            'expires_at' => now()->addDay(),
        ]);

        $originalExpiry = $room->expires_at;

        $response = $this->withoutMiddleware()->post("/rooms/{$room->id}/extend");

        $response->assertRedirect();
        $room->refresh();

        // Should be extended by 1 day
        $this->assertEqualsWithDelta($originalExpiry->addDay()->timestamp, $room->expires_at->timestamp, 5);
    }

    public function test_expired_room_can_be_extended_from_now()
    {
        $room = Room::factory()->create([
            'expires_at' => now()->subDay(), // Expired
        ]);

        $response = $this->withoutMiddleware()->post("/rooms/{$room->id}/extend");

        $room->refresh();

        // Should be extended to 1 day from NOW, not from old expiry
        $this->assertEqualsWithDelta(now()->addDay()->timestamp, $room->expires_at->timestamp, 5);
    }
}
