<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class GmAuth
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!Auth::guard('gm')->check()) {
            // Add debug logging for troubleshooting
            \Log::warning('GM Authentication failed', [
                'url' => $request->fullUrl(),
                'method' => $request->method(),
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'expects_json' => $request->expectsJson(),
                'has_gm_session' => $request->hasSession(),
                'session_id' => $request->session()->getId(),
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. GM login required.',
                    'debug' => [
                        'guard_checked' => 'gm',
                        'session_exists' => $request->hasSession(),
                    ],
                ], 401);
            }

            return redirect()->guest('/login');
        }

        // Log successful GM authentication for debugging
        \Log::info('GM Authentication successful', [
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'gm_id' => Auth::guard('gm')->id(),
            'gm_email' => Auth::guard('gm')->user()?->email,
        ]);

        return $next($request);
    }
}
