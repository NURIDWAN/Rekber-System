<?php

namespace Database\Factories;

use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Room>
 */
class RoomFactory extends Factory
{
    protected $model = Room::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'room_number' => fake()->unique()->numberBetween(100, 999),
            'status' => fake()->randomElement(['free', 'in_use']),
            'created_at' => now(),
            'updated_at' => now(),
            'expires_at' => now()->addDays(3),
        ];
    }

    /**
     * Indicate that the room is free.
     */
    public function free(): static
    {
        return $this->state(fn(array $attributes) => [
            'status' => 'free',
        ]);
    }

    /**
     * Indicate that the room is in use.
     */
    public function inUse(): static
    {
        return $this->state(fn(array $attributes) => [
            'status' => 'in_use',
        ]);
    }

    /**
     * Create a room with specific room number.
     */
    public function withRoomNumber(int $roomNumber): static
    {
        return $this->state(fn(array $attributes) => [
            'room_number' => $roomNumber,
        ]);
    }
}