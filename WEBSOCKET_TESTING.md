# WebSocket Testing Suite

This document provides comprehensive testing for the WebSocket functionality, including unit tests, integration tests, and fallback mechanism testing.

## Overview

The WebSocket testing suite covers:

1. **Backend Tests** - Laravel/PHP unit and feature tests
2. **Frontend Tests** - React/Vitest unit and component tests
3. **Integration Tests** - End-to-end flow testing
4. **Fallback Tests** - HTTP polling and error recovery testing

## Test Structure

### Backend Tests

#### Controller Tests
- **Location**: `tests/Feature/Http/Controllers/WebSocketControllerTest.php`
- **Coverage**: WebSocket HTTP API endpoints
- **Tests**:
  - Room messages retrieval
  - Connection management
  - Message sending
  - Typing indicators
  - User activities
  - Metrics and health checks
  - Load testing
  - Error handling

#### Service Tests
- **Location**: `tests/Unit/Services/WebSocketServiceTest.php`
- **Coverage**: WebSocketService business logic
- **Tests**:
  - Connection registration/unregistration
  - Message storage and retrieval
  - Room management
  - Metrics tracking
  - Session data cleanup
  - Performance optimization
  - Concurrency handling

#### Integration Tests
- **Location**: `tests/Feature/WebSocket/WebSocketIntegrationTest.php`
- **Coverage**: Complete WebSocket workflows
- **Tests**:
  - Room sharing flow
  - Real-time updates
  - Message broadcasting
  - Connection lifecycle
  - Health monitoring
  - Cleanup operations

#### Fallback Tests
- **Location**: `tests/Feature/WebSocket/WebSocketFallbackTest.php`
- **Coverage**: HTTP polling fallback mechanisms
- **Tests**:
  - Room status API
  - Share links API
  - Error handling
  - Performance under load
  - Data consistency

### Frontend Tests

#### WebSocket Client Tests
- **Location**: `resources/js/lib/__tests__/websocket.test.ts`
- **Coverage**: WebSocket client library
- **Tests**:
  - Connection management
  - Event listening
  - Typing indicators
  - Error handling
  - Memory management

#### React Hook Tests
- **Location**: `resources/js/hooks/__tests__/useRealtimeRooms.test.tsx`
- **Coverage**: Real-time room updates hook
- **Tests**:
  - Hook initialization
  - Connection state management
  - Room status updates
  - Error handling
  - Cleanup

#### Component Tests
- **Location**: `resources/js/components/__tests__/ShareRoomModal.test.tsx`
- **Coverage**: Share modal component
- **Tests**:
  - Rendering
  - API integration
  - QR code generation
  - Copy functionality
  - Accessibility

#### Fallback Tests
- **Location**: `resources/js/lib/__tests__/websocket-fallback.test.ts`
- **Coverage**: HTTP polling fallback
- **Tests**:
  - Pusher connection failures
  - Polling mechanisms
  - Error recovery
  - Performance optimization
  - Diagnostics

## Running Tests

### Backend Tests

```bash
# Run all WebSocket tests
./vendor/bin/phpunit tests/Feature/WebSocket/ --testsuite=Feature

# Run specific test file
./vendor/bin/phpunit tests/Feature/WebSocket/WebSocketIntegrationTest.php

# Run with coverage
./vendor/bin/phpunit tests/Feature/WebSocket/ --coverage-html=coverage/websocket
```

### Frontend Tests

```bash
# Install test dependencies (if not already installed)
npm install

# Run all tests
npm run test

# Run tests in watch mode
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test resources/js/lib/__tests__/websocket.test.ts
```

### Configuration

#### Vitest Configuration
- **Location**: `vitest.config.ts`
- **Features**:
  - jsdom environment
  - Path aliases (@/*)
  - Coverage reporting
  - Mock setup

#### Test Setup
- **Location**: `test/setup.ts`
- **Features**:
  - Global mocks (Pusher, QR code, clipboard)
  - Custom matchers
  - Error handling

## Test Scenarios

### Happy Path Scenarios

1. **Complete Room Sharing Flow**
   - User clicks share button
   - Modal opens with role-specific links
   - QR codes generated
   - Links copied successfully
   - Room fills up → share button disappears

2. **Real-time Room Updates**
   - Buyer joins free room
   - Share button changes from "buyer" to "seller"
   - Seller joins room
   - Share button disappears
   - WebSocket events update UI

3. **Message Broadcasting**
   - Multiple users in room
   - Messages sent and received
   - Typing indicators work
   - File uploads broadcast

### Error Scenarios

1. **WebSocket Connection Failure**
   - Pusher connection fails
   - Falls back to HTTP polling
   - UI shows "Connection issue"
   - Updates continue via polling

2. **Network Errors**
   - API requests fail
   - Handles gracefully
   - Retry mechanisms work
   - User sees appropriate feedback

3. **Invalid Data**
   - Malformed API responses
   - Missing required fields
   - Type validation failures
   - Graceful degradation

### Performance Scenarios

1. **High Load**
   - Many concurrent connections
   - Rapid message sending
   - Memory usage optimization
   - Response time under 1 second

2. **Large Data Sets**
   - Many rooms in status API
   - Long message history
   - Efficient pagination
   - Memory management

3. **Connection Churn**
   - Rapid connect/disconnect
   - Cleanup operations
   - Resource reclamation
   - Memory leak prevention

## Mock Strategy

### Backend Mocks
- **WebSocketService**: Mock for controller tests
- **Cache**: In-memory cache for testing
- **Database**: SQLite in-memory database
- **Events**: Event faking for isolation

### Frontend Mocks
- **Pusher**: Mock WebSocket library
- **QR Code**: Mock QR generation
- **Clipboard**: Mock clipboard API
- **Fetch**: Mock HTTP requests
- **Timers**: Fake timers for polling

## Coverage Goals

- **Backend**: >90% line coverage
- **Frontend**: >85% line coverage
- **Integration**: All major workflows covered
- **Fallback**: All error scenarios covered

## CI/CD Integration

### GitHub Actions
```yaml
name: WebSocket Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
      - name: Install Dependencies
        run: composer install
      - name: Run Tests
        run: ./vendor/bin/phpunit tests/Feature/WebSocket/

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install Dependencies
        run: npm install
      - name: Run Tests
        run: npm run test:coverage
```

## Test Data Management

### Factories
- **Room Factory**: Creates test rooms
- **RoomUser Factory**: Creates test users
- **WebSocket Data**: Mock message and connection data

### Fixtures
- **Sample Messages**: Predefined test messages
- **User Profiles**: Test user data
- **Room Configurations**: Different room states

## Debugging Tests

### Backend Debugging
```bash
# Run with verbose output
./vendor/bin/phpunit --verbose tests/Feature/WebSocket/

# Stop on first failure
./vendor/bin/phpunit --stop-on-failure tests/Feature/WebSocket/

# Run specific test method
./vendor/bin/phpunit --filter test_method_name
```

### Frontend Debugging
```bash
# Run in debug mode
npm run test:debug

# Run specific test
npm run test -- --reporter=verbose --testNamePattern="specific test"

# Generate coverage report
npm run test:coverage -- --reporter=verbose
```

## Best Practices

### Test Organization
- One test class per major component
- Descriptive test method names
- Arrange-Act-Assert pattern
- Independent test cases

### Data Management
- Use factories for test data
- Clean up after each test
- Avoid hardcoded test data
- Use realistic test scenarios

### Error Testing
- Test all error conditions
- Verify error messages
- Test recovery mechanisms
- Check resource cleanup

### Performance Testing
- Measure response times
- Test with large datasets
- Monitor memory usage
- Test concurrent operations

## Future Enhancements

### Additional Test Types
- End-to-end browser tests (Playwright/Cypress)
- Load testing with Artillery
- Security testing
- Accessibility testing

### Monitoring
- Test performance tracking
- Coverage trend analysis
- Flaky test detection
- Automated test reporting

### Documentation
- Interactive test documentation
- Test scenario visualizations
- Performance benchmarking
- Troubleshooting guides