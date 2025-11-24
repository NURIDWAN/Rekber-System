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
        Schema::table('transactions', function (Blueprint $table) {
            // Payment verification fields
            $table->unsignedBigInteger('payment_verified_by')->nullable();
            $table->timestamp('payment_verified_at')->nullable();
            $table->text('payment_rejection_reason')->nullable();

            // Shipping verification fields
            $table->unsignedBigInteger('shipping_verified_by')->nullable();
            $table->timestamp('shipping_verified_at')->nullable();
            $table->text('shipping_rejection_reason')->nullable();

            // Fund release fields
            $table->unsignedBigInteger('funds_released_by')->nullable();
            $table->timestamp('funds_released_at')->nullable();

            // Upload tracking fields
            $table->timestamp('payment_proof_uploaded_at')->nullable();
            $table->unsignedBigInteger('payment_proof_uploaded_by')->nullable();
            $table->timestamp('shipping_receipt_uploaded_at')->nullable();
            $table->unsignedBigInteger('shipping_receipt_uploaded_by')->nullable();

            // Foreign keys
            $table->foreign('payment_verified_by')->references('id')->on('gm_users')->onDelete('set null');
            $table->foreign('shipping_verified_by')->references('id')->on('gm_users')->onDelete('set null');
            $table->foreign('funds_released_by')->references('id')->on('gm_users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            // Drop foreign key constraints first
            $table->dropForeign(['payment_verified_by']);
            $table->dropForeign(['shipping_verified_by']);
            $table->dropForeign(['funds_released_by']);

            // Drop columns
            $table->dropColumn([
                'payment_verified_by',
                'payment_verified_at',
                'payment_rejection_reason',
                'shipping_verified_by',
                'shipping_verified_at',
                'shipping_rejection_reason',
                'funds_released_by',
                'funds_released_at',
                'payment_proof_uploaded_at',
                'payment_proof_uploaded_by',
                'shipping_receipt_uploaded_at',
                'shipping_receipt_uploaded_by',
            ]);
        });
    }
};