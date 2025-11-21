<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomUser;
use App\Models\RoomActivityLog;
use App\Models\RoomMessage;
use App\Events\RoomMessageSent;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    /**
     * Upload file to room (payment proof, shipping receipt, etc.)
     */
    public function uploadToRoom(Request $request, Room $room): JsonResponse
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

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:jpeg,jpg,png,pdf|max:5120', // Max 5MB
            'type' => 'required|in:payment_proof,shipping_receipt,identity_document',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $file = $request->file('file');
            $type = $request->type;

            // Generate unique filename
            $filename = Str::uuid() . '_' . time() . '.' . $file->getClientOriginalExtension();

            // Store file in organized directory structure
            $path = $file->storeAs(
                "rooms/{$room->id}/uploads/{$type}",
                $filename,
                'local'
            );

            // Get public URL for the file
            $url = Storage::url($path);

            // Create activity log
            RoomActivityLog::logActivity(
                $room->id,
                'file_uploaded',
                $roomUser->name,
                $roomUser->role,
                ucfirst(str_replace('_', ' ', $type)) . ' uploaded'
            );

            // Create message about file upload
            $messageContent = "📎 {$roomUser->name} uploaded a " . str_replace('_', ' ', $type);

            $message = RoomMessage::createUserMessage(
                $room->id,
                $roomUser->role,
                $roomUser->name,
                $messageContent,
                'image'
            );

            // Update message with file URL
            $message->update([
                'message' => json_encode([
                    'text' => $messageContent,
                    'file_url' => $url,
                    'file_name' => $file->getClientOriginalName(),
                    'file_size' => $file->getSize(),
                    'file_type' => $file->getMimeType(),
                ])
            ]);

            // Broadcast message
            broadcast(new RoomMessageSent($room, $message, $roomUser));

            $roomUser->updateLastSeen();

            return response()->json([
                'success' => true,
                'message' => 'File uploaded successfully',
                'data' => [
                    'file_url' => $url,
                    'file_name' => $file->getClientOriginalName(),
                    'file_size' => $file->getSize(),
                    'file_type' => $file->getMimeType(),
                    'type' => $type,
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload file: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download file from room
     */
    public function downloadFile(Request $request, Room $room, string $filename): JsonResponse
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

        try {
            // Find the file in storage
            $possiblePaths = [
                "rooms/{$room->id}/uploads/payment_proof/{$filename}",
                "rooms/{$room->id}/uploads/shipping_receipt/{$filename}",
                "rooms/{$room->id}/uploads/identity_document/{$filename}",
            ];

            $filePath = null;
            foreach ($possiblePaths as $path) {
                if (Storage::disk('local')->exists($path)) {
                    $filePath = $path;
                    break;
                }
            }

            if (!$filePath) {
                return response()->json([
                    'success' => false,
                    'message' => 'File not found',
                ], 404);
            }

            // Log download activity
            RoomActivityLog::logActivity(
                $room->id,
                'file_downloaded',
                $roomUser->name,
                $roomUser->role,
                "Downloaded file: {$filename}"
            );

            $roomUser->updateLastSeen();

            // Return file download response
            return Storage::disk('local')->download($filePath, $filename);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to download file: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get list of uploaded files in room
     */
    public function getRoomFiles(Request $request, Room $room): JsonResponse
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

        try {
            $files = [];
            $types = ['payment_proof', 'shipping_receipt', 'identity_document'];

            foreach ($types as $type) {
                $directory = "rooms/{$room->id}/uploads/{$type}";

                if (Storage::disk('local')->exists($directory)) {
                    $filesInType = Storage::disk('local')->files($directory);

                    foreach ($filesInType as $file) {
                        $filename = basename($file);
                        $files[] = [
                            'filename' => $filename,
                            'type' => $type,
                            'url' => Storage::url($file),
                            'size' => Storage::disk('local')->size($file),
                            'last_modified' => Storage::disk('local')->lastModified($file),
                        ];
                    }
                }
            }

            $roomUser->updateLastSeen();

            return response()->json([
                'success' => true,
                'data' => $files,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get files: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete uploaded file (GM only)
     */
    public function deleteFile(Request $request, Room $room, string $filename): JsonResponse
    {
        // This would require GM authentication middleware
        // For now, implement basic functionality

        try {
            $possiblePaths = [
                "rooms/{$room->id}/uploads/payment_proof/{$filename}",
                "rooms/{$room->id}/uploads/shipping_receipt/{$filename}",
                "rooms/{$room->id}/uploads/identity_document/{$filename}",
            ];

            $deleted = false;
            foreach ($possiblePaths as $path) {
                if (Storage::disk('local')->exists($path)) {
                    Storage::disk('local')->delete($path);
                    $deleted = true;
                    break;
                }
            }

            if (!$deleted) {
                return response()->json([
                    'success' => false,
                    'message' => 'File not found',
                ], 404);
            }

            RoomActivityLog::logActivity(
                $room->id,
                'file_deleted',
                'GM',
                'gm',
                "Deleted file: {$filename}"
            );

            return response()->json([
                'success' => true,
                'message' => 'File deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete file: ' . $e->getMessage(),
            ], 500);
        }
    }
}
