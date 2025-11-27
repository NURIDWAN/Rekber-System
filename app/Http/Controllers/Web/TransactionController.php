<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\RoomUser;
use App\Models\RoomActivityLog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TransactionController extends Controller
{
    /**
     * Display user transactions page.
     */
    public function index()
    {
        // Get current user from session
        $userIdentifier = request('user_identifier');
        $roomUser = request('current_room_user');

        if (!$userIdentifier || !$roomUser) {
            return redirect()->route('rooms.index')
                ->with('error', 'Please join a room first to view transactions');
        }

        // Get transactions for the current user
        $transactions = Transaction::where(function($query) use ($roomUser) {
                $query->where('buyer_id', $roomUser->id)
                      ->orWhere('seller_id', $roomUser->id);
            })
            ->with(['room', 'buyer', 'seller', 'files'])
            ->latest()
            ->get()
            ->map(function ($transaction) use ($roomUser) {
                $userRole = $transaction->buyer_id === $roomUser->id ? 'buyer' : 'seller';

                return [
                    'id' => $transaction->id,
                    'transaction_number' => $transaction->transaction_number,
                    'amount' => $transaction->amount,
                    'currency' => $transaction->currency,
                    'status' => $transaction->status,
                    'status_label' => $transaction->getStatusLabel(),
                    'user_role' => $userRole,
                    'room_number' => $transaction->room->room_number,
                    'buyer_name' => $transaction->buyer?->name,
                    'seller_name' => $transaction->seller?->name,
                    'description' => $transaction->description,
                    'created_at' => $transaction->created_at->format('Y-m-d H:i:s'),
                    'updated_at' => $transaction->updated_at->format('Y-m-d H:i:s'),
                    'files' => $transaction->files->map(function ($file) use ($userRole) {
                        return [
                            'id' => $file->id,
                            'file_type' => $file->file_type,
                            'file_name' => $file->file_name,
                            'file_size' => $file->file_size,
                            'status' => $file->status,
                            'uploaded_by' => $file->uploaded_by,
                            'can_view' => $file->uploaded_by === $userRole ||
                                         in_array($file->status, ['approved', 'verified']),
                            'file_url' => $file->status === 'approved' || $file->status === 'verified'
                                ? \Illuminate\Support\Facades\Storage::url($file->file_path)
                                : null,
                            'created_at' => $file->created_at->format('Y-m-d H:i:s'),
                        ];
                    }),
                ];
            });

        // Get user stats
        $stats = [
            'total_transactions' => $transactions->count(),
            'pending_transactions' => $transactions->where('status', 'pending_payment')->count(),
            'active_transactions' => $transactions->whereIn('status', [
                'paid', 'shipped', 'awaiting_payment_verification', 'awaiting_shipping_verification'
            ])->count(),
            'completed_transactions' => $transactions->where('status', 'completed')->count(),
        ];

        return Inertia::render('user/transactions/index', [
            'transactions' => $transactions,
            'stats' => $stats,
            'currentUser' => [
                'name' => $roomUser->name,
                'role' => $roomUser->role,
                'room_id' => $roomUser->room_id,
            ],
        ]);
    }

    /**
     * Display transaction detail page for user.
     */
    public function show(Transaction $transaction)
    {
        // Get current user from session
        $userIdentifier = request('user_identifier');
        $roomUser = request('current_room_user');

        if (!$userIdentifier || !$roomUser) {
            return redirect()->route('rooms.index')
                ->with('error', 'Please join a room first to view transaction details');
        }

        // Verify user has access to this transaction
        if ($transaction->buyer_id !== $roomUser->id && $transaction->seller_id !== $roomUser->id) {
            return redirect()->route('user.transactions.index')
                ->with('error', 'You do not have access to this transaction');
        }

        $userRole = $transaction->buyer_id === $roomUser->id ? 'buyer' : 'seller';

        // Load transaction with relationships
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
            ->where(function($query) use ($transaction) {
                $query->where('action', 'like', '%payment%')
                      ->orWhere('action', 'like', '%shipping%')
                      ->orWhere('action', 'like', '%transaction%')
                      ->orWhere('user_name', $transaction->buyer?->name)
                      ->orWhere('user_name', $transaction->seller?->name);
            })
            ->latest()
            ->limit(50)
            ->get();

        // Prepare transaction data for user view
        $transactionData = [
            'id' => $transaction->id,
            'transaction_number' => $transaction->transaction_number,
            'amount' => $transaction->amount,
            'currency' => $transaction->currency,
            'status' => $transaction->status,
            'status_label' => $transaction->getStatusLabel(),
            'user_role' => $userRole,
            'description' => $transaction->description,
            'room' => [
                'id' => $transaction->room->id,
                'room_number' => $transaction->room->room_number,
                'status' => $transaction->room->status,
            ],
            'buyer' => $transaction->buyer ? [
                'name' => $transaction->buyer->name,
                'role' => 'buyer',
            ] : null,
            'seller' => $transaction->seller ? [
                'name' => $transaction->seller->name,
                'role' => 'seller',
            ] : null,
            'files' => $transaction->files->map(function ($file) use ($userRole) {
                return [
                    'id' => $file->id,
                    'file_type' => $file->file_type,
                    'file_name' => $file->file_name,
                    'file_size' => $file->file_size,
                    'mime_type' => $file->mime_type,
                    'status' => $file->status,
                    'uploaded_by' => $file->uploaded_by,
                    'can_view' => $file->uploaded_by === $userRole ||
                                 in_array($file->status, ['approved', 'verified']),
                    'file_url' => $file->status === 'approved' || $file->status === 'verified'
                        ? \Illuminate\Support\Facades\Storage::url($file->file_path)
                        : null,
                    'verifier' => $file->verifier ? [
                        'name' => $file->verifier->name,
                    ] : null,
                    'verified_at' => $file->verified_at?->format('Y-m-d H:i:s'),
                    'created_at' => $file->created_at->format('Y-m-d H:i:s'),
                ];
            }),
            'timestamps' => [
                'created_at' => $transaction->created_at->format('Y-m-d H:i:s'),
                'updated_at' => $transaction->updated_at->format('Y-m-d H:i:s'),
                'payment_proof_uploaded_at' => $transaction->payment_proof_uploaded_at?->format('Y-m-d H:i:s'),
                'paid_at' => $transaction->paid_at?->format('Y-m-d H:i:s'),
                'shipping_receipt_uploaded_at' => $transaction->shipping_receipt_uploaded_at?->format('Y-m-d H:i:s'),
                'shipped_at' => $transaction->shipped_at?->format('Y-m-d H:i:s'),
                'goods_received_at' => $transaction->goods_received_at?->format('Y-m-d H:i:s'),
                'completed_at' => $transaction->completed_at?->format('Y-m-d H:i:s'),
            ],
        ];

        // Add verification timestamps for user role
        if ($userRole === 'buyer') {
            $transactionData['payment_verified_at'] = $transaction->payment_verified_at?->format('Y-m-d H:i:s');
            $transactionData['shipping_verified_at'] = $transaction->shipping_verified_at?->format('Y-m-d H:i:s');
            $transactionData['funds_released_at'] = $transaction->funds_released_at?->format('Y-m-d H:i:s');
        }

        return Inertia::render('user/transactions/show', [
            'transaction' => $transactionData,
            'activities' => $activities->map(function ($activity) {
                return [
                    'id' => $activity->id,
                    'action' => $activity->action,
                    'user_name' => $activity->user_name,
                    'role' => $activity->role,
                    'description' => $activity->description,
                    'timestamp' => $activity->timestamp->format('Y-m-d H:i:s'),
                ];
            }),
            'currentUser' => [
                'name' => $roomUser->name,
                'role' => $roomUser->role,
                'room_id' => $roomUser->room_id,
                'user_role_in_transaction' => $userRole,
            ],
        ]);
    }
}