<?php

namespace App\Console\Commands;

use App\Models\RoomUser;
use App\Services\MultiSessionManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class MigrateRoomSessions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'rooms:migrate-sessions {--force : Force migration without confirmation}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Migrate existing room sessions to multi-session format';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting room session migration...');

        if (!$this->option('force')) {
            if (!$this->confirm('This will migrate all existing room sessions to multi-session format. Continue?')) {
                $this->info('Migration cancelled.');
                return Command::SUCCESS;
            }
        }

        $multiSessionManager = app(MultiSessionManager::class);
        $migratedCount = 0;
        $errorCount = 0;

        // Get all RoomUser records that need migration
        $roomUsers = RoomUser::whereNull('user_identifier')
                             ->orWhereNull('migrated_at')
                             ->get();

        $this->info("Found {$roomUsers->count()} room users to migrate.");

        $progressBar = $this->output->createProgressBar($roomUsers->count());
        $progressBar->start();

        foreach ($roomUsers as $roomUser) {
            try {
                // Generate user identifier if missing
                if (!$roomUser->user_identifier) {
                    $roomUser->user_identifier = $multiSessionManager->generateUserIdentifier();
                }

                // Generate new session token if needed
                if (!$multiSessionManager->validateSessionToken($roomUser->session_token)) {
                    $roomUser->session_token = $multiSessionManager->generateSessionToken(
                        $roomUser->room_id,
                        $roomUser->role,
                        $roomUser->user_identifier
                    );
                }

                // Generate device fingerprint
                if (!$roomUser->device_fingerprint) {
                    $roomUser->device_fingerprint = RoomUser::generateDeviceFingerprint();
                }

                // Set session context
                $roomUser->session_context = array_merge($roomUser->session_context ?? [], [
                    'migrated_from_legacy' => true,
                    'migration_date' => now()->toISOString(),
                    'original_joined_at' => $roomUser->joined_at->toISOString(),
                ]);

                // Mark as migrated
                $roomUser->migrated_at = now();
                $roomUser->save();

                $migratedCount++;

                $this->line(" Migrated: Room #{$roomUser->room_id}, {$roomUser->role}, User: {$roomUser->name}");

            } catch (\Exception $e) {
                $errorCount++;
                $this->error(" Failed to migrate RoomUser #{$roomUser->id}: " . $e->getMessage());
                Log::error('Room session migration failed', [
                    'room_user_id' => $roomUser->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
            }

            $progressBar->advance();
        }

        $progressBar->finish();
        $this->newLine();

        // Summary
        $this->info("Migration completed!");
        $this->info("Migrated: {$migratedCount} sessions");
        $this->info("Errors: {$errorCount} sessions");

        if ($errorCount > 0) {
            $this->warn("Some sessions failed to migrate. Check logs for details.");
        }

        // Cleanup old cookies (informational)
        $this->info("Note: Users will need to clear their browser cookies or they will be automatically migrated on next access.");

        return $errorCount === 0 ? Command::SUCCESS : Command::FAILURE;
    }
}