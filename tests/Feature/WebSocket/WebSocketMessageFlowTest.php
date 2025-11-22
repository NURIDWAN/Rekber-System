<?php

namespace Tests\Feature\WebSocket;

use App\Models\Room;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Tests\TestCase;

class WebSocketMessageFlowTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();

        // Disable external Pusher calls during test run
        putenv('PUSHER_APP_KEY=');
        putenv('PUSHER_APP_SECRET=');
        putenv('PUSHER_APP_ID=');
    }

    /** @test */
    public function it_sends_and_retrieves_text_message_via_websocket_api()
    {
        $room = Room::factory()->create();

        $payload = [
            'message' => 'Hello from buyer',
            'type' => 'text', // legacy UI type, allowed in controller
            'user_id' => 'buyer-raka',
            'data' => [
                'sender_role' => 'buyer',
                'sender_name' => 'Raka',
                'message_type' => 'text',
            ],
        ];

        $response = $this->postJson("/api/websocket/rooms/{$room->id}/messages", $payload);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'message' => [
                'room_id' => (string) $room->id,
                'message' => 'Hello from buyer',
                'type' => 'text',
            ],
        ]);

        // Verify the message is retrievable via the API
        $list = $this->getJson("/api/websocket/rooms/{$room->id}/messages");
        $list->assertStatus(200);
        $list->assertJson([
            'success' => true,
            'total' => 1,
        ]);

        $this->assertEquals('Hello from buyer', $list->json('messages.0.message'));
    }
}
