<?php

namespace App\Console\Commands;

use App\Models\RoomUser;
use App\Services\MultiSessionManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CleanupExpiredSessions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'rooms:cleanup-expired {--hours=2 : Expire sessions older than X hours} {--dry-run : Show what would be deleted without actually deleting}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up expired room sessions and offline users';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $hours = $this->option('hours');
        $dryRun = $this->option('dry-run');
        $expireThreshold = Carbon::now()->subHours($hours);

        $this->info("Cleaning up sessions older than {$hours} hours...");
        $this->info("Expire threshold: {$expireThreshold}");

        if ($dryRun) {
            $this->warn('DRY RUN MODE - No actual changes will be made');
        }

        // Find expired sessions
        $expiredSessions = RoomUser::where('last_seen', '<', $expireThreshold)
                                  ->where('is_online', true)
                                  ->with('room')
                                  ->get();

        $this->info("Found {$expiredSessions->count()} expired online sessions");

        $markedOffline = 0;
        $roomsReset = 0;

        foreach ($expiredSessions as $session) {
            $this->line("Room #{$session->room->room_number} - {$session->role} - {$session->name} (last seen: {$session->last_seen})");

            if (!$dryRun) {
                // Mark as offline
                $session->update([
                    'is_online' => false,
                    'offline_at' => now(),
                ]);
                $markedOffline++;

                // Check if room is now empty
                $onlineCount = RoomUser::where('room_id', $session->room_id)
                                       ->where('is_online', true)
                                       ->count();

                if ($onlineCount === 0) {
                    $session->room->update(['status' => 'free']);
                    $roomsReset++;
                    $this->line("  -> Room status reset to 'free'");
                }
            }
        }

        // Clean up very old inactive sessions (older than 7 days)
        $veryOldThreshold = Carbon::now()->subDays(7);
        $veryOldSessions = RoomUser::where('last_seen', '<', $veryOldThreshold)
                                    ->where('is_online', false)
                                    ->count();

        $this->info("Found {$veryOldSessions} very old inactive sessions (older than 7 days)");

        if ($veryOldSessions > 0 && !$dryRun) {
            $this->withProgressBar($veryOldSessions, function () {
                RoomUser::where('last_seen', '<', $veryOldThreshold)
                        ->where('is_online', false)
                        ->delete();
            });
        }

        // Database optimization
        if (!$dryRun) {
            $this->info('Optimizing database...');
            DB::statement('OPTIMIZE TABLE room_users');
            DB::statement('OPTIMIZE TABLE room_activity_logs');
        }

        // Summary
        $this->newLine();
        $this->info('Cleanup Summary:');
        $this->line("Expired sessions marked offline: {$markedOffline}");
        $this->line("Rooms reset to 'free': {$roomsReset}");
        $this->line("Very old sessions deleted: {$veryOldSessions}");

        if ($dryRun) {
            $this->warn('This was a dry run. No changes were made.');
            $this->info('Run without --dry-run to perform actual cleanup.');
        }

        return Command::SUCCESS;
    }
}