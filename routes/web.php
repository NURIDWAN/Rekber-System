<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use Laravel\Fortify\Http\Controllers\AuthenticatedSessionController;
use Laravel\Fortify\Http\Controllers\TwoFactorAuthenticatedSessionController;
use App\Http\Controllers\Web\RoomController as WebRoomController;
use App\Http\Controllers\Web\RoomJoinController as WebRoomJoinController;
use App\Http\Controllers\Web\RoomStatusController;
use App\Http\Controllers\Web\RoomPollingController;
use App\Http\Controllers\Web\GmController;
use App\Http\Controllers\UserVerificationController;
use App\Http\Controllers\Web\ApiShareLinksController;

$roomIdPattern = '(?:rm_[A-Za-z0-9_-]+|\d+)';
$tokenPattern = '[A-Za-z0-9_-]+';

Route::pattern('room', $roomIdPattern);

Route::get('/', function () {
    return Inertia::render('home');
})->name('home');

// Breeze tests expect these route names
// POST login for regular users (Fortify)
Route::post('/login', [AuthenticatedSessionController::class, 'store'])
    ->middleware(['guest', 'throttle:login'])
    ->name('login.store');

Route::get('/two-factor-challenge', [TwoFactorAuthenticatedSessionController::class, 'create'])
    ->middleware('guest')
    ->name('two-factor.login');

// Public Room Routes
Route::get('/rooms', [WebRoomController::class, 'index'])
    ->name('rooms');

Route::get('/rooms/{room}/join', [WebRoomController::class, 'joinForm'])
    ->name('rooms.join')
    ->middleware('decrypt.room');

Route::post('/rooms/{room}/join', [WebRoomController::class, 'join'])
    ->name('rooms.join.post')
    ->middleware('decrypt.room');

Route::get('/rooms/{room}', [WebRoomController::class, 'show'])
    ->name('rooms.show')
    ->middleware(['decrypt.room', 'room.multi.session']);

Route::post('/rooms/{room}/message', [WebRoomController::class, 'message'])
    ->name('rooms.message.post')
    ->middleware(['decrypt.room', 'room.multi.session']);

Route::post('/rooms/{room}/leave', [WebRoomController::class, 'leave'])
    ->name('rooms.leave.post')
    ->middleware(['decrypt.room', 'room.multi.session']);

Route::post('/rooms/{room}/upload', [WebRoomController::class, 'upload'])
    ->name('rooms.upload.post')
    ->middleware(['decrypt.room', 'room.multi.session']);

Route::get('/rooms/{room}/enter', [WebRoomJoinController::class, 'enter'])
    ->name('rooms.enter')
    ->middleware('decrypt.room');

// Direct token access without /join should redirect to the token join page
Route::get('/rooms/{token}', [WebRoomJoinController::class, 'tokenRedirect'])
    ->where('token', $tokenPattern)
    ->name('rooms.token.redirect');

// Encrypted Token Routes
Route::get('/rooms/{token}/join', [WebRoomJoinController::class, 'tokenJoin'])
    ->where('token', $tokenPattern)
    ->name('rooms.join.token');

Route::get('/rooms/{token}/enter', [WebRoomJoinController::class, 'tokenEnter'])
    ->where('token', $tokenPattern)
    ->name('rooms.enter.token');

// API Routes for Room Sharing
Route::get('/api/rooms/{room}/share-links', [WebRoomJoinController::class, 'shareLinks'])
    ->name('rooms.share-links')
    ->middleware('decrypt.room');

// API Route for Room Status (WebSocket fallback)
Route::get('/api/rooms/status', [RoomStatusController::class, 'index'])
    ->name('rooms.status');

// Dashboard routes for GM (authenticated users)
Route::middleware(['auth:gm'])->group(function () {
    Route::get('/gm/rooms', [GmController::class, 'rooms'])->name('gm.rooms');

    Route::get('dashboard', [GmController::class, 'dashboard'])->name('dashboard');

    Route::get('/room/{room}', [GmController::class, 'roomDetails'])->name('gm.room.details');

    // User Verification Management Routes
    Route::prefix('api/verifications')->group(function () {
        Route::get('/', [UserVerificationController::class, 'index']);
        Route::get('/stats', [UserVerificationController::class, 'stats']);
        Route::post('/{verification}/approve', [UserVerificationController::class, 'approve']);
        Route::post('/{verification}/reject', [UserVerificationController::class, 'reject']);
    });

    // User Verification Page
    Route::get('/verifications', [GmController::class, 'verifications'])->name('verifications.index');

    // Unified Transaction Management Page
    Route::get('/transactions', [GmController::class, 'transactions'])->name('transactions.index');

    // Transaction Detail Page
    Route::get('/transactions/{transaction}', [GmController::class, 'transactionDetail'])->name('transactions.show');

    // Legacy redirects for backwards compatibility
    Route::get('/verifications/transactions', function () {
        return redirect()->route('transactions.index');
    })->name('verifications.transactions.legacy');

    Route::get('/verifications/transactions/{transaction}', function (\App\Models\Transaction $transaction) {
        return redirect()->route('transactions.show', $transaction);
    })->name('verifications.transactions.show.legacy');
});

// WebSocket API Routes - Removed after cleanup
// WebSocket functionality has been consolidated to Multi-Session Manager

// API routes for token-based room access and share links
Route::post('/api/room/generate-share-links', [ApiShareLinksController::class, 'generateShareLinks']);

Route::prefix('api/room')->middleware(['room.token'])->group(function () {
    Route::post('/{token}/join-with-token', [App\Http\Controllers\Api\RoomJoinController::class, 'joinWithToken']);
    Route::post('/{token}/enter-with-token', [App\Http\Controllers\Api\RoomJoinController::class, 'enterWithToken']);
});

// Public route for users to submit verification requests
Route::middleware(['auth'])->group(function () {
    Route::post('/api/verifications', [App\Http\Controllers\UserVerificationController::class, 'store']);
});

// Invitation Routes
Route::pattern('token', 'inv_[A-Za-z0-9_-]+');

Route::prefix('rooms/invite')->group(function () {
    // Public invitation access
    Route::get('/{token}', [App\Http\Controllers\InvitationController::class, 'showInvitation'])
        ->name('rooms.invite.join')
        ->middleware(['throttle:10,1']);

    Route::post('/{token}', [App\Http\Controllers\InvitationController::class, 'joinRoom'])
        ->name('rooms.invite.join.post')
        ->middleware(['throttle:5,1']);

    Route::post('/{token}/verify-pin', [App\Http\Controllers\InvitationController::class, 'verifyPin'])
        ->name('rooms.invite.verify-pin')
        ->middleware(['throttle:20,1']);

    Route::get('/{token}/expired', [App\Http\Controllers\Web\InvitationController::class, 'expired'])
        ->name('rooms.invite.expired');
});

// Room Invitations Management (authenticated users only)
Route::middleware(['auth'])->prefix('rooms/{room}')->group(function () {
    Route::get('/invitations', [App\Http\Controllers\Web\InvitationController::class, 'index'])
        ->name('rooms.invitations');
});

// API Routes for invitation management (authenticated users only)
Route::middleware(['auth'])->prefix('api/rooms/{room}/invitations')->group(function () {
    Route::post('/', [App\Http\Controllers\InvitationController::class, 'create'])
        ->name('rooms.invitations.create')
        ->middleware('throttle:5,1');

    Route::get('/', [App\Http\Controllers\InvitationController::class, 'index'])
        ->name('rooms.invitations.index');

    Route::post('/{invitation}/revoke', [App\Http\Controllers\InvitationController::class, 'revoke'])
        ->name('rooms.invitations.revoke');

    Route::delete('/{invitation}', [App\Http\Controllers\InvitationController::class, 'destroy'])
        ->name('rooms.invitations.destroy');
});

require __DIR__ . '/settings.php';

// SSE streaming route for room messages
Route::get('/api/rooms/{room}/sse', [\App\Http\Controllers\SseController::class, 'streamRoom'])
    ->middleware(['throttle:60,1', 'decrypt.room'])
    ->name('rooms.sse');

// API Routes for Transaction and GM Management
Route::prefix('api')->group(function () {
    // Transaction Routes (for buyers/sellers)
    Route::middleware(['room.multi.session'])->group(function () {
        Route::get('/transactions/by-room/{room}', [\App\Http\Controllers\Api\TransactionController::class, 'getByRoomId']);
        Route::get('/transactions/{transaction}', [\App\Http\Controllers\Api\TransactionController::class, 'show']);
        Route::post('/transactions/{transaction}/upload-payment-proof', [\App\Http\Controllers\Api\TransactionController::class, 'uploadPaymentProof']);
        Route::post('/transactions/{transaction}/upload-shipping-receipt', [\App\Http\Controllers\Api\TransactionController::class, 'uploadShippingReceipt']);
        Route::post('/transactions/{transaction}/mark-delivered', [\App\Http\Controllers\Api\TransactionController::class, 'markAsDelivered']);
        Route::post('/transactions/{transaction}/dispute', [\App\Http\Controllers\Api\TransactionController::class, 'createDispute']);
        Route::get('/transactions/{transaction}/files', [\App\Http\Controllers\Api\TransactionController::class, 'getFiles']);
        Route::delete('/transactions/files/{file}', [\App\Http\Controllers\Api\TransactionController::class, 'deleteFile']);

        // Polling endpoint for room transaction updates
        Route::get('/rooms/{room}/polling-data', [RoomPollingController::class, 'pollingData']);
    });

    // GM Routes (for GM management)
    Route::middleware(['auth:gm'])->group(function () {
        Route::get('/gm/transactions/{transaction}', [\App\Http\Controllers\Api\GMController::class, 'getTransactionDetails']);
        Route::get('/gm/files/{file}', [\App\Http\Controllers\Api\GMController::class, 'getFileDetails']);
        Route::post('/gm/files/{file}/verify-payment', [\App\Http\Controllers\Api\GMController::class, 'verifyPaymentProof']);
        Route::post('/gm/files/{file}/verify-shipping', [\App\Http\Controllers\Api\GMController::class, 'verifyShippingReceipt']);
        Route::post('/gm/transactions/{transaction}/release-funds', [\App\Http\Controllers\Api\GMController::class, 'releaseFunds']);
        Route::put('/gm/transactions/{transaction}/notes', [\App\Http\Controllers\Api\GMController::class, 'updateNotes']);
    });

    // Global GM Routes (accessible via GM Auth or Room Session)
    Route::get('/gm/pending-transactions', [\App\Http\Controllers\Api\GMController::class, 'getPendingTransactions']);
    Route::get('/gm/pending-files', [\App\Http\Controllers\Api\GMController::class, 'getPendingFiles']);
});
