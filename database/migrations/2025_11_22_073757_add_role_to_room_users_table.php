<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('room_users', function (Blueprint $table) {
            // Add invitation_token column (role already exists)
            $table->string('invitation_token')->nullable()->after('role');
            $table->index('invitation_token');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('room_users', function (Blueprint $table) {
            $table->dropIndex(['invitation_token']);
            $table->dropColumn(['invitation_token']);
        });
    }
};
