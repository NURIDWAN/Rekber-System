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
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->onDelete('cascade');
            $table->foreignId('buyer_id')->nullable()->constrained('room_users')->onDelete('set null');
            $table->foreignId('seller_id')->nullable()->constrained('room_users')->onDelete('set null');
            $table->string('transaction_number')->unique();
            $table->decimal('amount', 15, 2);
            $table->string('currency', 3)->default('IDR');
            $table->enum('status', [
                'pending_payment', 'paid', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled', 'refunded'
            ])->default('pending_payment');
            $table->enum('payment_status', ['pending', 'verified', 'failed'])->default('pending');
            $table->text('description')->nullable();
            $table->text('buyer_notes')->nullable();
            $table->text('seller_notes')->nullable();
            $table->text('gm_notes')->nullable();
            $table->decimal('commission', 15, 2)->default(0);
            $table->decimal('fee', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2);
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('gm_user_id')->nullable()->constrained('gm_users')->onDelete('set null');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['room_id', 'status']);
            $table->index(['transaction_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
