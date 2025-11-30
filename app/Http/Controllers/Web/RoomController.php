<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\RoomMessage;
use App\Models\RoomActivityLog;
use App\Models\Transaction;
use App\Models\TransactionFile;
use App\Services\RoomUrlService;
use App\Services\MultiSessionManager;
use App\Events\RoomActivityLogged;
use App\Events\RoomMessageSent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use App\Services\TransactionService;

class RoomController extends Controller
{
    /**
     * Display listing of rooms.
     */
    public function index()
    {
        // Check if user has active session in another room
        $multiSessionManager = app(MultiSessionManager::class);
        $userIdentifier = $multiSessionManager->getUserIdentifierFromCookie();

        if ($userIdentifier) {
            // Check for any active session where user is a participant
            // "Active" means room is not completed and not expired
            $activeSession = RoomUser::where('user_identifier', $userIdentifier)
                ->where('is_online', true)
                ->whereHas('room', function ($query) {
                    $query->where('status', '!=', 'completed')
                        ->where(function ($q) {
                            $q->whereNull('expires_at')
                                ->orWhere('expires_at', '>', now());
                        });
                })
                ->with('room')
                ->first();

            if ($activeSession) {
                $roomUrlService = app(RoomUrlService::class);
                $encryptedActiveRoomId = $roomUrlService->encryptRoomId($activeSession->room_id);

                return redirect()->route('rooms.show', ['room' => $encryptedActiveRoomId])
                    ->with('warning', 'Anda sedang aktif di room lain. Selesaikan sesi tersebut sebelum melihat daftar room.');
            }
        }

        $rooms = Room::with([
            'users' => function ($query) {
                $query->select('id', 'room_id', 'name', 'role', 'is_online');
            }
        ])
            ->orderBy('room_number')
            ->get()
            ->map(function ($room) {
                $shareLinks = app(RoomUrlService::class)->generateShareableLinks($room->id);
                $participants = [];
                if ($room->hasBuyer()) {
                    $participants[] = 'Buyer';
                }
                if ($room->hasSeller()) {
                    $participants[] = 'Seller';
                }
                $participants[] = 'GM';

                $roomUrlService = app(RoomUrlService::class);

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
    }

    /**
     * Show the room join form.
     */
    public function joinForm($room)
    {
        $roomModel = Room::findOrFail($room);
        $roomUrlService = app(RoomUrlService::class);

        // Get current user session to show if they already have a session
        $multiSessionManager = app(MultiSessionManager::class);
        $userIdentifier = $multiSessionManager->getUserIdentifierFromCookie();
        $existingUser = null;

        if ($userIdentifier) {
            $existingUser = RoomUser::where('room_id', $roomModel->id)
                ->where('user_identifier', $userIdentifier)
                ->where('is_online', true)
                ->first();

        }

        // Check if user has active session in another room
        if (!$existingUser && $userIdentifier) {
            $check = $multiSessionManager->canJoinRoom($roomModel->id, 'buyer', $userIdentifier);
            if (!$check['can_join'] && isset($check['suggested_action']) && $check['suggested_action'] === 'redirect_to_active') {
                $activeRoomId = $check['active_room_id'];
                $roomUrlService = app(RoomUrlService::class);
                $encryptedActiveRoomId = $roomUrlService->encryptRoomId($activeRoomId);
                return redirect()->route('rooms.show', ['room' => $encryptedActiveRoomId])
                    ->with('error', $check['reason']);
            }
        }

        return Inertia::render('rooms/[id]/join', [
            'room' => [
                'id' => $roomModel->id,
                'room_number' => $roomModel->room_number,
                'status' => $roomModel->status,
                'has_buyer' => $roomModel->hasBuyer(),
                'has_seller' => $roomModel->hasSeller(),
                'buyer_name' => $roomModel->users()->where('role', 'buyer')->first()?->name,
                'seller_name' => $roomModel->users()->where('role', 'seller')->first()?->name,
                'current_user_role' => $existingUser?->role,
                'current_user_name' => $existingUser?->name,
                'expires_at' => $roomModel->expires_at,
                'is_expired' => $roomModel->isExpired(),
            ],
            'role' => request()->get('role', 'buyer'),
            'share_links' => array_merge(
                $roomUrlService->generateShareableLinks($roomModel->id),
                ['pin_enabled' => $roomModel->pin_enabled]
            ),
            'encrypted_urls' => [
                'join_buyer' => $roomUrlService->generateJoinUrl($roomModel->id, 'buyer'),
                'join_seller' => $roomUrlService->generateJoinUrl($roomModel->id, 'seller'),
                'enter_buyer' => $roomUrlService->generateEnterUrl($roomModel->id, 'buyer'),
                'enter_seller' => $roomUrlService->generateEnterUrl($roomModel->id, 'seller'),
            ]
        ]);
    }

    /**
     * Handle room join request.
     */
    public function join(Request $request, $room)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
        ]);

        $roomModel = Room::findOrFail($room);
        $role = $request->get('role', 'buyer');

        // Check if room is available
        if ($role === 'buyer' && !$roomModel->isAvailableForBuyer()) {
            return back()->withErrors(['general' => 'Room is not available for buyer']);
        }
        if ($role === 'seller' && !$roomModel->isAvailableForSeller()) {
            return back()->withErrors(['general' => 'Room is not available for seller']);
        }

        // Validate PIN if enabled
        if ($roomModel->pin_enabled) {
            $pin = $request->input('pin');
            if (empty($pin)) {
                return back()->withErrors(['pin' => 'PIN is required for this room']);
            }

            if ($pin !== $roomModel->pin) {
                return back()->withErrors(['pin' => 'Invalid PIN']);
            }
        }

        // Check if user is already in another room
        $multiSessionManager = app(MultiSessionManager::class);
        $identifierResult = $multiSessionManager->ensureUserIdentifier($request);
        $userIdentifier = $identifierResult['identifier'];

        $check = $multiSessionManager->canJoinRoom($roomModel->id, $role, $userIdentifier);
        if (!$check['can_join'] && isset($check['suggested_action']) && $check['suggested_action'] === 'redirect_to_active') {
            return back()->withErrors(['general' => $check['reason']]);
        }



        $sessionToken = $multiSessionManager->generateSessionToken($roomModel->id, $role, $userIdentifier);
        $cookieName = $multiSessionManager->generateCookieName($roomModel->id, $role, $userIdentifier);

        Log::info('Creating room user', [
            'room_id' => $roomModel->id,
            'name' => $validated['name'],
            'role' => $role,
            'session_token' => substr($sessionToken, 0, 8) . '...',
            'cookie_name' => $cookieName,
            'user_identifier' => $userIdentifier
        ]);

        $roomUser = RoomUser::create([
            'room_id' => $roomModel->id,
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'role' => $role,
            'session_token' => $sessionToken,
            'user_identifier' => $userIdentifier,
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
        $activityLog = RoomActivityLog::create([
            'room_id' => $roomModel->id,
            'action' => $role . '_joined',
            'user_name' => $validated['name'],
            'role' => $role,
            'description' => ucfirst($role) . ' joined room',
            'timestamp' => now(),
        ]);

        // Broadcast activity
        broadcast(new RoomActivityLogged($activityLog))->toOthers();

        $roomUrlService = app(RoomUrlService::class);
        $encryptedRoomId = $roomUrlService->encryptRoomId($roomModel->id);

        $response = redirect()->route('rooms.show', ['room' => $encryptedRoomId]);

        // Attach session cookie
        $response->withCookie(cookie($cookieName, $sessionToken, 120 * 60));

        // Attach user identifier cookie if new or missing
        if ($identifierResult['is_new']) {
            $response->withCookie(cookie('rekber_user_identifier', $userIdentifier, 60 * 24 * 30));
        }

        return $response;
    }

    /**
     * Display the specified room.
     */
    public function show($room)
    {
        // This method now uses MultiSessionRoomAuth middleware
        $roomModel = request('current_room');
        $roomUser = request('current_room_user');
        $userIdentifier = request('user_identifier');

        if (!$roomModel || !$roomUser) {
            Log::error('Missing room data in multi-session route', [
                'room_id' => $room,
                'has_room' => !!$roomModel,
                'has_user' => !!$roomUser
            ]);
            return redirect()->route('rooms.index');
        }

        Log::info('Multi-session room access', [
            'room_id' => $room,
            'room_number' => $roomModel->room_number,
            'user_identifier' => substr($userIdentifier, 0, 8) . '...',
            'user_role' => $roomUser->role,
            'user_name' => $roomUser->name,
            'session_token' => substr($roomUser->session_token, 0, 8) . '...'
        ]);

        // Get buyer and seller data
        $buyer = $roomModel->users()->where('role', 'buyer')->first();
        $seller = $roomModel->users()->where('role', 'seller')->first();

        $roomUrlService = app(RoomUrlService::class);
        $encryptedRoomId = request('encrypted_room_id') ?: $roomUrlService->encryptRoomId($roomModel->id);

        // Generate share links with persisted PIN if enabled
        $shareLinks = $roomUrlService->generateShareableLinks($roomModel->id, $roomModel->pin_enabled ? $roomModel->pin : null);
        $shareLinks['pin'] = $roomModel->pin;
        $shareLinks['pin_enabled'] = $roomModel->pin_enabled;

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
                'files' => $roomModel->transactionFiles->map(function ($file) {
                    return [
                        'id' => $file->id,
                        'file_path' => $file->file_path,
                        'file_name' => $file->file_name,
                        'file_type' => $file->file_type,
                    ];
                }),
            ],
            'currentUser' => [
                'role' => $roomUser->role,
                'name' => $roomUser->name,
                'is_online' => $roomUser->is_online,
            ],
            'share_links' => $shareLinks,
            'encrypted_room_id' => $encryptedRoomId,
            'encrypted_urls' => [
                'join_buyer' => $roomUrlService->generateJoinUrl($roomModel->id, 'buyer'),
                'join_seller' => $roomUrlService->generateJoinUrl($roomModel->id, 'seller'),
                'enter_buyer' => $roomUrlService->generateEnterUrl($roomModel->id, 'buyer'),
                'enter_seller' => $roomUrlService->generateEnterUrl($roomModel->id, 'seller'),
            ],
        ]);
    }

    /**
     * Send message to room.
     */
    public function message(Request $request, $room)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:2000',
            'type' => ['required', 'in:text,image'],
        ]);

        // This method uses MultiSessionRoomAuth middleware
        $roomModel = request('current_room');
        $roomUser = request('current_room_user');

        if (!$roomModel || !$roomUser) {
            return back()->withErrors(['message' => 'Unauthorized for this room']);
        }

        // Create message
        $message = RoomMessage::create([
            'room_id' => $room,
            'sender_role' => $roomUser->role,
            'sender_name' => $roomUser->name,
            'message' => $validated['message'],
            'type' => $validated['type'],
            'created_at' => now(),
        ]);

        // Log activity
        RoomActivityLog::create([
            'room_id' => $roomModel->id,
            'action' => 'message_sent',
            'user_name' => $roomUser->name,
            'role' => $roomUser->role,
            'description' => 'Sent a ' . $validated['type'] . ' message',
            'timestamp' => now(),
        ]);

        // Dispatch message event for broadcasting listeners
        event(new RoomMessageSent($message));

        return back();
    }

    /**
     * Leave room.
     */
    public function leave($room)
    {
        // This method uses MultiSessionRoomAuth middleware
        $roomModel = request('current_room');
        $roomUser = request('current_room_user');

        if (!$roomModel || !$roomUser) {
            return redirect('/rooms');
        }

        // Log activity
        RoomActivityLog::create([
            'room_id' => $roomModel->id,
            'action' => 'user_left',
            'user_name' => $roomUser->name,
            'role' => $roomUser->role,
            'description' => $roomUser->role . ' left room',
            'timestamp' => now(),
        ]);

        // Delete room user
        $roomUser->delete();

        // Check if room is now empty and reset status
        if ($roomModel->users()->count() === 0) {
            $roomModel->status = 'free';
            $roomModel->save();
        }

        // Clear session cookie using multi-session approach
        $userIdentifier = request('user_identifier');
        $multiSessionManager = app(MultiSessionManager::class);
        $cookieName = $multiSessionManager->generateCookieName($room, $roomUser->role, $userIdentifier);

        $cookie = cookie($cookieName, '', -1, '/');

        // Also clear from localStorage (handled by frontend)
        return redirect('/rooms')
            ->cookie($cookie)
            ->cookie('rekber_user_identifier_removed_' . $room, $roomUser->role, 60); // Signal for frontend
    }

    /**
     * Upload file to room.
     */
    public function upload(Request $request, $room)
    {
        // This method uses MultiSessionRoomAuth middleware
        $roomModel = request('current_room');
        $roomUser = request('current_room_user');

        if (!$roomModel || !$roomUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized for this room',
            ], 401);
        }

        if ($roomUser->role === 'gm') {
            return back()->withErrors(['file' => 'GM cannot upload transaction files']);
        }

        $validated = $request->validate([
            'file' => 'required|file|image|max:5120', // 5MB max
            'file_type' => ['required', 'in:payment_proof,shipping_receipt'],
            'amount' => 'required_if:file_type,payment_proof|numeric|min:0',
        ]);

        try {
            // Get or create transaction for this room
            $transaction = Transaction::firstOrCreate(
                ['room_id' => $roomModel->id],
                [
                    'status' => 'pending_payment',
                    'buyer_id' => $roomModel->users()->where('role', 'buyer')->first()?->id,
                    'seller_id' => $roomModel->users()->where('role', 'seller')->first()?->id,
                    'amount' => $request->input('amount', 0),
                    'currency' => 'IDR',
                    'description' => "Transaction for Room #{$roomModel->room_number}",
                ]
            );

            // Update amount if provided and transaction is still pending payment
            if ($request->has('amount') && $transaction->status === 'pending_payment') {
                $transaction->update(['amount' => $request->input('amount')]);
            }

            // Upload file
            $file = $request->file('file');
            $filename = time() . '_' . Str::random(10) . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('room-files/' . $roomModel->id . '/' . $validated['file_type'], $filename, 'local');

            // Create transaction file record
            $transactionFile = TransactionFile::create([
                'room_id' => $roomModel->id,
                'transaction_id' => $transaction->id,
                'file_type' => $validated['file_type'],
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
                'uploaded_by' => $roomUser->role,
                'status' => 'pending',
            ]);

            // Update transaction status if needed
            if ($validated['file_type'] === 'payment_proof' && $transaction->status === 'pending_payment') {
                $transaction->update([
                    'status' => 'awaiting_payment_verification',
                    'payment_proof_uploaded_at' => now(),
                    'payment_proof_uploaded_by' => $roomUser->id,
                ]);
                $roomModel->update(['status' => 'payment_pending']);
            } elseif ($validated['file_type'] === 'shipping_receipt' && $transaction->status === 'paid') {
                $transaction->update([
                    'status' => 'awaiting_shipping_verification',
                    'shipping_receipt_uploaded_at' => now(),
                    'shipping_receipt_uploaded_by' => $roomUser->id,
                ]);
                $roomModel->update(['status' => 'shipped']);
            }

            // Create system message about file upload
            $message = RoomMessage::create([
                'room_id' => $roomModel->id,
                'sender_role' => 'system',
                'sender_name' => 'System',
                'message' => $path,
                'type' => 'image',
                'created_at' => now(),
            ]);

            // Log activity
            $action = $validated['file_type'] === 'payment_proof' ? 'payment_proof_uploaded' : 'shipping_receipt_uploaded';
            $description = $validated['file_type'] === 'payment_proof' ?
                "Uploaded payment proof (awaiting verification)" : "Uploaded shipping receipt (awaiting verification)";

            RoomActivityLog::create([
                'room_id' => $roomModel->id,
                'action' => $action,
                'user_name' => $roomUser->name,
                'role' => $roomUser->role,
                'description' => $description,
                'timestamp' => now(),
            ]);

            // Broadcast file upload
            broadcast(new RoomMessageSent($message))->toOthers();

            return back()->with('success', $description);
        } catch (\Exception $e) {
            Log::error('Upload failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'room_id' => $roomModel->id,
                'user_id' => $roomUser->id,
            ]);

            return back()->withErrors(['file' => 'Upload failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Confirm receipt of goods.
     */
    public function confirmReceipt(Request $request, $room)
    {
        // This method uses MultiSessionRoomAuth middleware
        $roomModel = request('current_room');
        $roomUser = request('current_room_user');

        if (!$roomModel || !$roomUser) {
            return back()->withErrors(['general' => 'Unauthorized for this room']);
        }

        if ($roomUser->role !== 'buyer') {
            return back()->withErrors(['general' => 'Only buyer can confirm receipt']);
        }

        try {
            $transactionService = new TransactionService();
            $result = $transactionService->confirmReceipt($roomModel, $roomUser);

            if ($result['success']) {
                // Broadcast update is handled in service or we can do it here if needed
                // Service broadcasts RoomMessageSent?
                // Service code: broadcast(new RoomMessageSent($room, $result['data'], $roomUser)); is in Api/RoomController, not Service
                // Service returns 'data' which is the message model.

                // We should broadcast the message
                broadcast(new RoomMessageSent($result['data']))->toOthers();

                return back()->with('success', 'Barang berhasil dikonfirmasi!');
            }

            return back()->withErrors(['general' => $result['message']]);
        } catch (\Exception $e) {
            Log::error('Confirm receipt failed', [
                'error' => $e->getMessage(),
                'room_id' => $roomModel->id,
            ]);
            return back()->withErrors(['general' => 'Failed to confirm receipt']);
        }
    }

    /**
     * Extend room expiry.
     */
    public function extend(Request $request, $room)
    {
        $roomModel = Room::findOrFail($room);

        // Add 24 hours to current expiry or now if already expired
        $newExpiry = $roomModel->expires_at && $roomModel->expires_at->isFuture()
            ? $roomModel->expires_at->addDay()
            : now()->addDay();

        $roomModel->update([
            'expires_at' => $newExpiry
        ]);

        return back()->with('success', 'Room duration extended by 24 hours.');
    }

    /**
     * Download file securely.
     */
    public function download(Request $request, $room, $file)
    {
        // This method uses MultiSessionRoomAuth middleware
        $roomModel = request('current_room');
        $roomUser = request('current_room_user');

        if (!$roomModel || !$roomUser) {
            abort(403, 'Unauthorized');
        }

        $transactionFile = TransactionFile::where('room_id', $roomModel->id)
            ->where('id', $file)
            ->firstOrFail();

        // Check private storage (new uploads)
        if (Storage::disk('local')->exists($transactionFile->file_path)) {
            return response()->file(storage_path('app/private/' . $transactionFile->file_path));
        }

        // Check public storage (legacy uploads)
        if (Storage::disk('public')->exists($transactionFile->file_path)) {
            return response()->file(storage_path('app/public/' . $transactionFile->file_path));
        }

        abort(404);
    }
}