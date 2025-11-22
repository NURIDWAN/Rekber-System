<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use Laravel\Fortify\Http\Controllers\AuthenticatedSessionController;
use Laravel\Fortify\Http\Controllers\TwoFactorAuthenticatedSessionController;

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
Route::get('/rooms', function () {
    $rooms = \App\Models\Room::with(['users' => function($query) {
        $query->select('id', 'room_id', 'name', 'role', 'is_online');
    }])
    ->orderBy('room_number')
    ->get()
    ->map(function ($room) {
        $shareLinks = app(\App\Services\RoomUrlService::class)->generateShareableLinks($room->id);
        $participants = [];
        if ($room->hasBuyer()) {
            $participants[] = 'Buyer';
        }
        if ($room->hasSeller()) {
            $participants[] = 'Seller';
        }
        $participants[] = 'GM';

        $roomUrlService = app(\App\Services\RoomUrlService::class);

        return [
            'id' => $room->id,
            'room_number' => $room->room_number,
            'status' => $room->status === 'in_use' ? 'in-use' : $room->status,
            'has_buyer' => $room->hasBuyer(),
            'has_seller' => $room->hasSeller(),
            'buyer_name' => $room->users()->where('role', 'buyer')->first()?->name,
            'seller_name' => $room->users()->where('role', 'seller')->first()?->name,
            'buyer_online' => $room->users()->where('role', 'buyer')->where('is_online', true)->exists(),
            'seller_online' => $room->users()->where('role', 'seller')->where('is_online', true)->exists(),
            'available_for_buyer' => $room->isAvailableForBuyer(),
            'available_for_seller' => $room->isAvailableForSeller(),
            'participants' => $participants,
            'links' => $shareLinks,
            'encrypted_urls' => [
                'show' => $roomUrlService->generateRoomUrl($room->id),
                'join' => $roomUrlService->generateRoomJoinUrl($room->id, 'buyer'),
                'join_seller' => $roomUrlService->generateRoomJoinUrl($room->id, 'seller'),
            ],
        ];
    });

    return Inertia::render('rooms', [
        'rooms' => $rooms
    ]);
})->name('rooms');

Route::get('/rooms/{room}/join', function ($room) {
    $roomModel = \App\Models\Room::findOrFail($room);
    return Inertia::render('rooms/[id]/join', [
        'room' => [
            'id' => $roomModel->id,
            'room_number' => $roomModel->room_number,
            'status' => $roomModel->status,
            'has_buyer' => $roomModel->hasBuyer(),
            'has_seller' => $roomModel->hasSeller(),
            'buyer_name' => $roomModel->users()->where('role', 'buyer')->first()?->name,
            'seller_name' => $roomModel->users()->where('role', 'seller')->first()?->name,
        ],
        'role' => request()->get('role', 'buyer')
            ,
        'share_links' => app(\App\Services\RoomUrlService::class)->generateShareableLinks($roomModel->id)
    ]);
})->name('rooms.join')->middleware('decrypt.room');

Route::post('/rooms/{room}/join', function ($room) {
    $validated = request()->validate([
        'name' => 'required|string|max:255',
        'phone' => 'required|string|max:20',
    ]);

    $roomModel = \App\Models\Room::findOrFail($room);
    $role = request()->get('role', 'buyer');

    // Check if room is available
    if ($role === 'buyer' && !$roomModel->isAvailableForBuyer()) {
        return back()->withErrors(['general' => 'Room is not available for buyer']);
    }
    if ($role === 'seller' && !$roomModel->isAvailableForSeller()) {
        return back()->withErrors(['general' => 'Room is not available for seller']);
    }

    // Check if user is already in another room
    $existingSession = request()->cookie('room_session_token');
    if ($existingSession) {
        $existingUser = \App\Models\RoomUser::where('session_token', $existingSession)->first();
        if ($existingUser) {
            return back()->withErrors(['general' => 'You are already in another room']);
        }
    }

    // Create room user
    $sessionToken = \Illuminate\Support\Str::random(32);

    \Log::info('Creating room user', [
        'room_id' => $roomModel->id,
        'name' => $validated['name'],
        'role' => $role,
        'session_token' => substr($sessionToken, 0, 8) . '...',
        'cookie_name' => 'room_session_' . $roomModel->id
    ]);

    $roomUser = \App\Models\RoomUser::create([
        'room_id' => $roomModel->id,
        'name' => $validated['name'],
        'phone' => $validated['phone'],
        'role' => $role,
        'session_token' => $sessionToken,
        'joined_at' => now(),
        'is_online' => true,
        'last_seen' => now(),
    ]);

    // Update room status
    if ($roomModel->status === 'free') {
        $roomModel->status = 'in_use';
        $roomModel->save();
    }

    // Log activity
    $activityLog = \App\Models\RoomActivityLog::create([
        'room_id' => $roomModel->id,
        'action' => $role . '_joined',
        'user_name' => $validated['name'],
        'role' => $role,
        'description' => ucfirst($role) . ' joined the room',
        'timestamp' => now(),
    ]);

    // Broadcast activity
    broadcast(new \App\Events\RoomActivityLogged($activityLog))->toOthers();

    $cookie = cookie('room_session_' . $roomModel->id, $sessionToken, 120 * 60);

    $roomUrlService = app(\App\Services\RoomUrlService::class);
    $encryptedRoomId = $roomUrlService->encryptRoomId($roomModel->id);

    return redirect()
        ->route('rooms.show', ['room' => $encryptedRoomId])
        ->cookie($cookie);
})->name('rooms.join.post')->middleware('decrypt.room');

Route::get('/rooms/{room}', function ($room) {
    $roomModel = \App\Models\Room::with(['users' => function($query) {
        $query->where('is_online', true);
    }, 'messages' => function ($query) {
        $query->ordered()->limit(50);
    }])->findOrFail($room);

    // Check if user has session
    $sessionToken = request()->cookie('room_session_' . $room);
    $roomUser = null;

    // Debug: Log session lookup
    \Log::info('Room session check', [
        'room_id' => $room,
        'cookie_name' => 'room_session_' . $room,
        'session_token' => $sessionToken ? 'exists' : 'missing',
        'all_cookies' => array_keys(request()->cookie())
    ]);

    if ($sessionToken) {
        $roomUser = \App\Models\RoomUser::where('room_id', $room)
                                     ->where('session_token', $sessionToken)
                                     ->first();

        \Log::info('Room user lookup result', [
            'room_id' => $room,
            'found_user' => $roomUser ? 'yes' : 'no',
            'user_details' => $roomUser ? [
                'name' => $roomUser->name,
                'role' => $roomUser->role,
                'is_online' => $roomUser->is_online
            ] : null
        ]);
    }

    if (!$roomUser) {
        \Log::info('No valid session found, redirecting to join', ['room_id' => $room]);
        $roomUrlService = app(\App\Services\RoomUrlService::class);
        $encryptedRoomId = request('encrypted_room_id') ?: $roomUrlService->encryptRoomId($room);
        return redirect()->route('rooms.join', ['room' => $encryptedRoomId]);
    }

    // Get buyer and seller data
    $buyer = $roomModel->users()->where('role', 'buyer')->first();
    $seller = $roomModel->users()->where('role', 'seller')->first();

    $roomUrlService = app(\App\Services\RoomUrlService::class);
    $encryptedRoomId = request('encrypted_room_id') ?: $roomUrlService->encryptRoomId($roomModel->id);

    return Inertia::render('rooms/[id]/index', [
        'room' => [
            'id' => $roomModel->id,
            'room_number' => $roomModel->room_number,
            'status' => $roomModel->status,
            'buyer' => $buyer ? [
                'name' => $buyer->name,
                'is_online' => $buyer->is_online,
                'joined_at' => $buyer->joined_at,
            ] : null,
            'seller' => $seller ? [
                'name' => $seller->name,
                'is_online' => $seller->is_online,
                'joined_at' => $seller->joined_at,
            ] : null,
            'messages' => $roomModel->messages->map(function ($message) {
                return [
                    'id' => $message->id,
                    'sender_role' => $message->sender_role,
                    'sender_name' => $message->sender_name,
                    'message' => $message->message,
                    'type' => $message->type,
                    'created_at' => $message->created_at,
                ];
            }),
        ],
        'currentUser' => [
            'role' => $roomUser->role,
            'name' => $roomUser->name,
            'is_online' => $roomUser->is_online,
        ],
        'share_links' => $roomUrlService->generateShareableLinks($roomModel->id),
        'encrypted_room_id' => $encryptedRoomId,
    ]);
})->name('rooms.show')->middleware('decrypt.room');

Route::post('/rooms/{room}/message', function ($room) {
    $validated = request()->validate([
        'message' => 'required|string|max:2000',
        'type' => ['required', 'in:text,image'],
    ]);

    // Validate room session
    $sessionToken = request()->cookie('room_session_' . $room);
    if (!$sessionToken) {
        return back()->withErrors(['message' => 'Unauthorized']);
    }

    $roomUser = \App\Models\RoomUser::where('room_id', $room)
        ->where('session_token', $sessionToken)
        ->first();

    if (!$roomUser) {
        return back()->withErrors(['message' => 'Unauthorized for this room']);
    }

    $roomModel = \App\Models\Room::findOrFail($room);

    // Create message
    $message = \App\Models\RoomMessage::create([
        'room_id' => $room,
        'sender_role' => $roomUser->role,
        'sender_name' => $roomUser->name,
        'message' => $validated['message'],
        'type' => $validated['type'],
        'created_at' => now(),
    ]);

    // Log activity
    \App\Models\RoomActivityLog::create([
        'room_id' => $roomModel->id,
        'action' => 'message_sent',
        'user_name' => $roomUser->name,
        'role' => $roomUser->role,
        'description' => 'Sent a ' . $validated['type'] . ' message',
        'timestamp' => now(),
    ]);

    // Dispatch message event for broadcasting listeners (captured in tests)
    \Illuminate\Support\Facades\Event::dispatch(new \App\Events\RoomMessageSent($message));

    return back();
})->name('rooms.message.post')->middleware('decrypt.room');

Route::post('/rooms/{room}/leave', function ($room) {
    // Validate room session
    $sessionToken = request()->cookie('room_session_' . $room);
    if (!$sessionToken) {
        return redirect('/rooms');
    }

    $roomUser = \App\Models\RoomUser::where('room_id', $room)
        ->where('session_token', $sessionToken)
        ->first();

    if (!$roomUser) {
        return redirect('/rooms');
    }

    $roomModel = \App\Models\Room::findOrFail($room);

    // Log activity
    \App\Models\RoomActivityLog::create([
        'room_id' => $roomModel->id,
        'action' => 'user_left',
        'user_name' => $roomUser->name,
        'role' => $roomUser->role,
        'description' => $roomUser->role . ' left the room',
        'timestamp' => now(),
    ]);

    // Delete room user
    $roomUser->delete();

    // Check if room is now empty and reset status
    if ($roomModel->users()->count() === 0) {
        $roomModel->status = 'free';
        $roomModel->save();
    }

    // Clear session cookie
    $cookie = cookie('room_session_' . $room, '', -1, '/');

    return redirect('/rooms')->cookie($cookie);
})->name('rooms.leave.post')->middleware('decrypt.room');

Route::post('/rooms/{room}/upload', function ($room) {
    $validated = request()->validate([
        'file' => 'required|file|image|max:5120', // 5MB max
        'file_type' => ['required', 'in:payment_proof,shipping_receipt'],
    ]);

    // Validate room session
    $sessionToken = request()->cookie('room_session_' . $room);
    if (!$sessionToken) {
        return back()->withErrors(['file' => 'Unauthorized']);
    }

    $roomUser = \App\Models\RoomUser::where('room_id', $room)
        ->where('session_token', $sessionToken)
        ->first();

    if (!$roomUser) {
        return back()->withErrors(['file' => 'Unauthorized for this room']);
    }

    $roomModel = \App\Models\Room::findOrFail($room);

    // Upload file
    $file = request()->file('file');
    $filename = time() . '_' . \Illuminate\Support\Str::random(10) . '.' . $file->getClientOriginalExtension();
    $path = $file->storeAs('room-files/' . $room, $filename, 'public');

    // Create system message about file upload
    $message = \App\Models\RoomMessage::create([
        'room_id' => $room,
        'sender_role' => 'system',
        'sender_name' => 'System',
        'message' => $path,
        'type' => 'image',
    ]);

    // Log activity
    $action = $validated['file_type'] === 'payment_proof' ? 'payment_proof_uploaded' : 'shipping_receipt_uploaded';
    $description = $validated['file_type'] === 'payment_proof' ?
        'Uploaded payment proof' : 'Uploaded shipping receipt';

    \App\Models\RoomActivityLog::create([
        'room_id' => $roomModel->id,
        'action' => $action,
        'user_name' => $roomUser->name,
        'role' => $roomUser->role,
        'description' => $description,
        'timestamp' => now(),
    ]);

    // Broadcast file upload
    broadcast(new \App\Events\RoomMessageSent($message))->toOthers();

    return back()->with('success', $description . ' uploaded successfully');
})->name('rooms.upload.post')->middleware('decrypt.room');

Route::get('/rooms/{room}/enter', function ($room) {
    $roomUrlService = app(\App\Services\RoomUrlService::class);
    $encryptedRoomId = request('encrypted_room_id') ?: $roomUrlService->encryptRoomId($room);

    // Check if user has session
    $sessionToken = request()->cookie('room_session_' . $room);
    $roomUser = null;

    if ($sessionToken) {
        $roomUser = \App\Models\RoomUser::where('room_id', $room)
                                     ->where('session_token', $sessionToken)
                                     ->first();
    }

    if (!$roomUser) {
        return redirect()->route('rooms.join', ['room' => $encryptedRoomId]);
    }

    return redirect()->route('rooms.show', ['room' => $encryptedRoomId]);
})->name('rooms.enter')->middleware('decrypt.room');

// Direct token access without /join should redirect to the token join page
Route::get('/rooms/{token}', function ($token) {
    $roomUrlService = app(\App\Services\RoomUrlService::class);
    $decrypted = $roomUrlService->decryptToken($token);

    if (!$decrypted) {
        return abort(404, 'Invalid or expired token');
    }

    $params = ['token' => $token];
    if (!empty($decrypted['pin'])) {
        $params['pin'] = $decrypted['pin'];
    }

    return redirect()->route('rooms.join.token', $params);
})->where('token', $tokenPattern)->name('rooms.token.redirect');

// Encrypted Token Routes
Route::get('/rooms/{token}/join', function ($token) {
    $roomUrlService = app(\App\Services\RoomUrlService::class);
    $decrypted = $roomUrlService->decryptToken($token);

    if (!$decrypted) {
        return abort(404, 'Invalid or expired token');
    }

    if (!empty($decrypted['pin']) && request('pin') !== $decrypted['pin']) {
        return abort(403, 'PIN required or invalid');
    }

    $room = \App\Models\Room::findOrFail($decrypted['room_id']);

    // Check if user already has a session for this room
    $sessionToken = request()->cookie('room_session_' . $room->id);
    $existingRoomUser = null;
    $isCurrentUserRegistered = false;

    if ($sessionToken) {
        $existingRoomUser = \App\Models\RoomUser::where('room_id', $room->id)
                                     ->where('session_token', $sessionToken)
                                     ->first();

        if ($existingRoomUser && $existingRoomUser->role === $decrypted['role']) {
            // User is already registered for this role, redirect to room
            $roomUrlService = app(\App\Services\RoomUrlService::class);
            $encryptedRoomId = $roomUrlService->encryptRoomId($room->id);
            return redirect()->route('rooms.show', ['room' => $encryptedRoomId]);
        }
    }

    \Log::info('Token join check', [
        'room_id' => $room->id,
        'role' => $decrypted['role'],
        'session_exists' => $sessionToken ? 'yes' : 'no',
        'existing_user' => $existingRoomUser ? [
            'name' => $existingRoomUser->name,
            'role' => $existingRoomUser->role,
            'same_role' => $existingRoomUser->role === $decrypted['role']
        ] : 'no'
    ]);

    return Inertia::render('rooms/[id]/join', [
        'room' => [
            'id' => $room->id,
            'room_number' => $room->room_number,
            'status' => $room->status,
            'has_buyer' => $room->hasBuyer(),
            'has_seller' => $room->hasSeller(),
            'buyer_name' => $room->users()->where('role', 'buyer')->first()?->name,
            'seller_name' => $room->users()->where('role', 'seller')->first()?->name,
            'current_user_role' => $existingRoomUser?->role,
            'current_user_name' => $existingRoomUser?->name,
        ],
        'role' => $decrypted['role'],
        'share_links' => app(\App\Services\RoomUrlService::class)->generateShareableLinks($room->id),
        'token' => $token
    ]);
})->where('token', $tokenPattern)->name('rooms.join.token');

Route::get('/rooms/{token}/enter', function ($token) {
    $roomUrlService = app(\App\Services\RoomUrlService::class);
    $decrypted = $roomUrlService->decryptToken($token);

    if (!$decrypted) {
        return abort(404, 'Invalid or expired token');
    }

    if (!empty($decrypted['pin']) && request('pin') !== $decrypted['pin']) {
        return abort(403, 'PIN required or invalid');
    }

    $roomModel = \App\Models\Room::findOrFail($decrypted['room_id']);
    $room = $decrypted['room_id'];

    // Check if user has session
    $sessionToken = request()->cookie('room_session_' . $room);
    $roomUser = null;

    if ($sessionToken) {
        $roomUser = \App\Models\RoomUser::where('room_id', $room)
                                     ->where('session_token', $sessionToken)
                                     ->first();
    }

    if (!$roomUser) {
        return redirect()->route('rooms.join.token', ['token' => $token]);
    }

    return redirect()->route('rooms.show', ['room' => $room]);
})->where('token', $tokenPattern)->name('rooms.enter.token');


// API Routes for Room Sharing
Route::get('/api/rooms/{room}/share-links', function ($room) {
    $roomModel = \App\Models\Room::findOrFail($room);
    $roomUrlService = app(\App\Services\RoomUrlService::class);

    $shareLinks = [];

    // Check what roles are needed
    if ($roomModel->isAvailableForBuyer()) {
        $shareLinks['buyer'] = [
            'join_url' => $roomUrlService->generateJoinUrl($roomModel->id, 'buyer'),
            'role' => 'buyer',
            'label' => 'Buyer Link',
            'description' => 'Share this link with someone who wants to buy'
        ];
    }

    if ($roomModel->isAvailableForSeller()) {
        $shareLinks['seller'] = [
            'join_url' => $roomUrlService->generateJoinUrl($roomModel->id, 'seller'),
            'role' => 'seller',
            'label' => 'Seller Link',
            'description' => 'Share this link with someone who wants to sell'
        ];
    }

    return response()->json([
        'success' => true,
        'room_id' => $roomModel->id,
        'room_number' => $roomModel->room_number,
        'status' => $roomModel->status,
        'has_buyer' => $roomModel->hasBuyer(),
        'has_seller' => $roomModel->hasSeller(),
        'is_full' => $roomModel->isFull(),
        'needs_buyer' => $roomModel->isAvailableForBuyer(),
        'needs_seller' => $roomModel->isAvailableForSeller(),
        'share_links' => $shareLinks,
        'token_expiry_minutes' => \App\Services\RoomUrlService::TOKEN_EXPIRY_MINUTES
    ]);
})->name('rooms.share-links')->middleware('decrypt.room');

// API Route for Room Status (WebSocket fallback)
Route::get('/api/rooms/status', function () {
    // Return room status updates for WebSocket fallback polling
    // This would typically get recent status changes from a cache or database
    $rooms = \App\Models\Room::with(['users' => function($query) {
        $query->select('id', 'room_id', 'name', 'role', 'is_online');
    }])
    ->orderBy('room_number')
    ->get()
    ->map(function ($room) {
        $firstUser = $room->users()->first();
        return [
            'room_id' => $room->id,
            'status' => $room->status,
            'has_buyer' => $room->hasBuyer(),
            'has_seller' => $room->hasSeller(),
            'available_for_buyer' => $room->isAvailableForBuyer(),
            'available_for_seller' => $room->isAvailableForSeller(),
            'user_name' => $firstUser?->name ?? '',
            'role' => $firstUser?->role ?? '',
            'action' => 'room_updated',
            'timestamp' => now()->toISOString()
        ];
    });

    return response()->json($rooms);
})->name('rooms.status');

// Dashboard routes for GM (authenticated users)
Route::middleware(['auth:gm'])->group(function () {
    Route::get('/gm/rooms', function () {
        $rooms = \App\Models\Room::with(['users' => function($query) {
            $query->select('id', 'room_id', 'name', 'role', 'is_online', 'joined_at', 'last_seen');
        }, 'messages' => function ($query) {
            $query->latest()->limit(1);
        }, 'activityLogs' => function ($query) {
            $query->latest()->limit(5);
        }])
        ->orderBy('room_number')
        ->get()
        ->map(function ($room) {
            $participants = [];
            if ($room->hasBuyer()) {
                $participants[] = 'Buyer';
            }
            if ($room->hasSeller()) {
                $participants[] = 'Seller';
            }

            return [
                'id' => $room->id,
                'room_number' => $room->room_number,
                'status' => $room->status,
                'created_at' => $room->created_at,
                'updated_at' => $room->updated_at,
                'has_buyer' => $room->hasBuyer(),
                'has_seller' => $room->hasSeller(),
                'is_available_for_buyer' => $room->isAvailableForBuyer(),
                'is_available_for_seller' => $room->isAvailableForSeller(),
                'participants' => $participants,
                'users' => $room->users->map(function ($user) {
                    return [
                        'id' => $user->id,
                        'name' => $user->name,
                        'role' => $user->role,
                        'is_online' => $user->is_online,
                        'joined_at' => $user->joined_at,
                        'last_seen' => $user->last_seen,
                    ];
                }),
                'message_count' => $room->messages()->count(),
                'last_message' => $room->messages->first(),
                'activity_count' => $room->activityLogs()->count(),
                'last_activity' => $room->activityLogs->first(),
            ];
        });

        return Inertia::render('gm/room-management', [
            'rooms' => $rooms,
            'stats' => [
                'total_rooms' => \App\Models\Room::count(),
                'free_rooms' => \App\Models\Room::where('status', 'free')->count(),
                'in_use_rooms' => \App\Models\Room::where('status', 'in_use')->count(),
                'active_users' => \App\Models\RoomUser::where('is_online', true)->count(),
            ]
        ]);
    })->name('gm.rooms');

    Route::get('dashboard', function () {
        $rooms = \App\Models\Room::with(['buyer', 'seller', 'messages' => function ($query) {
            $query->latest()->limit(1);
        }])->get()->map(function ($room) {
            return [
                'id' => $room->id,
                'room_number' => $room->room_number,
                'status' => $room->status,
                'buyer' => $room->buyer->first() ? [
                    'name' => $room->buyer->first()->name,
                    'phone' => $room->buyer->first()->phone,
                    'is_online' => $room->buyer->first()->is_online,
                    'joined_at' => $room->buyer->first()->joined_at,
                ] : null,
                'seller' => $room->seller->first() ? [
                    'name' => $room->seller->first()->name,
                    'phone' => $room->seller->first()->phone,
                    'is_online' => $room->seller->first()->is_online,
                    'joined_at' => $room->seller->first()->joined_at,
                ] : null,
                'last_message' => $room->messages->first(),
                'activity_count' => $room->activityLogs()->count(),
            ];
        });

        // Get transaction statistics
        $transactionStats = [
            'total_transactions' => \App\Models\Transaction::count(),
            'pending_payment' => \App\Models\Transaction::where('status', 'pending_payment')->count(),
            'active_transactions' => \App\Models\Transaction::active()->count(),
            'completed_transactions' => \App\Models\Transaction::completed()->count(),
            'disputed_transactions' => \App\Models\Transaction::disputed()->count(),
            'total_volume' => \App\Models\Transaction::sum('amount'),
            'total_commission' => \App\Models\Transaction::sum('commission'),
            'pending_payment_amount' => \App\Models\Transaction::where('status', 'pending_payment')->sum('amount'),
        ];

        // Get recent transactions
        $recentTransactions = \App\Models\Transaction::with(['room', 'buyer', 'seller'])
            ->latest()
            ->limit(10)
            ->get()
            ->map(function ($transaction) {
                return [
                    'id' => $transaction->id,
                    'transaction_number' => $transaction->transaction_number,
                    'amount' => $transaction->amount,
                    'currency' => $transaction->currency,
                    'status' => $transaction->status,
                    'status_label' => $transaction->getStatusLabel(),
                    'room_number' => $transaction->room->room_number,
                    'buyer_name' => $transaction->buyer?->name,
                    'seller_name' => $transaction->seller?->name,
                    'created_at' => $transaction->created_at->format('Y-m-d H:i:s'),
                ];
            });

        $stats = [
            'total_rooms' => \App\Models\Room::count(),
            'free_rooms' => \App\Models\Room::where('status', 'free')->count(),
            'in_use_rooms' => \App\Models\Room::where('status', 'in_use')->count(),
            'active_users' => \App\Models\RoomUser::where('is_online', true)->count(),
        ];

        return Inertia::render('dashboard', [
            'rooms' => $rooms,
            'stats' => $stats,
            'transactionStats' => $transactionStats,
            'recentTransactions' => $recentTransactions,
        ]);
    })->name('dashboard');

    Route::get('/room/{room}', function ($room) {
        $roomModel = \App\Models\Room::with(['buyer', 'seller', 'messages' => function ($query) {
            $query->ordered()->limit(100);
        }, 'activityLogs' => function ($query) {
            $query->recent(50);
        }])->findOrFail($room);

        return Inertia::render('gm/room-details', [
            'room' => [
                'id' => $roomModel->id,
                'room_number' => $roomModel->room_number,
                'status' => $roomModel->status,
                'buyer' => $roomModel->buyer->first(),
                'seller' => $roomModel->seller->first(),
                'messages' => $roomModel->messages->map(function ($message) {
                    return [
                        'id' => $message->id,
                        'sender_role' => $message->sender_role,
                        'sender_name' => $message->sender_name,
                        'message' => $message->message,
                        'type' => $message->type,
                        'created_at' => $message->created_at,
                    ];
                }),
                'activity_logs' => $roomModel->activityLogs->map(function ($log) {
                    return [
                        'id' => $log->id,
                        'action' => $log->action,
                        'user_name' => $log->user_name,
                        'role' => $log->role,
                        'description' => $log->description,
                        'timestamp' => $log->timestamp,
                    ];
                }),
            ],
        ]);
    })->name('gm.room.details');

    // User Verification Management Routes
    Route::prefix('api/verifications')->group(function () {
        Route::get('/', [App\Http\Controllers\UserVerificationController::class, 'index']);
        Route::get('/stats', [App\Http\Controllers\UserVerificationController::class, 'stats']);
        Route::post('/{verification}/approve', [App\Http\Controllers\UserVerificationController::class, 'approve']);
        Route::post('/{verification}/reject', [App\Http\Controllers\UserVerificationController::class, 'reject']);
    });

    // User Verification Page
    Route::get('/verifications', function () {
        return Inertia::render('verifications/index');
    })->name('verifications.index');
});

// WebSocket API Routes
Route::prefix('api/websocket')->group(function () {
    Route::get('/rooms/{roomId}/messages', [\App\Http\Controllers\WebSocketController::class, 'getRoomMessages']);
    Route::get('/rooms/{roomId}/connections', [\App\Http\Controllers\WebSocketController::class, 'getRoomConnections']);
    Route::post('/rooms/{roomId}/messages', [\App\Http\Controllers\WebSocketController::class, 'sendMessage']);
    Route::post('/rooms/{roomId}/typing', [\App\Http\Controllers\WebSocketController::class, 'sendTyping']);
    Route::post('/rooms/{roomId}/activity', [\App\Http\Controllers\WebSocketController::class, 'sendActivity']);
    Route::delete('/rooms/{roomId}/session', [\App\Http\Controllers\WebSocketController::class, 'clearSessionData']);
    Route::get('/metrics', [\App\Http\Controllers\WebSocketController::class, 'getMetrics']);
    Route::get('/health', [\App\Http\Controllers\WebSocketController::class, 'getHealth']);
    Route::get('/connections', [\App\Http\Controllers\WebSocketController::class, 'getAllConnections']);
    Route::post('/cleanup', [\App\Http\Controllers\WebSocketController::class, 'cleanupConnections']);
    Route::post('/test', [\App\Http\Controllers\WebSocketController::class, 'testConnection']);
    Route::post('/load-test', [\App\Http\Controllers\WebSocketController::class, 'loadTest']);
});

// API routes for token-based room access and share links
Route::post('/api/room/generate-share-links', function () {
    $validated = request()->validate([
        'room_id' => 'required|integer|exists:rooms,id',
        'pin' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{4,8}$/'],
    ]);

    $room = \App\Models\Room::findOrFail($validated['room_id']);
    $roomUrlService = app(\App\Services\RoomUrlService::class);
    $pin = $validated['pin'] ?? null;

    return response()->json([
        'success' => true,
        'message' => 'Shareable links generated successfully',
        'data' => [
            'room' => [
                'id' => $room->id,
                'room_number' => $room->room_number ?? null,
                'status' => $room->status,
            ],
            'pin_enabled' => !empty($pin),
            'pin' => $pin,
            'links' => $roomUrlService->generateShareableLinks($room->id, $pin),
        ],
    ]);
});

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

    Route::get('/{token}/expired', function ($token) {
        return inertia('rooms/invitation-expired', ['token' => $token]);
    })->name('rooms.invite.expired');
});

// Room Invitations Management (authenticated users only)
Route::middleware(['auth'])->prefix('rooms/{room}')->group(function () {
    Route::get('/invitations', function ($room) {
        $roomModel = \App\Models\Room::findOrFail($room);
        $invitations = $roomModel->invitations()
            ->with(['inviter', 'invitee'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($invitation) {
                return [
                    'id' => $invitation->id,
                    'email' => $invitation->email,
                    'role' => $invitation->role,
                    'status' => $invitation->isAccepted() ? 'accepted' : ($invitation->isExpired() ? 'expired' : 'pending'),
                    'expires_at' => $invitation->expires_at->toISOString(),
                    'accepted_at' => $invitation->accepted_at?->toISOString(),
                    'joined_at' => $invitation->joined_at?->toISOString(),
                    'pin_attempts' => $invitation->pin_attempts,
                    'is_pin_locked' => $invitation->isPinLocked(),
                    'inviter' => $invitation->inviter->name,
                    'invitee' => $invitation->invitee?->name
                ];
            });

        $availableRoles = [];
        if (!$roomModel->hasBuyer()) {
            $availableRoles[] = 'buyer';
        }
        if (!$roomModel->hasSeller()) {
            $availableRoles[] = 'seller';
        }

        return inertia('rooms/invitations', [
            'room' => [
                'id' => $roomModel->id,
                'name' => "Room #{$roomModel->room_number}",
                'room_number' => $roomModel->room_number,
                'status' => $roomModel->status
            ],
            'invitations' => $invitations,
            'availableRoles' => $availableRoles
        ]);
    })->name('rooms.invitations');
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

require __DIR__.'/settings.php';

// SSE streaming route for room messages
Route::get('/api/rooms/{room}/sse', [\App\Http\Controllers\SseController::class, 'streamRoom'])
    ->middleware(['throttle:60,1', 'decrypt.room'])
    ->name('rooms.sse');
