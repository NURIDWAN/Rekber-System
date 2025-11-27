<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\Transaction;
use App\Models\TransactionFile;
use App\Models\RoomActivityLog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GmController extends Controller
{
    /**
     * Display GM room management page.
     */
    public function rooms()
    {
        $rooms = Room::with([
            'users' => function ($query) {
                $query->select('id', 'room_id', 'name', 'role', 'is_online', 'joined_at', 'last_seen');
            },
            'messages' => function ($query) {
                $query->latest()->limit(1);
            },
            'activityLogs' => function ($query) {
                $query->latest()->limit(5);
            }
        ])
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
                'total_rooms' => Room::count(),
                'free_rooms' => Room::where('status', 'free')->count(),
                'in_use_rooms' => Room::where('status', 'in_use')->count(),
                'active_users' => RoomUser::where('is_online', true)->count(),
            ]
        ]);
    }

    /**
     * Display GM dashboard.
     */
    public function dashboard()
    {
        $rooms = Room::with([
            'buyer',
            'seller',
            'messages' => function ($query) {
                $query->latest()->limit(1);
            }
        ])->get()->map(function ($room) {
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
            'total_transactions' => Transaction::count(),
            'pending_payment' => Transaction::where('status', 'pending_payment')->count(),
            'active_transactions' => Transaction::active()->count(),
            'completed_transactions' => Transaction::completed()->count(),
            'disputed_transactions' => Transaction::disputed()->count(),
            'total_volume' => Transaction::sum('amount'),
            'total_commission' => Transaction::sum('commission'),
            'pending_payment_amount' => Transaction::where('status', 'pending_payment')->sum('amount'),
        ];

        // Get recent transactions
        $recentTransactions = Transaction::with(['room', 'buyer', 'seller'])
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
            'totalRooms' => Room::count(),
            'activeTransactions' => Transaction::active()->count(),
            'completedTransactions' => Transaction::completed()->count(),
            'pendingVerifications' => Transaction::whereIn('status', ['awaiting_payment_verification', 'awaiting_shipping_verification'])->count(),
            // Keep original snake_case for backward compatibility if needed temporarily
            'total_rooms' => Room::count(),
            'free_rooms' => Room::where('status', 'free')->count(),
            'in_use_rooms' => Room::where('status', 'in_use')->count(),
            'active_users' => RoomUser::where('is_online', true)->count(),
        ];

        return Inertia::render('gm/dashboard', [
            'rooms' => $rooms,
            'stats' => $stats,
            'transactionStats' => $transactionStats,
            'recentTransactions' => $recentTransactions,
        ]);
    }

    /**
     * Display GM room details page.
     */
    public function roomDetails($room)
    {
        $roomModel = Room::with([
            'buyer',
            'seller',
            'messages' => function ($query) {
                $query->ordered()->limit(100);
            },
            'activityLogs' => function ($query) {
                $query->recent(50);
            }
        ])->findOrFail($room);

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
    }

    /**
     * Display GM transactions management page.
     */
    public function transactions()
    {
        // Get pending transactions data
        $pendingTransactions = Transaction::with(['room', 'buyer', 'seller', 'files'])
            ->where(function ($query) {
                $query->where('status', 'awaiting_payment_verification')
                    ->orWhere('status', 'awaiting_shipping_verification')
                    ->orWhere('status', 'paid')
                    ->orWhere('status', 'shipped');
            })
            ->latest()
            ->get();

        // Get pending files data
        $pendingFiles = TransactionFile::with(['transaction.room', 'verifier'])
            ->where('status', 'pending')
            ->latest()
            ->get();

        // Get comprehensive stats
        $stats = [
            'pending_payment_verification' => Transaction::where('status', 'awaiting_payment_verification')->count(),
            'pending_shipping_verification' => Transaction::where('status', 'awaiting_shipping_verification')->count(),
            'pending_fund_release' => Transaction::where('status', 'goods_received')->count(),
            'total_pending_files' => TransactionFile::where('status', 'pending')->count(),
            'total_transactions' => Transaction::count(),
            'active_transactions' => Transaction::active()->count(),
            'completed_transactions' => Transaction::completed()->count(),
            'disputed_transactions' => Transaction::disputed()->count(),
        ];

        return Inertia::render('transactions/index', [
            'pendingTransactions' => $pendingTransactions,
            'pendingFiles' => $pendingFiles,
            'stats' => $stats,
        ]);
    }

    /**
     * Display GM transaction detail page.
     */
    public function transactionDetail(Transaction $transaction)
    {
        $transaction->load([
            'room',
            'buyer',
            'seller',
            'files' => function ($query) {
                $query->with('verifier');
            },
            'paymentVerifier',
            'shippingVerifier',
            'fundsReleaser'
        ]);

        // Get transaction activities
        $activities = RoomActivityLog::where('room_id', $transaction->room_id)
            ->latest()
            ->limit(20)
            ->get();

        return Inertia::render('transactions/show', [
            'transaction' => $transaction,
            'activities' => $activities,
        ]);
    }

    /**
     * Display user verification management page.
     */
    public function verifications()
    {
        return Inertia::render('verifications/index');
    }
}