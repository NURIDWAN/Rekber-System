<?php

namespace App\Http\Controllers;

use App\Models\UserVerification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class UserVerificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $verifications = UserVerification::with('user')
            ->when($request->status, function ($query, $status) {
                $query->where('status', $status);
            })
            ->latest()
            ->paginate(10);

        return response()->json($verifications);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'id_card_number' => 'required|string|max:50',
            'id_card_image' => 'required|image|mimes:jpeg,png,jpg|max:2048',
            'selfie_image' => 'required|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        $user = auth()->user();

        if ($user->verification) {
            return response()->json([
                'message' => 'You already have a verification request'
            ], 422);
        }

        $idCardPath = $request->file('id_card_image')->store('verifications/id-cards', 'public');
        $selfiePath = $request->file('selfie_image')->store('verifications/selfies', 'public');

        $verification = UserVerification::create([
            'user_id' => $user->id,
            'id_card_number' => $request->id_card_number,
            'id_card_image' => $idCardPath,
            'selfie_image' => $selfiePath,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Verification submitted successfully',
            'verification' => $verification->load('user')
        ]);
    }

    public function approve(UserVerification $verification): JsonResponse
    {
        $verification->markAsVerified();

        return response()->json([
            'message' => 'User verified successfully',
            'verification' => $verification->load('user')
        ]);
    }

    public function reject(Request $request, UserVerification $verification): JsonResponse
    {
        $request->validate([
            'reason' => 'required|string|max:500'
        ]);

        $verification->markAsRejected($request->reason);

        return response()->json([
            'message' => 'Verification rejected',
            'verification' => $verification->load('user')
        ]);
    }

    public function stats(): JsonResponse
    {
        $stats = [
            'total' => UserVerification::count(),
            'pending' => UserVerification::where('status', 'pending')->count(),
            'verified' => UserVerification::where('status', 'verified')->count(),
            'rejected' => UserVerification::where('status', 'rejected')->count(),
        ];

        return response()->json($stats);
    }
}
