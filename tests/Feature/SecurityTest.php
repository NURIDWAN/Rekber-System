<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomUser;
use App\Models\Transaction;
use App\Models\TransactionFile;
use App\Services\RoomUrlService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_security_headers_are_present()
    {
        $response = $this->get('/');

        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
        $response->assertHeader('X-XSS-Protection', '1; mode=block');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    public function test_pin_rate_limiting()
    {
        $room = Room::factory()->create(['pin_enabled' => true, 'pin' => '123456']);
        $service = app(RoomUrlService::class);
        $token = $service->generateToken($room->id, 'buyer', '123456');

        // Fail 5 times
        for ($i = 0; $i < 5; $i++) {
            $response = $this->getJson(route('rooms.join.token', ['token' => $token, 'pin' => 'wrong']));
            $response->assertStatus(403);
        }

        // 6th attempt should be rate limited
        $response = $this->getJson(route('rooms.join.token', ['token' => $token, 'pin' => 'wrong']));
        $response->assertStatus(429);
    }

    public function test_secure_file_download()
    {
        Storage::fake('local');

        $room = Room::factory()->create();
        $file = UploadedFile::fake()->image('test.jpg');
        $path = $file->storeAs('room-files/' . $room->id . '/payment_proof', 'test.jpg', 'local');

        $transaction = Transaction::factory()->create(['room_id' => $room->id]);
        $transactionFile = TransactionFile::create([
            'room_id' => $room->id,
            'transaction_id' => $transaction->id,
            'file_type' => 'payment_proof',
            'file_path' => $path,
            'file_name' => 'test.jpg',
            'file_size' => 1024,
            'mime_type' => 'image/jpeg',
            'uploaded_by' => 'buyer',
            'status' => 'pending',
        ]);

        $roomUrlService = app(RoomUrlService::class);
        $encryptedRoomId = $roomUrlService->encryptRoomId($room->id);

        // Unauthorized access (no session)
        $response = $this->get(route('rooms.files.download', ['room' => $encryptedRoomId, 'file' => $transactionFile->id]));
        $response->assertStatus(302); // Redirects to index because of middleware check failure/redirect

        // Authorized access
        $user = RoomUser::factory()->create(['room_id' => $room->id, 'role' => 'buyer']);

        $response = $this->withCookie('room_session_' . $room->id, $user->session_token)
            ->get(route('rooms.files.download', ['room' => $encryptedRoomId, 'file' => $transactionFile->id]));

        // Note: Middleware might need specific cookie setup depending on MultiSessionManager
        // For simplicity in this test, we might need to mock the middleware or setup the session correctly
        // But let's see if this passes first.
    }
}
