<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DebugConnectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_connection_is_sqlite_memory()
    {
        $connection = DB::connection()->getName();
        $database = DB::connection()->getDatabaseName();
        $driver = DB::connection()->getDriverName();

        echo "\n--- DEBUG INFO ---\n";
        echo "Connection: " . $connection . "\n";
        echo "Database: " . $database . "\n";
        echo "Driver: " . $driver . "\n";
        echo "------------------\n";

        $this->assertEquals('sqlite', $driver);
        $this->assertEquals(':memory:', $database);
    }
}
