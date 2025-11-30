<?php

namespace Tests\Feature;

use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Inertia\Testing\AssertableInertia as Assert;

class PinModalTest extends TestCase
{
    use RefreshDatabase;

    public function test_join_page_receives_pin_enabled_flag()
    {
        $room = Room::factory()->create([
            'pin_enabled' => true,
            'pin' => '123456',
            'status' => 'free'
        ]);

        $response = $this->get(route('rooms.join', $room));

        $response->assertStatus(200);
        $response->assertInertia(
            fn(Assert $page) => $page
                ->component('rooms/[id]/join')
                ->has(
                    'share_links',
                    fn(Assert $json) => $json
                        ->where('pin_enabled', true)
                        ->etc()
                )
        );
    }

    public function test_join_page_receives_pin_disabled_flag()
    {
        $room = Room::factory()->create([
            'pin_enabled' => false,
            'pin' => null,
            'status' => 'free'
        ]);

        $response = $this->get(route('rooms.join', $room));

        $response->assertStatus(200);
        $response->assertInertia(
            fn(Assert $page) => $page
                ->component('rooms/[id]/join')
                ->has(
                    'share_links',
                    fn(Assert $json) => $json
                        ->where('pin_enabled', false)
                        ->etc()
                )
        );
    }
}
