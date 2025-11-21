<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\RoomActivityLog;
use App\Models\RoomMessage;
use App\Events\RoomMessageSent;
use App\Events\RoomUserOnline;
use App\Events\RoomUserOffline;
use App\Services\TransactionService;
use App\Services\RoomUrlService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class RoomController extends Controller
{
    /**
     * Display a listing of all rooms.
     */
    public function index(): JsonResponse
    {
        $rooms = Room::with(['buyer', 'seller'])->get()->map(function ($room) {
            return [
                'id' => $room->id,
                'room_number' => $room->room_number,
                'status' => $room->status,
                'has_buyer' => $room->hasBuyer(),
                'has_seller' => $room->hasSeller(),
                'buyer_name' => $room->buyer()->first()?->name,
                'seller_name' => $room->seller()->first()?->name,
                'available_for_buyer' => $room->isAvailableForBuyer(),
                'available_for_seller' => $room->isAvailableForSeller(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $rooms,
        ]);
    }

    /**
     * Display the specified room with users.
     */
    public function show(Room $room): JsonResponse
    {
        $room->load(['buyer', 'seller', 'messages' => function ($query) {
            $query->ordered()->limit(50);
        }]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $room->id,
                'room_number' => $room->room_number,
                'status' => $room->status,
                'buyer' => $room->buyer->map(function ($buyer) {
                    return [
                        'name' => $buyer->name,
                        'is_online' => $buyer->is_online,
                        'joined_at' => $buyer->joined_at,
                    ];
                })->first(),
                'seller' => $room->seller->map(function ($seller) {
                    return [
                        'name' => $seller->name,
                        'is_online' => $seller->is_online,
                        'joined_at' => $seller->joined_at,
                    ];
                })->first(),
                'messages' => $room->messages->map(function ($message) {
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
        ]);
    }

    /**
     * Join a room as buyer or seller.
     */
    public function join(Request $request, Room $room): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'role' => 'required|in:buyer,seller',
        ]);

        $role = $request->role;
        $name = $request->name;
        $phone = $request->phone;

        try {
            DB::beginTransaction();

            if ($role === 'buyer') {
                if (!$room->isAvailableForBuyer()) {
                    throw ValidationException::withMessages([
                        'role' => 'Room is not available for buyer',
                    ]);
                }

                if ($room->status === 'free') {
                    $room->update(['status' => 'in_use']);
                }
            } else {
                if (!$room->isAvailableForSeller()) {
                    throw ValidationException::withMessages([
                        'role' => 'Room is not available for seller',
                    ]);
                }
            }

            $existingUser = RoomUser::where('room_id', $room->id)
                                   ->where('role', $role)
                                   ->first();

            if ($existingUser) {
                throw ValidationException::withMessages([
                    'role' => ucfirst($role) . ' already exists in this room',
                ]);
            }

            $roomUser = RoomUser::create([
                'room_id' => $room->id,
                'name' => $name,
                'phone' => $phone,
                'role' => $role,
                'is_online' => true,
                'last_seen' => now(),
            ]);

            RoomActivityLog::logActivity(
                $room->id,
                'room_joined',
                $name,
                $role,
                ucfirst($role) . ' joined the room'
            );

            RoomMessage::createSystemMessage(
                $room->id,
                $name . ' (' . ucfirst($role) . ') joined the room'
            );

            DB::commit();

            Cookie::queue('room_session_' . $room->id, $roomUser->session_token, 60 * 24 * 7);

            return response()->json([
                'success' => true,
                'message' => 'Successfully joined the room',
                'data' => [
                    'session_token' => $roomUser->session_token,
                    'role' => $roomUser->role,
                    'name' => $roomUser->name,
                ],
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Room join error: ' . $e->getMessage());

            throw $e;
        }
    }

    /**
     * Enter a room with existing session.
     */
    public function enter(Request $request, Room $room): JsonResponse
    {
        $sessionToken = $request->cookie('room_session_' . $room->id);

        if (!$sessionToken) {
            return response()->json([
                'success' => false,
                'message' => 'No session found for this room',
            ], 401);
        }

        $roomUser = RoomUser::where('room_id', $room->id)
                           ->where('session_token', $sessionToken)
                           ->first();

        if (!$roomUser) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid session token',
            ], 401);
        }

        $roomUser->updateLastSeen();

        broadcast(new RoomUserOnline($room, $roomUser));

        return response()->json([
            'success' => true,
            'message' => 'Successfully entered the room',
            'data' => [
                'role' => $roomUser->role,
                'name' => $roomUser->name,
                'is_online' => $roomUser->is_online,
            ],
        ]);
    }

    /**
     * Get messages for a room.
     */
    public function messages(Request $request, Room $room): JsonResponse
    {
        $sessionToken = $request->cookie('room_session_' . $room->id);

        if (!$sessionToken) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $roomUser = RoomUser::where('room_id', $room->id)
                           ->where('session_token', $sessionToken)
                           ->first();

        if (!$roomUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $messages = $room->messages()
                        ->ordered()
                        ->limit(100)
                        ->get()
                        ->map(function ($message) {
                            return [
                                'id' => $message->id,
                                'sender_role' => $message->sender_role,
                                'sender_name' => $message->sender_name,
                                'message' => $message->message,
                                'type' => $message->type,
                                'created_at' => $message->created_at,
                            ];
                        });

        return response()->json([
            'success' => true,
            'data' => $messages,
        ]);
    }

    /**
     * Send a message in a room.
     */
    public function sendMessage(Request $request, Room $room): JsonResponse
    {
        $sessionToken = $request->cookie('room_session_' . $room->id);

        if (!$sessionToken) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $roomUser = RoomUser::where('room_id', $room->id)
                           ->where('session_token', $sessionToken)
                           ->first();

        if (!$roomUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $request->validate([
            'message' => 'required|string|max:1000',
            'type' => 'sometimes|in:text,image',
        ]);

        $type = $request->get('type', 'text');

        $message = RoomMessage::createUserMessage(
            $room->id,
            $roomUser->role,
            $roomUser->name,
            $request->message,
            $type
        );

        $roomUser->updateLastSeen();

        broadcast(new RoomMessageSent($room, $message, $roomUser));

        return response()->json([
            'success' => true,
            'message' => 'Message sent successfully',
            'data' => [
                'id' => $message->id,
                'sender_role' => $message->sender_role,
                'sender_name' => $message->sender_name,
                'message' => $message->message,
                'type' => $message->type,
                'created_at' => $message->created_at,
            ],
        ]);
    }

    /**
     * Leave a room.
     */
    public function leave(Request $request, Room $room): JsonResponse
    {
        $sessionToken = $request->cookie('room_session_' . $room->id);

        if (!$sessionToken) {
            return response()->json([
                'success' => false,
                'message' => 'No session found',
            ], 401);
        }

        $roomUser = RoomUser::where('room_id', $room->id)
                           ->where('session_token', $sessionToken)
                           ->first();

        if (!$roomUser) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid session',
            ], 401);
        }

        RoomActivityLog::logActivity(
            $room->id,
            'room_left',
            $roomUser->name,
            $roomUser->role,
            ucfirst($roomUser->role) . ' left the room'
        );

        RoomMessage::createSystemMessage(
            $room->id,
            $roomUser->name . ' (' . ucfirst($roomUser->role) . ') left the room'
        );

        $roomUser->markAsOffline();

        broadcast(new RoomUserOffline($room, $roomUser));

        Cookie::queue(Cookie::forget('room_session_' . $room->id));

        return response()->json([
            'success' => true,
            'message' => 'Successfully left the room',
        ]);
    }

    /**
     * Get transaction status
     */
    public function getTransactionStatus(Request $request, Room $room): JsonResponse
    {
        $sessionToken = $request->cookie('room_session_' . $room->id);

        if (!$sessionToken) {
            return response()->json([
                'success' => false,
                'message' => 'No session found for this room',
            ], 401);
        }

        $roomUser = RoomUser::where('room_id', $room->id)
                           ->where('session_token', $sessionToken)
                           ->first();

        if (!$roomUser) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid session token',
            ], 401);
        }

        $transactionService = new TransactionService();
        $status = $transactionService->getTransactionStatus($room);

        return response()->json([
            'success' => true,
            'data' => $status,
        ]);
    }

    /**
     * Buyer confirms receipt of goods
     */
    public function confirmReceipt(Request $request, Room $room): JsonResponse
    {
        $sessionToken = $request->cookie('room_session_' . $room->id);

        if (!$sessionToken) {
            return response()->json([
                'success' => false,
                'message' => 'No session found for this room',
            ], 401);
        }

        $roomUser = RoomUser::where('room_id', $room->id)
                           ->where('session_token', $sessionToken)
                           ->where('role', 'buyer')
                           ->first();

        if (!$roomUser) {
            return response()->json([
                'success' => false,
                'message' => 'Only buyer can confirm receipt',
            ], 403);
        }

        $request->validate([
            'notes' => 'sometimes|string|max:500',
        ]);

        $transactionService = new TransactionService();
        $result = $transactionService->confirmReceipt($room, $roomUser, $request->get('notes'));

        if ($result['success']) {
            broadcast(new RoomMessageSent($room, $result['data'], $roomUser));
        }

        return response()->json($result);
    }

    /**
     * Get transaction history
     */
    public function getTransactionHistory(Request $request, Room $room): JsonResponse
    {
        $sessionToken = $request->cookie('room_session_' . $room->id);

        if (!$sessionToken) {
            return response()->json([
                'success' => false,
                'message' => 'No session found for this room',
            ], 401);
        }

        $roomUser = RoomUser::where('room_id', $room->id)
                           ->where('session_token', $sessionToken)
                           ->first();

        if (!$roomUser) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid session token',
            ], 401);
        }

        $transactionService = new TransactionService();
        $history = $transactionService->getTransactionHistory($room);

        return response()->json([
            'success' => true,
            'data' => $history->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'user_name' => $log->user_name,
                    'role' => $log->role,
                    'description' => $log->description,
                    'timestamp' => $log->timestamp,
                ];
            }),
        ]);
    }

    /**
     * Join room using encrypted token
     */
    public function joinWithToken(Request $request, string $token): JsonResponse
    {
        $roomUrlService = new RoomUrlService();
        $decrypted = $roomUrlService->decryptToken($token);

        if (!$decrypted) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired token',
            ], 400);
        }

        $room = Room::findOrFail($decrypted['room_id']);

        $request->merge([
            'role' => $decrypted['role']
        ]);

        return $this->join($request, $room);
    }

    /**
     * Enter room using encrypted token
     */
    public function enterWithToken(Request $request, string $token): JsonResponse
    {
        $roomUrlService = new RoomUrlService();
        $decrypted = $roomUrlService->decryptToken($token);

        if (!$decrypted) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired token',
            ], 400);
        }

        $room = Room::findOrFail($decrypted['room_id']);

        return $this->enter($request, $room);
    }

    /**
     * Generate shareable links for room
     */
    public function generateShareLinks(Request $request): JsonResponse
    {
        $request->validate([
            'room_id' => 'required|integer|exists:rooms,id',
        ]);

        $room = Room::findOrFail($request->room_id);
        $roomUrlService = new RoomUrlService();

        $links = $roomUrlService->generateShareableLinks($room->id);

        return response()->json([
            'success' => true,
            'message' => 'Shareable links generated successfully',
            'data' => [
                'room' => [
                    'id' => $room->id,
                    'room_number' => $room->room_number,
                    'status' => $room->status,
                ],
                'links' => $links
            ],
        ]);
    }
}
