<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE room_users MODIFY COLUMN role ENUM('buyer', 'seller', 'gm') NOT NULL");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Warning: This might fail if there are 'gm' roles in the database
        DB::statement("ALTER TABLE room_users MODIFY COLUMN role ENUM('buyer', 'seller') NOT NULL");
    }
};
