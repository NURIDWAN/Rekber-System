<?php

namespace Database\Factories;

use App\Models\Room;
use App\Models\RoomUser;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\RoomUser>
 */
class RoomUserFactory extends Factory
{
    protected $model = RoomUser::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'room_id' => Room::factory(),
            'name' => fake()->name(),
            'phone' => fake()->phoneNumber(),
            'role' => fake()->randomElement(['buyer', 'seller']),
            'session_token' => \Str::random(32),
            'joined_at' => now(),
            'is_online' => fake()->boolean(80), // 80% chance of being online
            'last_seen' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    /**
     * Indicate that the user is a buyer.
     */
    public function buyer(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'buyer',
        ]);
    }

    /**
     * Indicate that the user is a seller.
     */
    public function seller(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'seller',
        ]);
    }

    /**
     * Indicate that the user is online.
     */
    public function online(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_online' => true,
            'last_seen' => now(),
        ]);
    }

    /**
     * Indicate that the user is offline.
     */
    public function offline(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_online' => false,
            'last_seen' => fake()->dateTimeBetween('-1 hour', '-5 minutes'),
        ]);
    }

    /**
     * Create a user for a specific room.
     */
    public function forRoom(Room|int $room): static
    {
        return $this->state(fn (array $attributes) => [
            'room_id' => $room instanceof Room ? $room->id : $room,
        ]);
    }

    /**
     * Create a user with a specific session token.
     */
    public function withSessionToken(string $token): static
    {
        return $this->state(fn (array $attributes) => [
            'session_token' => $token,
        ]);
    }
}