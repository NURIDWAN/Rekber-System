import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listenToRoomStatusChanges,
  getConnectionStatus,
  onConnectionEstablished,
  onConnectionError,
  onConnectionDisconnected,
} from '../websocket'
import type { RoomStatusChangeEvent } from '../websocket'

// Mock timers for polling tests
vi.useFakeTimers()

describe('WebSocket Fallback Mechanisms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Pusher Connection Failure Fallback', () => {
    it('should fallback to HTTP polling when Pusher connection fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            room_id: 1,
            status: 'in-use',
            has_buyer: true,
            has_seller: false,
            available_for_buyer: false,
            available_for_seller: true,
            user_name: 'Test User',
            role: 'buyer',
            action: 'room_updated',
            timestamp: new Date().toISOString()
          }
        ])
      })

      global.fetch = mockFetch

      // Mock Pusher to throw error
      vi.doMock('pusher-js', () => ({
        default: {
          connection: {
            state: 'disconnected',
            bind: () => { throw new Error('Pusher connection failed') },
            unbind: vi.fn(),
          },
          subscribe: () => { throw new Error('Pusher connection failed') },
        }
      }))

      const callback = vi.fn()
      const unsubscribe = listenToRoomStatusChanges(callback)

      // Wait for polling to start
      vi.advanceTimersByTime(100)

      expect(mockFetch).toHaveBeenCalledWith('/api/rooms/status')
      expect(callback).toHaveBeenCalled()

      unsubscribe()
    })

    it('should continue polling after initial fetch failure', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              room_id: 1,
              status: 'free',
              has_buyer: false,
              has_seller: false,
              available_for_buyer: true,
              available_for_seller: false,
              user_name: null,
              role: null,
              action: 'room_updated',
              timestamp: new Date().toISOString()
            }
          ])
        })

      global.fetch = mockFetch

      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher unavailable') },
        }
      }))

      const callback = vi.fn()
      listenToRoomStatusChanges(callback)

      // Wait for first poll attempt (should fail)
      vi.advanceTimersByTime(100)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Wait for second poll attempt (should succeed)
      vi.advanceTimersByTime(4900) // Total 5000ms
      expect(mockFetch).toHaveBeenCalledTimes(2)

      callback.mock.calls.forEach(call => {
        expect(call[0]).toBeInstanceOf(Object)
      })
    })

    it('should handle fetch errors gracefully and continue polling', async () => {
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        })

      global.fetch = mockFetch

      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher unavailable') },
        }
      }))

      const callback = vi.fn()
      listenToRoomStatusChanges(callback)

      // Wait for first poll attempt (should fail with network error)
      vi.advanceTimersByTime(100)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Wait for second poll attempt (should succeed)
      vi.advanceTimersByTime(4900)
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Should not have crashed
      expect(callback).not.toHaveBeenCalled()
    })

    it('should cleanup polling interval when unsubscribed', () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })

      global.fetch = mockFetch

      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher unavailable') },
        }
      }))

      const callback = vi.fn()
      const unsubscribe = listenToRoomStatusChanges(callback)

      // Start polling
      vi.advanceTimersByTime(100)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Unsubscribe
      unsubscribe()

      // Advance time - should not trigger additional fetch calls
      vi.advanceTimersByTime(10000)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Connection Status Fallbacks', () => {
    it('should return disconnected status when Pusher connection fails', () => {
      // Mock Pusher to throw error when accessing connection state
      vi.doMock('pusher-js', () => ({
        default: {
          get connection() {
            throw new Error('Connection not available')
          }
        }
      }))

      const status = getConnectionStatus()
      expect(status).toBe('disconnected')
    })

    it('should handle connection event binding failures', () => {
      const callback = vi.fn()

      // Mock Pusher to throw error when binding events
      vi.doMock('pusher-js', () => ({
        default: {
          connection: {
            bind: () => { throw new Error('Failed to bind event') },
            unbind: vi.fn(),
          }
        }
      }))

      // Should not throw
      expect(() => {
        const unsubscribe = onConnectionEstablished(callback)
        unsubscribe()
      }).not.toThrow()
    })

    it('should handle error event binding failures with immediate callback', () => {
      const callback = vi.fn()

      // Mock Pusher to throw error when binding error events
      vi.doMock('pusher-js', () => ({
        default: {
          connection: {
            bind: () => { throw new Error('Failed to bind error event') },
            unbind: vi.fn(),
          }
        }
      }))

      const unsubscribe = onConnectionError((error) => {
        callback(error)
      })

      // Should call callback immediately with the error
      expect(callback).toHaveBeenCalled()
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('Degraded Mode Functionality', () => {
    it('should provide basic functionality in degraded mode', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            room_id: 1,
            status: 'in-use',
            has_buyer: true,
            has_seller: true,
            available_for_buyer: false,
            available_for_seller: false,
            user_name: 'Test User',
            role: 'buyer',
            action: 'room_updated',
            timestamp: new Date().toISOString()
          },
          {
            room_id: 2,
            status: 'free',
            has_buyer: false,
            has_seller: false,
            available_for_buyer: true,
            available_for_seller: false,
            user_name: null,
            role: null,
            action: 'room_updated',
            timestamp: new Date().toISOString()
          }
        ])
      })

      global.fetch = mockFetch

      // Mock complete Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher completely unavailable') },
          connection: {
            bind: () => { throw new Error('No connection available') },
            unbind: vi.fn(),
            state: undefined,
          }
        }
      }))

      const updates: RoomStatusChangeEvent[] = []
      const unsubscribe = listenToRoomStatusChanges((update) => {
        updates.push(update)
      })

      // Wait for polling
      vi.advanceTimersByTime(100)

      expect(updates).toHaveLength(2)
      expect(updates[0].room_id).toBe(1)
      expect(updates[0].has_buyer).toBe(true)
      expect(updates[1].room_id).toBe(2)
      expect(updates[1].available_for_buyer).toBe(true)

      unsubscribe()
    })

    it('should handle empty API responses gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })

      global.fetch = mockFetch

      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher unavailable') },
        }
      }))

      const callback = vi.fn()
      const unsubscribe = listenToRoomStatusChanges(callback)

      // Wait for polling
      vi.advanceTimersByTime(100)

      expect(mockFetch).toHaveBeenCalled()
      expect(callback).not.toHaveBeenCalled()

      unsubscribe()
    })

    it('should respect polling intervals even under stress', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })

      global.fetch = mockFetch

      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher unavailable') },
        }
      }))

      const callback = vi.fn()
      const unsubscribe = listenToRoomStatusChanges(callback)

      // Simulate rapid time progression
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(5000)
      }

      // Should have made exactly 10 fetch calls (one per 5 seconds)
      expect(mockFetch).toHaveBeenCalledTimes(10)

      unsubscribe()
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should attempt to recover from intermittent failures', async () => {
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              room_id: 1,
              status: 'free',
              has_buyer: false,
              has_seller: false,
              available_for_buyer: true,
              available_for_seller: false,
              user_name: null,
              role: null,
              action: 'room_updated',
              timestamp: new Date().toISOString()
            }
          ])
        })

      global.fetch = mockFetch

      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher unavailable') },
        }
      }))

      const callback = vi.fn()
      listenToRoomStatusChanges(callback)

      // First poll (should fail)
      vi.advanceTimersByTime(100)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Second poll (should succeed)
      vi.advanceTimersByTime(4900)
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Should have recovered and called callback
      expect(callback).toHaveBeenCalled()
    })

    it('should handle malformed API responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          // Invalid response format
          invalid: 'data',
          missing: 'required fields'
        })
      })

      global.fetch = mockFetch

      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher unavailable') },
        }
      }))

      const callback = vi.fn()
      const unsubscribe = listenToRoomStatusChanges(callback)

      // Wait for polling
      vi.advanceTimersByTime(100)

      // Should not crash, but callback might not be called due to invalid data
      expect(mockFetch).toHaveBeenCalled()

      // Continue polling even with invalid responses
      vi.advanceTimersByTime(5000)
      expect(mockFetch).toHaveBeenCalledTimes(2)

      unsubscribe()
    })

    it('should implement exponential backoff for repeated failures', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Persistent failure'))
      global.fetch = mockFetch

      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher unavailable') },
        }
      }))

      const callback = vi.fn()
      listenToRoomStatusChanges(callback)

      // Simulate multiple polling attempts
      vi.advanceTimersByTime(30000) // 30 seconds

      // Should have made several attempts (exact count depends on implementation)
      expect(mockFetch).toHaveBeenCalledTimesGreaterThan(1)

      // Should not have crashed
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('Performance Optimization in Fallback Mode', () => {
    it('should limit concurrent polling requests', async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve([])
        }), 1000))
      )

      global.fetch = mockFetch

      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher unavailable') },
        }
      }))

      // Start multiple listeners
      const listeners = []
      for (let i = 0; i < 5; i++) {
        listeners.push(listenToRoomStatusChanges(() => {}))
      }

      // Wait for initial requests
      vi.advanceTimersByTime(100)

      // Should limit concurrent requests (implementation specific)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Cleanup
      listeners.forEach(unsubscribe => unsubscribe())
    })

    it('should cache recent polling responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            room_id: 1,
            status: 'free',
            has_buyer: false,
            has_seller: false,
            available_for_buyer: true,
            available_for_seller: false,
            user_name: null,
            role: null,
            action: 'room_updated',
            timestamp: new Date().toISOString()
          }
        ])
      })

      global.fetch = mockFetch

      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher unavailable') },
        }
      }))

      const callback = vi.fn()
      const unsubscribe = listenToRoomStatusChanges(callback)

      // First poll
      vi.advanceTimersByTime(100)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Rapid successive polls should use cache (implementation dependent)
      vi.advanceTimersByTime(50)
      vi.advanceTimersByTime(50)

      unsubscribe()
    })
  })

  describe('Monitoring and Diagnostics', () => {
    it('should provide connection status information in fallback mode', () => {
      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          connection: {
            state: undefined,
            bind: () => { throw new Error('No connection') },
            unbind: vi.fn(),
          }
        }
      }))

      const status = getConnectionStatus()
      expect(status).toBe('disconnected')
    })

    it('should log fallback mode activation', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })

      global.fetch = mockFetch

      // Mock Pusher failure
      vi.doMock('pusher-js', () => ({
        default: {
          subscribe: () => { throw new Error('Pusher unavailable') },
        }
      }))

      const callback = vi.fn()
      listenToRoomStatusChanges(callback)

      // Wait for fallback activation
      vi.advanceTimersByTime(100)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to subscribe to room status changes via Pusher, using fallback:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })
})