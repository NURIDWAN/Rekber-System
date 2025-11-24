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
            // Remove unique constraint from session_token to allow multiple sessions
            $table->dropUnique('room_users_session_token_unique');

            // Add new fields for multi-session support
            $table->string('user_identifier')->nullable()->after('id');
            $table->string('device_fingerprint')->nullable()->after('user_identifier');
            $table->json('session_context')->nullable()->after('device_fingerprint');
            $table->timestamp('migrated_at')->nullable()->after('updated_at');
            $table->timestamp('offline_at')->nullable()->after('last_seen');

            // Add composite indexes for efficient multi-session queries
            $table->index(['user_identifier', 'is_online'], 'idx_user_sessions');
            $table->index(['room_id', 'user_identifier'], 'idx_room_user_sessions');
            $table->index(['session_token', 'user_identifier'], 'idx_token_user_mapping');
        });

        // Set user_identifier for existing records using session_token as base
        \DB::statement("
            UPDATE room_users
            SET user_identifier = CONCAT('legacy_user_', SUBSTRING(session_token, 1, 16), '_', UNIX_TIMESTAMP(created_at))
            WHERE user_identifier IS NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('room_users', function (Blueprint $table) {
            // Restore unique constraint
            $table->unique('session_token');

            // Remove new fields
            $table->dropColumn('user_identifier');
            $table->dropColumn('device_fingerprint');
            $table->dropColumn('session_context');
            $table->dropColumn('migrated_at');
            $table->dropColumn('offline_at');

            // Drop indexes
            $table->dropIndex('idx_user_sessions');
            $table->dropIndex('idx_room_user_sessions');
            $table->dropIndex('idx_token_user_mapping');
        });
    }
};