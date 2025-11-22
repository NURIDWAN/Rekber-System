<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function assertStringContains($needle, $haystack, $message = '')
    {
        $this->assertStringContainsString($needle, $haystack, $message);
    }
}

if (!function_exists('str_random')) {
    function str_random(int $length = 16): string
    {
        return \Illuminate\Support\Str::random($length);
    }
}
