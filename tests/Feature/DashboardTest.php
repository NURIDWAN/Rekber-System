<?php

namespace Tests\Feature;

use App\Models\GmUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $this->get(route('dashboard'))->assertRedirect(route('login'));
    }

    public function test_authenticated_users_can_visit_the_dashboard()
    {
        $gmUser = GmUser::factory()->create([
            'email_verified_at' => now(),
        ]);

        $this->actingAs($gmUser, 'gm')
            ->get(route('dashboard'))
            ->assertOk();
    }
}
