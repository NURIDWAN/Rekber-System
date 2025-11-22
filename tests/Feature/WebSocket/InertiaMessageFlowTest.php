<?php

namespace Tests\Feature\WebSocket;

use App\Events\RoomMessageSent;
use App\Models\Room;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class InertiaMessageFlowTest extends TestCase
{
    use DatabaseMigrations;

    /** @test */
    public function it_sends_message_via_inertia_route_and_broadcasts_event()
    {
        Event::fake([RoomMessageSent::class]);

        $room = Room::factory()->create();

        // Simulate a user in the room with a session cookie
        $sessionToken = 'test_session_token';
        $room->users()->create([
            'name' => 'Buyer',
            'phone' => '1234567890',
            'role' => 'buyer',
            'session_token' => $sessionToken,
            'is_online' => true,
        ]);

        // Send message through the Inertia route
        $response = $this->withCookie('room_session_' . $room->id, $sessionToken)
            ->post("/rooms/{$room->id}/message", [
                'message' => 'Hello via Inertia',
                'type' => 'text',
            ]);

        $response->assertRedirect(); // Route redirects back

        // Message should be stored in DB
        $this->assertDatabaseHas('room_messages', [
            'room_id' => $room->id,
            'message' => 'Hello via Inertia',
            'type' => 'text',
        ]);

        // Event should be dispatched for Pusher listeners
        Event::assertDispatched(RoomMessageSent::class, function ($event) use ($room) {
            return $event->message->room_id === $room->id;
        });
    }
}
