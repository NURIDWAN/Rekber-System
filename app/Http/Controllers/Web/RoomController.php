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

class RoomController extends Controller
{
    /**
     * Display listing of rooms.
     */
    public function index()
    {
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
            ],
            'role' => request()->get('role', 'buyer'),
            'share_links' => $roomUrlService->generateShareableLinks($roomModel->id),
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

        // Check if user is already in another room
        $existingSession = $request->cookie('room_session_token');
        if ($existingSession) {
            $existingUser = RoomUser::where('session_token', $existingSession)->first();
            if ($existingUser) {
                return back()->withErrors(['general' => 'You are already in another room']);
            }
        }

        // Create room user
        $multiSessionManager = app(MultiSessionManager::class);

        // Get or create user identifier
        $identifierResult = $multiSessionManager->ensureUserIdentifier($request);
        $userIdentifier = $identifierResult['identifier'];

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
    public function upload(Request $request, $room): JsonResponse
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

        $validated = $request->validate([
            'file' => 'required|file|image|max:5120', // 5MB max
            'file_type' => ['required', 'in:payment_proof,shipping_receipt'],
        ]);

        try {
            // Get or create transaction for this room
            $transaction = Transaction::firstOrCreate(
                ['room_id' => $roomModel->id],
                [
                    'status' => 'pending_payment',
                    'buyer_id' => $roomModel->users()->where('role', 'buyer')->first()?->id,
                    'seller_id' => $roomModel->users()->where('role', 'seller')->first()?->id,
                    'amount' => 0, // Will be set by GM
                    'currency' => 'IDR',
                    'description' => "Transaction for Room #{$roomModel->room_number}",
                ]
            );

            // Upload file
            $file = $request->file('file');
            $filename = time() . '_' . Str::random(10) . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('room-files/' . $roomModel->id . '/' . $validated['file_type'], $filename, 'public');

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
            } elseif ($validated['file_type'] === 'shipping_receipt' && $transaction->status === 'paid') {
                $transaction->update([
                    'status' => 'awaiting_shipping_verification',
                    'shipping_receipt_uploaded_at' => now(),
                    'shipping_receipt_uploaded_by' => $roomUser->id,
                ]);
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

            return response()->json([
                'success' => true,
                'file_url' => Storage::url($path),
                'message' => $description,
                'transaction_id' => $transaction->id,
                'transaction_status' => $transaction->status,
            ]);
        } catch (\Exception $e) {
            Log::error('Upload failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'room_id' => $roomModel->id,
                'user_id' => $roomUser->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Upload failed: ' . $e->getMessage(),
            ], 500);
        }
    }
}