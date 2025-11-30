<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Room;

class RoomSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $rooms = [];

        for ($i = 1; $i <= 21; $i++) {
            $rooms[] = [
                'room_number' => $i,
                'status' => 'free',
                'created_at' => now(),
                'updated_at' => now(),
                'expires_at' => now()->addDays(3),
            ];
        }

        Room::insert($rooms);

        $this->command->info('Created 21 rooms successfully.');
    }
}
