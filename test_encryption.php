<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Test the RoomUrlService
try {
    $service = new App\Services\RoomUrlService();

    echo "=== Testing RoomUrlService ===" . PHP_EOL;

    // Test token generation
    $token = $service->generateToken(1, 'buyer');
    echo "Generated Token: " . $token . PHP_EOL;

    // Test token decryption
    $decrypted = $service->decryptToken($token);
    echo "Decrypted: " . json_encode($decrypted) . PHP_EOL;

    // Test shareable links generation
    $links = $service->generateShareableLinks(1);
    echo "Share Links: " . json_encode($links, JSON_PRETTY_PRINT) . PHP_EOL;

    // Test expiry
    echo "Token valid: " . ($decrypted ? "YES" : "NO") . PHP_EOL;

    echo PHP_EOL . "=== Test completed successfully ===" . PHP_EOL;

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
    echo "Trace: " . $e->getTraceAsString() . PHP_EOL;
}