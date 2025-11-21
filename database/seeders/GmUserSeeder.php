<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\GmUser;

class GmUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        GmUser::create([
            'name' => 'Game Master',
            'email' => 'gm@rekber.com',
            'password' => 'password123',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->command->info('Created GM user successfully.');
        $this->command->info('Email: gm@rekber.com');
        $this->command->info('Password: password123');
    }
}
