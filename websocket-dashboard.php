#!/usr/bin/env php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use App\Services\WebSocketService;

class WebSocketDashboard
{
    private $websocketService;
    private $output;
    private $width;
    private $height;
    private $running = true;
    private $refreshInterval = 1; // seconds
    private $lastUpdate = 0;
    private $totalMessages = 0;
    private $peakConnections = 0;
    private $startTime;

    public function __construct()
    {
        $this->websocketService = new WebSocketService();
        $this->startTime = time();
        $this->initTerminal();
    }

    private function initTerminal()
    {
        // Get terminal dimensions
        $this->updateTerminalSize();

        // Set up signal handlers for graceful shutdown
        pcntl_async_signals(true);
        pcntl_signal(SIGINT, [$this, 'handleShutdown']);
        pcntl_signal(SIGTERM, [$this, 'handleShutdown']);

        // Hide cursor and clear screen
        system('tput civis');
        system('clear');
    }

    private function updateTerminalSize()
    {
        $stty = shell_exec('stty -g 2>/dev/null');
        shell_exec('stty cols 1000 rows 1000');
        $size = shell_exec('stty size');
        shell_exec("stty $stty");

        if ($size) {
            [$rows, $cols] = explode(' ', trim($size));
            $this->height = (int) $rows;
            $this->width = (int) $cols;
        } else {
            $this->width = 80;
            $this->height = 24;
        }
    }

    public function run()
    {
        while ($this->running) {
            $this->render();
            $this->handleInput();
            usleep($this->refreshInterval * 1000000); // Convert to microseconds
        }

        $this->cleanup();
    }

    private function render()
    {
        $now = time();
        if ($now - $this->lastUpdate < $this->refreshInterval) {
            return;
        }
        $this->lastUpdate = $now;

        // Clear screen
        system('clear');

        // Get current data
        $metrics = $this->websocketService->getMetrics();
        $connections = $this->websocketService->getAllConnections();
        $health = $this->websocketService->getSystemHealth();

        // Update stats
        $this->totalMessages = $metrics['messages_sent'] + $metrics['messages_received'];
        $this->peakConnections = max($this->peakConnections, count($connections));

        // Render sections
        $this->renderHeader();
        $this->renderMetrics($metrics);
        $this->renderConnections($connections);
        $this->renderHealth($health);
        $this->renderControls();
        $this->renderFooter();
    }

    private function renderHeader()
    {
        $title = "🔌 WebSocket Real-Time Dashboard";
        $timestamp = date('Y-m-d H:i:s');
        $uptime = $this->formatUptime(time() - $this->startTime);

        echo $this->centerText($title) . "\n";
        echo $this->separator() . "\n";
        echo sprintf("Timestamp: %s | Uptime: %s\n", $timestamp, $uptime);
        echo $this->separator() . "\n\n";
    }

    private function renderMetrics($metrics)
    {
        echo "📊 METRICS\n";
        echo $this->separator() . "\n";

        $metricsGrid = [
            ['Active Connections', $metrics['active_connections'], $this->getStatusColor($metrics['active_connections'] > 0)],
            ['Total Connections', $metrics['total_connections'], 'cyan'],
            ['Messages Sent', $metrics['messages_sent'], 'green'],
            ['Messages Received', $metrics['messages_received'], 'blue'],
            ['Peak Connections', $this->peakConnections, 'yellow'],
            ['Active Rooms', $metrics['rooms_active'], 'magenta'],
            ['Errors', $metrics['errors'], $metrics['errors'] > 0 ? 'red' : 'green'],
            ['Memory Usage', $this->formatBytes(memory_get_usage(true)), 'cyan']
        ];

        $this->renderGrid($metricsGrid);
        echo "\n";
    }

    private function renderConnections($connections)
    {
        echo "🔗 ACTIVE CONNECTIONS\n";
        echo $this->separator() . "\n";

        if (empty($connections)) {
            echo "No active connections\n\n";
            return;
        }

        // Group connections by room
        $roomConnections = [];
        foreach ($connections as $connection) {
            $roomId = $connection['room_id'];
            if (!isset($roomConnections[$roomId])) {
                $roomConnections[$roomId] = [];
            }
            $roomConnections[$roomId][] = $connection;
        }

        foreach ($roomConnections as $roomId => $roomConns) {
            echo "📁 Room {$roomId} (" . count($roomConns) . " users)\n";

            foreach (array_slice($roomConns, 0, 5) as $conn) {
                $lastActivity = $this->formatTimeAgo(strtotime($conn['last_activity']));
                $duration = $this->formatDuration(strtotime($conn['connected_at']));

                echo sprintf(
                    "  👤 User %s | %s | %s | %s\n",
                    $conn['user_id'],
                    $conn['status'],
                    $lastActivity,
                    $duration
                );
            }

            if (count($roomConns) > 5) {
                echo "  ... and " . (count($roomConns) - 5) . " more\n";
            }
            echo "\n";
        }
    }

    private function renderHealth($health)
    {
        echo "🏥 SYSTEM HEALTH\n";
        echo $this->separator() . "\n";

        $healthGrid = [
            ['Status', $health['status'], $health['status'] === 'healthy' ? 'green' : 'red'],
            ['Memory Usage', $this->formatBytes($health['memory_usage']), 'cyan'],
            ['Avg Connections/Room', $health['connections']['avg_per_room'], 'yellow'],
            ['Total Rooms', $health['connections']['rooms'], 'magenta']
        ];

        $this->renderGrid($healthGrid);

        // Connection status bar
        $total = $health['connections']['total'];
        $maxConnections = 100; // Assumed max for visualization
        $percentage = min(100, ($total / $maxConnections) * 100);

        echo "\nConnection Load: " . $this->renderProgressBar($percentage, 30) . " {$percentage}%\n\n";
    }

    private function renderControls()
    {
        echo "🎮 CONTROLS\n";
        echo $this->separator() . "\n";
        echo "[r] Force reconnect test | [c] Clear session data | [t] Send test message\n";
        echo "[l] Load test (10 users) | [s] Toggle speed | [q] Quit\n";
        echo "[Enter] Refresh now\n\n";
    }

    private function renderFooter()
    {
        echo $this->separator() . "\n";
        echo $this->centerText("Press 'q' to quit | Last update: " . date('H:i:s')) . "\n";
    }

    private function handleInput()
    {
        $read = [STDIN];
        $write = [];
        $except = [];

        if (stream_select($read, $write, $except, 0) > 0) {
            $input = trim(fgets(STDIN));

            switch (strtolower($input)) {
                case 'q':
                    $this->running = false;
                    break;
                case 'r':
                    $this->testReconnection();
                    break;
                case 'c':
                    $this->clearSessionData();
                    break;
                case 't':
                    $this->sendTestMessage();
                    break;
                case 'l':
                    $this->runLoadTest();
                    break;
                case 's':
                    $this->toggleSpeed();
                    break;
                case '':
                    $this->lastUpdate = 0; // Force refresh
                    break;
            }
        }
    }

    private function testReconnection()
    {
        echo "\n🔄 Testing reconnection...\n";
        $connections = $this->websocketService->getAllConnections();

        foreach ($connections as $conn) {
            // Simulate reconnection by unregistering and registering
            $this->websocketService->unregisterConnection($conn['connection_id']);
            usleep(100000); // 100ms delay
            $this->websocketService->registerConnection(
                $conn['user_id'],
                $conn['room_id'],
                $conn['connection_id'] . '_reconnected'
            );
        }

        echo "✅ Reconnection test completed!\n";
        sleep(2);
    }

    private function clearSessionData()
    {
        echo "\n🗑️  Clearing session data...\n";
        $this->websocketService->clearSessionData();
        echo "✅ Session data cleared!\n";
        sleep(2);
    }

    private function sendTestMessage()
    {
        echo "\n📨 Sending test message...\n";

        $connections = $this->websocketService->getAllConnections();
        $firstConnection = reset($connections);

        if ($firstConnection) {
            $message = $this->websocketService->sendMessage(
                $firstConnection['room_id'],
                $firstConnection['user_id'],
                'Test message from dashboard - ' . date('H:i:s'),
                'message'
            );

            echo "✅ Test message sent: {$message['id']}\n";
        } else {
            echo "⚠️  No active connections to test with\n";
        }

        sleep(2);
    }

    private function runLoadTest()
    {
        echo "\n⚡ Running load test (10 simulated users)...\n";

        for ($i = 1; $i <= 10; $i++) {
            $this->websocketService->registerConnection(
                "test_user_{$i}",
                "test_room_1",
                "test_conn_{$i}_" . time()
            );
        }

        // Send some messages
        for ($i = 0; $i < 20; $i++) {
            $this->websocketService->sendMessage(
                "test_room_1",
                "test_user_" . ($i % 10 + 1),
                "Load test message " . ($i + 1),
                'message'
            );
            usleep(50000); // 50ms between messages
        }

        echo "✅ Load test completed!\n";
        sleep(2);
    }

    private function toggleSpeed()
    {
        $speeds = [0.5, 1, 2, 5];
        $currentIndex = array_search($this->refreshInterval, $speeds);
        $nextIndex = ($currentIndex + 1) % count($speeds);
        $this->refreshInterval = $speeds[$nextIndex];

        echo "\n⚡ Refresh interval: {$this->refreshInterval}s\n";
        sleep(1);
    }

    private function renderGrid($data)
    {
        $maxLabelWidth = 0;
        foreach ($data as $row) {
            $maxLabelWidth = max($maxLabelWidth, strlen($row[0]));
        }

        foreach ($data as [$label, $value, $color]) {
            $formattedValue = is_numeric($value) ? number_format($value) : $value;
            echo sprintf(
                "  %-" . $maxLabelWidth . "s: %s%s\n",
                $label,
                $this->colorize($formattedValue, $color),
                $this->resetColor()
            );
        }
    }

    private function renderProgressBar($percentage, $width)
    {
        $filled = (int) (($percentage / 100) * $width);
        $empty = $width - $filled;

        $bar = str_repeat('█', $filled) . str_repeat('░', $empty);

        if ($percentage >= 80) {
            $color = 'red';
        } elseif ($percentage >= 60) {
            $color = 'yellow';
        } else {
            $color = 'green';
        }

        return $this->colorize('[' . $bar . ']', $color);
    }

    private function centerText($text)
    {
        $padding = ($this->width - strlen($text)) / 2;
        return str_repeat(' ', (int) $padding) . $text;
    }

    private function separator()
    {
        return str_repeat('─', $this->width);
    }

    private function colorize($text, $color)
    {
        $colors = [
            'black' => '30',
            'red' => '31',
            'green' => '32',
            'yellow' => '33',
            'blue' => '34',
            'magenta' => '35',
            'cyan' => '36',
            'white' => '37'
        ];

        return "\033[" . ($colors[$color] ?? '37') . "m" . $text;
    }

    private function resetColor()
    {
        return "\033[0m";
    }

    private function getStatusColor($condition)
    {
        return $condition ? 'green' : 'red';
    }

    private function formatBytes($bytes)
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);

        $bytes /= (1 << (10 * $pow));

        return round($bytes, 2) . ' ' . $units[$pow];
    }

    private function formatTimeAgo($timestamp)
    {
        $diff = time() - $timestamp;

        if ($diff < 60) {
            return $diff . 's ago';
        } elseif ($diff < 3600) {
            return floor($diff / 60) . 'm ago';
        } else {
            return floor($diff / 3600) . 'h ago';
        }
    }

    private function formatDuration($seconds)
    {
        $diff = time() - $seconds;

        if ($diff < 60) {
            return $diff . 's';
        } elseif ($diff < 3600) {
            return floor($diff / 60) . 'm ' . ($diff % 60) . 's';
        } else {
            $hours = floor($diff / 3600);
            $minutes = floor(($diff % 3600) / 60);
            return "{$hours}h {$minutes}m";
        }
    }

    private function formatUptime($seconds)
    {
        $days = floor($seconds / 86400);
        $hours = floor(($seconds % 86400) / 3600);
        $minutes = floor(($seconds % 3600) / 60);

        if ($days > 0) {
            return "{$days}d {$hours}h {$minutes}m";
        } elseif ($hours > 0) {
            return "{$hours}h {$minutes}m";
        } else {
            return "{$minutes}m";
        }
    }

    public function handleShutdown($signal)
    {
        $this->running = false;
    }

    private function cleanup()
    {
        system('tput cnorm'); // Show cursor
        system('clear');
        echo "WebSocket Dashboard shutdown gracefully.\n";
    }
}

// Run the dashboard
if (php_sapi_name() === 'cli') {
    // Set up STDIN for non-blocking input
    stream_set_blocking(STDIN, false);

    $dashboard = new WebSocketDashboard();
    $dashboard->run();
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}