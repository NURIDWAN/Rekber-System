<?php

namespace App\Http\Controllers;

use App\Models\RoomMessage;
use Illuminate\Http\Request;

class SseController extends Controller
{
    /**
     * Stream room messages using Server-Sent Events.
     */
    public function streamRoom(Request $request, int $roomId)
    {
        $lastEventId = (int) $request->header('Last-Event-ID', $request->query('last_id', 0));
        $heartbeatMs = 3000;
        $streamDurationSeconds = 120;

        return response()->stream(function () use ($roomId, $lastEventId, $heartbeatMs, $streamDurationSeconds) {
            @ini_set('output_buffering', 'off');
            @ini_set('zlib.output_compression', '0');
            @ob_end_clean();
            @ob_implicit_flush(true);

            $lastId = $lastEventId;
            $startedAt = microtime(true);

            while (true) {
                $messages = RoomMessage::where('room_id', $roomId)
                    ->where('id', '>', $lastId)
                    ->orderBy('id')
                    ->limit(50)
                    ->get();

                foreach ($messages as $message) {
                    $lastId = $message->id;
                    echo "id: {$message->id}\n";
                    echo "event: room.message\n";
                    echo "retry: {$heartbeatMs}\n";
                    echo 'data: ' . json_encode([
                        'id' => $message->id,
                        'room_id' => $message->room_id,
                        'sender_role' => $message->sender_role,
                        'sender_name' => $message->sender_name,
                        'message' => $message->message,
                        'type' => $message->type,
                        'created_at' => $message->created_at?->toISOString(),
                    ]) . "\n\n";

                    @ob_flush();
                    flush();
                }

                if (connection_aborted()) {
                    break;
                }

                if ((microtime(true) - $startedAt) > $streamDurationSeconds) {
                    // Send a final comment to let the client reconnect cleanly
                    echo ": stream closed\n\n";
                    @ob_flush();
                    flush();
                    break;
                }

                echo ": keep-alive\n\n";
                @ob_flush();
                flush();
                sleep(1);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
