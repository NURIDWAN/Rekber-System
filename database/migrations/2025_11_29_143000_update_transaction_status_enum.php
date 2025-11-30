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
        // Update the status enum to include all necessary statuses
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE transactions MODIFY COLUMN status ENUM('pending_payment', 'awaiting_payment_verification', 'paid', 'awaiting_shipping_verification', 'shipped', 'goods_received', 'delivered', 'completed', 'disputed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending_payment'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert to original statuses
        // DB::statement("ALTER TABLE transactions MODIFY COLUMN status ENUM('pending_payment', 'awaiting_payment_verification', 'paid', 'awaiting_shipping_verification', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending_payment'");
    }
};
