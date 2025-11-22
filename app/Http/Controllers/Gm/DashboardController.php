<?php

namespace App\Http\Controllers\Gm;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\Transaction;
use App\Models\RoomUser;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Display the GM dashboard.
     */
    public function index()
    {
        $rooms = Room::with(['buyer', 'seller', 'messages' => function ($query) {
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
            'total_rooms' => Room::count(),
            'free_rooms' => Room::where('status', 'free')->count(),
            'in_use_rooms' => Room::where('status', 'in_use')->count(),
            'active_users' => RoomUser::where('is_online', true)->count(),
        ];

        return inertia('dashboard', [
            'rooms' => $rooms,
            'stats' => $stats,
            'transactionStats' => $transactionStats,
            'recentTransactions' => $recentTransactions,
        ]);
    }
}
