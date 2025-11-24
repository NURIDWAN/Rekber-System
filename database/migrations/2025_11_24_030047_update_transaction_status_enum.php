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
        // We need to use raw SQL to update the enum column because Doctrine DBAL has issues with enums sometimes
        // and we want to append values.
        DB::statement("ALTER TABLE transactions MODIFY COLUMN status ENUM(
            'pending_payment', 
            'awaiting_payment_verification',
            'paid', 
            'awaiting_shipping_verification',
            'shipped', 
            'delivered', 
            'completed', 
            'disputed', 
            'cancelled', 
            'refunded'
        ) NOT NULL DEFAULT 'pending_payment'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert back to original enum values
        // WARNING: This might fail if there are records with the new statuses
        DB::statement("ALTER TABLE transactions MODIFY COLUMN status ENUM(
            'pending_payment', 
            'paid', 
            'shipped', 
            'delivered', 
            'completed', 
            'disputed', 
            'cancelled', 
            'refunded'
        ) NOT NULL DEFAULT 'pending_payment'");
    }
};
