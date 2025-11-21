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
        Schema::create('room_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('phone');
            $table->enum('role', ['buyer', 'seller']);
            $table->string('session_token')->unique();
            $table->timestamp('joined_at');
            $table->boolean('is_online')->default(true);
            $table->timestamp('last_seen')->nullable();
            $table->timestamps();

            $table->index(['room_id', 'role']);
            $table->index('session_token');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('room_users');
    }
};
