<?php

namespace App\Http\Controllers;

use App\Services\WebSocketService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class WebSocketController extends Controller
{
    private $websocketService;

    public function __construct(WebSocketService $websocketService)
    {
        $this->websocketService = $websocketService;
    }

    /**
     * Get room messages from session storage
     */
    public function getRoomMessages(Request $request, string $roomId): JsonResponse
    {
        try {
            $limit = min($request->get('limit', 50), 100); // Max 100 messages
            $messages = $this->websocketService->getRoomMessages($roomId, $limit);

            return response()->json([
                'success' => true,
                'messages' => $messages,
                'total' => count($messages)
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to get room messages', [
                'room_id' => $roomId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve messages'
            ], 500);
        }
    }

    /**
     * Get active connections in a room
     */
    public function getRoomConnections(Request $request, string $roomId): JsonResponse
    {
        try {
            $connections = $this->websocketService->getRoomConnections($roomId);

            return response()->json([
                'success' => true,
                'connections' => array_values($connections),
                'total' => count($connections)
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to get room connections', [
                'room_id' => $roomId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve connections'
            ], 500);
        }
    }

    /**
     * Send a message to a room
     */
    public function sendMessage(Request $request, string $roomId): JsonResponse
    {
        $validator = \Validator::make($request->all(), [
            'message' => 'required|string|max:1000',
            // Allow legacy UI types too (text/image) and map them to message semantics
            'type' => 'sometimes|string|in:message,activity,typing,text,image',
            'user_id' => 'required|string',
            'data' => 'sometimes|array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $data = $request->get('data');
            if ($data !== null) {
                $message = $this->websocketService->sendMessage(
                    $roomId,
                    $request->get('user_id'),
                    $request->get('message'),
                    $request->get('type', 'message'),
                    $data
                );
            } else {
                $message = $this->websocketService->sendMessage(
                    $roomId,
                    $request->get('user_id'),
                    $request->get('message'),
                    $request->get('type', 'message')
                );
            }

            return response()->json([
                'success' => true,
                'message' => $message
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send message', [
                'room_id' => $roomId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to send message'
            ], 500);
        }
    }

    /**
     * Send typing indicator
     */
    public function sendTyping(Request $request, string $roomId): JsonResponse
    {
        $validator = \Validator::make($request->all(), [
            'user_id' => 'required|string',
            'is_typing' => 'required|boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $typingData = $this->websocketService->sendTypingIndicator(
                $roomId,
                $request->get('user_id'),
                $request->get('is_typing')
            );

            return response()->json([
                'success' => true,
                'typing' => $typingData
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send typing indicator', [
                'room_id' => $roomId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to send typing indicator'
            ], 500);
        }
    }

    /**
     * Send user activity
     */
    public function sendActivity(Request $request, string $roomId): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|string',
            'activity' => 'required|string|max:100',
            'data' => 'sometimes|array'
        ]);

        try {
            $activityData = $this->websocketService->sendUserActivity(
                $roomId,
                $request->get('user_id'),
                $request->get('activity'),
                $request->get('data', [])
            );

            return response()->json([
                'success' => true,
                'activity' => $activityData
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send activity', [
                'room_id' => $roomId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to send activity'
            ], 500);
        }
    }

    /**
     * Get WebSocket metrics
     */
    public function getMetrics(): JsonResponse
    {
        try {
            $metrics = $this->websocketService->getMetrics();

            return response()->json([
                'success' => true,
                'metrics' => $metrics
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to get metrics', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve metrics'
            ], 500);
        }
    }

    /**
     * Get system health
     */
    public function getHealth(): JsonResponse
    {
        try {
            $health = $this->websocketService->getSystemHealth();

            return response()->json([
                'success' => true,
                'health' => $health
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to get health', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve health information'
            ], 500);
        }
    }

    /**
     * Clear session data for a room
     */
    public function clearSessionData(Request $request, string $roomId): JsonResponse
    {
        try {
            $this->websocketService->clearSessionData($roomId);

            return response()->json([
                'success' => true,
                'message' => 'Session data cleared successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to clear session data', [
                'room_id' => $roomId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to clear session data'
            ], 500);
        }
    }

    /**
     * Cleanup inactive connections
     */
    public function cleanupConnections(Request $request): JsonResponse
    {
        try {
            $inactiveMinutes = $request->get('inactive_minutes', 5);
            $remainingConnections = $this->websocketService->cleanupInactiveConnections($inactiveMinutes);

            return response()->json([
                'success' => true,
                'remaining_connections' => $remainingConnections,
                'message' => 'Cleanup completed successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to cleanup connections', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to cleanup connections'
            ], 500);
        }
    }

    /**
     * Get all active connections
     */
    public function getAllConnections(): JsonResponse
    {
        try {
            $connections = $this->websocketService->getAllConnections();

            return response()->json([
                'success' => true,
                'connections' => array_values($connections),
                'total' => count($connections)
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to get all connections', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve connections'
            ], 500);
        }
    }

    /**
     * Test WebSocket functionality
     */
    public function testConnection(Request $request): JsonResponse
    {
        try {
            $roomId = $request->get('room_id', 'test-room');
            $userId = $request->get('user_id', 'test-user');
            $message = $request->get('message', 'Test message from controller');

            // Register a test connection
            $connectionId = 'test_conn_' . time();
            $connection = $this->websocketService->registerConnection($userId, $roomId, $connectionId);

            // Send a test message
            $sentMessage = $this->websocketService->sendMessage($roomId, $userId, $message);

            // Get room messages
            $messages = $this->websocketService->getRoomMessages($roomId, 5);

            // Get metrics
            $metrics = $this->websocketService->getMetrics();

            // Cleanup test connection
            $this->websocketService->unregisterConnection($connectionId);

            return response()->json([
                'success' => true,
                'test_results' => [
                    'connection_registered' => !empty($connection),
                    'message_sent' => !empty($sentMessage),
                    'messages_retrieved' => count($messages),
                    'metrics_available' => !empty($metrics)
                ],
                'connection' => $connection,
                'message' => $sentMessage,
                'sample_messages' => array_slice($messages, -3),
                'metrics' => $metrics
            ]);
        } catch (\Exception $e) {
            Log::error('WebSocket test failed', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'WebSocket test failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Simulate load test
     */
    public function loadTest(Request $request): JsonResponse
    {
        $validator = \Validator::make($request->all(), [
            'user_count' => 'sometimes|integer|min:1|max:100',
            'messages_per_user' => 'sometimes|integer|min:1|max:50',
            'room_id' => 'sometimes|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $userCount = min($request->get('user_count', 10), 100);
            $messagesPerUser = min($request->get('messages_per_user', 5), 50);
            $roomId = $request->get('room_id', 'load-test-room-' . time());

            $startTime = microtime(true);
            $totalMessages = 0;
            $connections = [];

            // Create connections
            for ($i = 1; $i <= $userCount; $i++) {
                $userId = "load_user_{$i}";
                $connectionId = "load_conn_{$i}_" . time();
                $connection = $this->websocketService->registerConnection($userId, $roomId, $connectionId);
                $connections[] = $connectionId;
            }

            // Send messages
            for ($i = 1; $i <= $userCount; $i++) {
                $userId = "load_user_{$i}";

                for ($j = 1; $j <= $messagesPerUser; $j++) {
                    $message = "Load test message {$j} from user {$i}";
                    $this->websocketService->sendMessage($roomId, $userId, $message);
                    $totalMessages++;
                }
            }

            $endTime = microtime(true);
            $duration = $endTime - $startTime;
            $messagesPerSecond = $totalMessages / $duration;

            // Cleanup connections
            foreach ($connections as $connectionId) {
                $this->websocketService->unregisterConnection($connectionId);
            }

            return response()->json([
                'success' => true,
                'load_test_results' => [
                    'user_count' => $userCount,
                    'messages_per_user' => $messagesPerUser,
                    'total_messages' => $totalMessages,
                    'duration_seconds' => round($duration, 3),
                    'messages_per_second' => round($messagesPerSecond, 2),
                    'room_id' => $roomId
                ],
                'metrics' => $this->websocketService->getMetrics()
            ]);
        } catch (\Exception $e) {
            Log::error('Load test failed', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Load test failed: ' . $e->getMessage()
            ], 500);
        }
    }
}
