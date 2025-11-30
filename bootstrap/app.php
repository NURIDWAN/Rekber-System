<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state', 'room_session_*', 'rekber_session_*', 'rekber_user_identifier']);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            \App\Http\Middleware\SecurityHeaders::class,
        ]);

        $middleware->alias([
            'gm.auth' => \App\Http\Middleware\GmAuth::class,
            'room.session' => \App\Http\Middleware\RoomSession::class,
            'room.token' => \App\Http\Middleware\ValidateRoomToken::class,
            'room.multi.session' => \App\Http\Middleware\MultiSessionRoomAuth::class,
            'decrypt.room' => \App\Http\Middleware\DecryptRoomId::class,
            'invitation.pin' => \App\Http\Middleware\ValidateInvitationPin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
