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
        // Update the status enum to include all necessary statuses
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE rooms MODIFY COLUMN status ENUM('free', 'in_use', 'payment_pending', 'payment_verified', 'payment_rejected', 'shipped', 'goods_received', 'completed') NOT NULL DEFAULT 'free'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert to original statuses (be careful as this might truncate data if not handled)
        // For safety, we keep the new statuses in down() or we could try to map them back if needed.
        // But usually down() should strictly revert. Since we can't easily map 'goods_received' back to 'in_use' without data loss,
        // we will just revert the definition but this will fail if there are rows with new statuses.
        // A better approach for down is to do nothing or warn.
        // However, for this specific task, we just need to ensure up() works.

        // Attempt to revert to original, but this will fail if data exists.
        // DB::statement("ALTER TABLE rooms MODIFY COLUMN status ENUM('free', 'in_use') NOT NULL DEFAULT 'free'");
    }
};
