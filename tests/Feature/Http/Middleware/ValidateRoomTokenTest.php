<?php

namespace Tests\Feature\Http\Middleware;

use App\Http\Middleware\ValidateRoomToken;
use App\Services\RoomUrlService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Tests\TestCase;
use Mockery;

class ValidateRoomTokenTest extends TestCase
{
    use RefreshDatabase;

    private RoomUrlService $roomUrlService;
    private ValidateRoomToken $middleware;

    protected function setUp(): void
    {
        parent::setUp();
        $this->roomUrlService = new RoomUrlService();
        $this->middleware = new ValidateRoomToken();
    }

    /**
     * Test middleware allows valid token
     */
    public function test_middleware_allows_valid_token(): void
    {
        $roomId = 1;
        $role = 'buyer';
        $token = $this->roomUrlService->generateToken($roomId, $role);

        $request = Request::create('/test', 'POST');
        $request->setRouteResolver(function () use ($token) {
            $route = Mockery::mock(\Illuminate\Routing\Route::class);
            $route->shouldReceive('parameter')->with('token')->andReturn($token);
            return $route;
        });

        $nextCalled = false;
        $next = function ($request) use (&$nextCalled) {
            $nextCalled = true;
            return new Response('OK');
        };

        $response = $this->middleware->handle($request, $next);

        $this->assertTrue($nextCalled);
        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals($roomId, $request->get('room_id_from_token'));
        $this->assertEquals($role, $request->get('role_from_token'));
        $this->assertIsInt($request->get('token_timestamp'));
    }

    /**
     * Test middleware blocks invalid token
     */
    public function test_middleware_blocks_invalid_token(): void
    {
        $invalidToken = 'invalid.token.string';

        $request = Request::create('/test', 'POST');
        $request->setRouteResolver(function () use ($invalidToken) {
            $route = Mockery::mock(\Illuminate\Routing\Route::class);
            $route->shouldReceive('parameter')->with('token')->andReturn($invalidToken);
            return $route;
        });

        $nextCalled = false;
        $next = function ($request) use (&$nextCalled) {
            $nextCalled = true;
            return new Response('OK');
        };

        $response = $this->middleware->handle($request, $next);

        $this->assertFalse($nextCalled);
        $this->assertEquals(400, $response->getStatusCode());

        $responseContent = json_decode($response->getContent(), true);
        $this->assertFalse($responseContent['success']);
        $this->assertEquals('Invalid or expired token', $responseContent['message']);
    }

    /**
     * Test middleware blocks empty token
     */
    public function test_middleware_blocks_empty_token(): void
    {
        $request = Request::create('/test', 'POST');
        $request->setRouteResolver(function () {
            $route = Mockery::mock(\Illuminate\Routing\Route::class);
            $route->shouldReceive('parameter')->with('token')->andReturn(null);
            return $route;
        });

        $nextCalled = false;
        $next = function ($request) use (&$nextCalled) {
            $nextCalled = true;
            return new Response('OK');
        };

        $response = $this->middleware->handle($request, $next);

        $this->assertFalse($nextCalled);
        $this->assertEquals(400, $response->getStatusCode());

        $responseContent = json_decode($response->getContent(), true);
        $this->assertFalse($responseContent['success']);
        $this->assertEquals('Token is required', $responseContent['message']);
    }

    /**
     * Test middleware blocks expired token
     */
    public function test_middleware_blocks_expired_token(): void
    {
        // Mock the service to return null (expired/invalid)
        $mockService = Mockery::mock(RoomUrlService::class);
        $mockService->shouldReceive('decryptToken')->andReturn(null);

        $this->app->instance(RoomUrlService::class, $mockService);

        $token = 'some.expired.token';

        $request = Request::create('/test', 'POST');
        $request->setRouteResolver(function () use ($token) {
            $route = Mockery::mock(\Illuminate\Routing\Route::class);
            $route->shouldReceive('parameter')->with('token')->andReturn($token);
            return $route;
        });

        $nextCalled = false;
        $next = function ($request) use (&$nextCalled) {
            $nextCalled = true;
            return new Response('OK');
        };

        $response = $this->middleware->handle($request, $next);

        $this->assertFalse($nextCalled);
        $this->assertEquals(400, $response->getStatusCode());
    }

    /**
     * Test middleware adds decrypted data to request
     */
    public function test_middleware_adds_decrypted_data_to_request(): void
    {
        $roomId = 42;
        $role = 'seller';
        $token = $this->roomUrlService->generateToken($roomId, $role);

        $request = Request::create('/test', 'POST');
        $request->setRouteResolver(function () use ($token) {
            $route = Mockery::mock(\Illuminate\Routing\Route::class);
            $route->shouldReceive('parameter')->with('token')->andReturn($token);
            return $route;
        });

        $next = function ($request) {
            return new Response('OK');
        };

        $response = $this->middleware->handle($request, $next);

        $this->assertEquals($roomId, $request->get('room_id_from_token'));
        $this->assertEquals($role, $request->get('role_from_token'));
        $this->assertIsInt($request->get('token_timestamp'));
    }

    /**
     * Test middleware with different valid roles
     */
    public function test_middleware_with_different_valid_roles(): void
    {
        $roles = ['buyer', 'seller'];

        foreach ($roles as $role) {
            $token = $this->roomUrlService->generateToken(1, $role);

            $request = Request::create('/test', 'POST');
            $request->setRouteResolver(function () use ($token) {
                $route = Mockery::mock(\Illuminate\Routing\Route::class);
                $route->shouldReceive('parameter')->with('token')->andReturn($token);
                return $route;
            });

            $nextCalled = false;
            $next = function ($request) use (&$nextCalled) {
                $nextCalled = true;
                return new Response('OK');
            };

            $response = $this->middleware->handle($request, $next);

            $this->assertTrue($nextCalled, "Failed for role: {$role}");
            $this->assertEquals($role, $request->get('role_from_token'));
        }
    }

    /**
     * Test middleware request data preservation
     */
    public function test_middleware_preserves_existing_request_data(): void
    {
        $token = $this->roomUrlService->generateToken(1, 'buyer');

        $request = Request::create('/test', 'POST', [
            'existing_data' => 'should_be_preserved',
            'another_field' => 123
        ]);

        $request->setRouteResolver(function () use ($token) {
            $route = Mockery::mock(\Illuminate\Routing\Route::class);
            $route->shouldReceive('parameter')->with('token')->andReturn($token);
            return $route;
        });

        $next = function ($request) {
            return new Response('OK');
        };

        $response = $this->middleware->handle($request, $next);

        // Existing data should be preserved
        $this->assertEquals('should_be_preserved', $request->get('existing_data'));
        $this->assertEquals(123, $request->get('another_field'));

        // Token data should be added
        $this->assertEquals(1, $request->get('room_id_from_token'));
        $this->assertEquals('buyer', $request->get('role_from_token'));
    }
}
