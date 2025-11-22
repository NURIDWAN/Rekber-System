<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\Transaction;

class TransactionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get some rooms with users
        $roomsWithUsers = Room::with(['users'])->whereHas('users')->get();

        if ($roomsWithUsers->isEmpty()) {
            $this->command->info('No rooms with users found. Skipping transaction seeding.');
            return;
        }

        foreach ($roomsWithUsers as $room) {
            $users = $room->users->groupBy('role');

            if ($users->has('buyer') && $users->has('seller')) {
                $buyer = $users['buyer']->first();
                $seller = $users['seller']->first();

                // Create a transaction for each room with both buyer and seller
                Transaction::create([
                    'room_id' => $room->id,
                    'buyer_id' => $buyer->id,
                    'seller_id' => $seller->id,
                    'amount' => rand(100000, 10000000) / 100, // Random amount between 1,000 and 100,000
                    'currency' => 'IDR',
                    'description' => 'Sample transaction for Room ' . $room->room_number,
                    'commission' => rand(100, 5000) / 100, // Random commission
                    'fee' => rand(50, 1000) / 100, // Random fee
                    'status' => $this->getRandomStatus(),
                    'payment_status' => rand(0, 1) ? 'verified' : 'pending',
                    'gm_user_id' => 1, // Assuming GM user with ID 1 exists
                ]);
            }
        }

        $this->command->info('Sample transactions created successfully.');
    }

    private function getRandomStatus(): string
    {
        $statuses = ['pending_payment', 'paid', 'shipped', 'delivered', 'completed', 'disputed'];
        return $statuses[array_rand($statuses)];
    }
}
