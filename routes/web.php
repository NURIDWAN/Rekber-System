<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('home');
})->name('home');

// Public Room Routes
Route::get('/rooms', function () {
    $rooms = \App\Models\Room::with(['users' => function($query) {
        $query->select('id', 'room_id', 'name', 'role', 'is_online');
    }])
    ->orderBy('room_number')
    ->get()
    ->map(function ($room) {
        return [
            'id' => $room->id,
            'room_number' => $room->room_number,
            'status' => $room->status,
            'has_buyer' => $room->hasBuyer(),
            'has_seller' => $room->hasSeller(),
            'buyer_name' => $room->users()->where('role', 'buyer')->first()?->name,
            'seller_name' => $room->users()->where('role', 'seller')->first()?->name,
            'buyer_online' => $room->users()->where('role', 'buyer')->where('is_online', true)->exists(),
            'seller_online' => $room->users()->where('role', 'seller')->where('is_online', true)->exists(),
            'available_for_buyer' => $room->isAvailableForBuyer(),
            'available_for_seller' => $room->isAvailableForSeller(),
        ];
    });

    return Inertia::render('rooms', [
        'rooms' => $rooms
    ]);
})->name('rooms');

Route::get('/rooms/{room}/join', function ($room) {
    $roomModel = \App\Models\Room::findOrFail($room);
    return Inertia::render('rooms/join', [
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
    ]);
})->name('rooms.join');

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
    \App\Models\RoomActivityLog::create([
        'room_id' => $roomModel->id,
        'action' => $role . '_joined',
        'user_name' => $validated['name'],
        'role' => $role,
        'description' => ucfirst($role) . ' joined the room',
        'timestamp' => now(),
    ]);

    $cookie = cookie('room_session_' . $roomModel->id, $sessionToken, 120 * 60);

    return redirect()
        ->route('rooms.show', ['room' => $roomModel->id])
        ->cookie($cookie);
})->name('rooms.join.post');

Route::get('/rooms/{room}', function ($room) {
    $roomModel = \App\Models\Room::with(['users' => function($query) {
        $query->where('is_online', true);
    }, 'messages' => function ($query) {
        $query->ordered()->limit(50);
    }])->findOrFail($room);

    // Check if user has session
    $sessionToken = request()->cookie('room_session_' . $room);
    $roomUser = null;

    if ($sessionToken) {
        $roomUser = \App\Models\RoomUser::where('room_id', $room)
                                     ->where('session_token', $sessionToken)
                                     ->first();
    }

    if (!$roomUser) {
        return redirect()->route('rooms.join', ['room' => $room]);
    }

    // Get buyer and seller data
    $buyer = $roomModel->users()->where('role', 'buyer')->first();
    $seller = $roomModel->users()->where('role', 'seller')->first();

    return Inertia::render('rooms/index', [
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
        ]
    ]);
})->name('rooms.show');

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

    // Broadcast message (will be implemented with Pusher)
    // broadcast(new \App\Events\RoomMessageSent($message))->toOthers();

    return back();
})->name('rooms.message.post');

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
})->name('rooms.leave.post');

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

    // Broadcast file upload (will be implemented with Pusher)
    // broadcast(new \App\Events\RoomMessageSent($message))->toOthers();

    return back()->with('success', $description . ' uploaded successfully');
})->name('rooms.upload.post');

Route::get('/rooms/{room}/enter', function ($room) {
    $roomModel = \App\Models\Room::findOrFail($room);

    // Check if user has session
    $sessionToken = request()->cookie('room_session_' . $room);
    $roomUser = null;

    if ($sessionToken) {
        $roomUser = \App\Models\RoomUser::where('room_id', $room)
                                     ->where('session_token', $sessionToken)
                                     ->first();
    }

    if (!$roomUser) {
        return redirect()->route('rooms.join', ['room' => $room]);
    }

    return redirect()->route('rooms.show', ['room' => $room]);
})->name('rooms.enter');

// Encrypted Token Routes
Route::get('/rooms/{token}/join', function ($token) {
    $roomUrlService = app(\App\Services\RoomUrlService::class);
    $decrypted = $roomUrlService->decryptToken($token);

    if (!$decrypted) {
        return abort(404, 'Invalid or expired token');
    }

    $room = \App\Models\Room::findOrFail($decrypted['room_id']);

    return Inertia::render('rooms/join', [
        'room' => $room,
        'role' => $decrypted['role'],
        'token' => $token
    ]);
})->name('rooms.join.token');

Route::get('/rooms/{token}/enter', function ($token) {
    $roomUrlService = app(\App\Services\RoomUrlService::class);
    $decrypted = $roomUrlService->decryptToken($token);

    if (!$decrypted) {
        return abort(404, 'Invalid or expired token');
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
})->name('rooms.enter.token');

// GM Routes
Route::prefix('gm')->group(function () {
    Route::get('/login', function () {
        return Inertia::render('gm/login');
    })->name('gm.login');

    Route::post('/login', function () {
        $validated = request()->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        // Find GM user
        $gmUser = \App\Models\GmUser::where('email', $validated['email'])->first();

        if (!$gmUser || !\Illuminate\Support\Facades\Hash::check($validated['password'], $gmUser->password)) {
            return back()->withErrors([
                'general' => 'Invalid credentials'
            ])->withInput();
        }

        // Login GM user
        \Illuminate\Support\Facades\Auth::guard('gm')->login($gmUser);

        return redirect()->intended(route('gm.dashboard'));
    })->name('gm.login.post');

    Route::middleware(['auth:gm'])->group(function () {
        Route::get('/dashboard', function () {
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

            $stats = [
                'total_rooms' => \App\Models\Room::count(),
                'free_rooms' => \App\Models\Room::where('status', 'free')->count(),
                'in_use_rooms' => \App\Models\Room::where('status', 'in_use')->count(),
                'active_users' => \App\Models\RoomUser::where('is_online', true)->count(),
            ];

            return Inertia::render('gm/dashboard', [
                'rooms' => $rooms,
                'stats' => $stats,
            ]);
        })->name('gm.dashboard');

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
    });
});


// Legacy auth routes (keep for Fortify compatibility)
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
});

require __DIR__.'/settings.php';
