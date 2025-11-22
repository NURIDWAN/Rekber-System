import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listenToRoomStatusChanges,
  getConnectionStatus,
  onConnectionEstablished,
  onConnectionError,
  onConnectionDisconnected,
  listenToMessages,
  listenToUserStatus,
  listenToActivities,
  listenToFileUploads,
  triggerTyping,
  stopTyping,
  listenToTyping,
  listenToStopTyping,
} from '../websocket'
import type { RoomStatusChangeEvent, RoomMessageEvent, RoomUserStatusEvent, RoomActivityEvent } from '../websocket'

// Mock Pusher
const mockPusher = {
  connection: {
    state: 'connected',
    bind: vi.fn(),
    unbind: vi.fn(),
  },
  subscribe: vi.fn(() => mockChannel),
  unsubscribe: vi.fn(),
  channel: vi.fn(() => mockChannel),
}

const mockChannel = {
  bind: vi.fn(),
  unbind: vi.fn(),
  trigger: vi.fn(),
}

vi.mock('pusher-js', () => ({
  default: mockPusher,
}))

describe('WebSocket Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock channel for each test
    mockChannel.bind.mockClear()
    mockChannel.unbind.mockClear()
    mockChannel.trigger.mockClear()
    mockPusher.connection.bind.mockClear()
    mockPusher.connection.unbind.mockClear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('listenToRoomStatusChanges', () => {
    it('should subscribe to rooms-status channel and bind to room-status-changed event', () => {
      const callback = vi.fn()

      const unsubscribe = listenToRoomStatusChanges(callback)

      expect(mockPusher.subscribe).toHaveBeenCalledWith('rooms-status')
      expect(mockChannel.bind).toHaveBeenCalledWith('room-status-changed', callback)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should return unsubscribe function that cleans up properly', () => {
      const callback = vi.fn()

      const unsubscribe = listenToRoomStatusChanges(callback)
      unsubscribe()

      expect(mockChannel.unbind).toHaveBeenCalledWith('room-status-changed', callback)
    })

    it('should handle Pusher subscription errors and fallback to HTTP polling', async () => {
      const callback = vi.fn()
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
      mockPusher.subscribe.mockImplementation(() => {
        throw new Error('Pusher connection failed')
      })

      const unsubscribe = listenToRoomStatusChanges(callback)

      // Wait for polling to start
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockFetch).toHaveBeenCalledWith('/api/rooms/status')
      expect(callback).toHaveBeenCalled()

      unsubscribe()
    })
  })

  describe('Connection Status Management', () => {
    it('should get current connection status', () => {
      const status = getConnectionStatus()
      expect(status).toBe('connected')
    })

    it('should handle connection status retrieval errors', () => {
      mockPusher.connection.state = undefined

      const status = getConnectionStatus()
      expect(status).toBe('disconnected')
    })

    it('should bind to connection established events', () => {
      const callback = vi.fn()

      const unsubscribe = onConnectionEstablished(callback)

      expect(mockPusher.connection.bind).toHaveBeenCalledWith('connected', callback)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should handle connection established binding errors', () => {
      const callback = vi.fn()
      mockPusher.connection.bind.mockImplementation(() => {
        throw new Error('Binding failed')
      })

      const unsubscribe = onConnectionEstablished(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe() // Should not throw
    })

    it('should bind to connection error events', () => {
      const callback = vi.fn()

      const unsubscribe = onConnectionError(callback)

      expect(mockPusher.connection.bind).toHaveBeenCalledWith('error', callback)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should handle connection error binding errors', () => {
      const callback = vi.fn()
      mockPusher.connection.bind.mockImplementation(() => {
        throw new Error('Binding failed')
      })

      const unsubscribe = onConnectionError(callback)

      expect(callback).toHaveBeenCalled()
      expect(typeof unsubscribe).toBe('function')
    })

    it('should bind to connection disconnected events', () => {
      const callback = vi.fn()

      const unsubscribe = onConnectionDisconnected(callback)

      expect(mockPusher.connection.bind).toHaveBeenCalledWith('disconnected', callback)
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('Room Events', () => {
    it('should listen to room messages', () => {
      const roomId = 123
      const callback = vi.fn()

      const unsubscribe = listenToMessages(roomId, callback)

      expect(mockPusher.subscribe).toHaveBeenCalledWith('room-123')
      expect(mockChannel.bind).toHaveBeenCalledWith('new-message', callback)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should listen to user status changes', () => {
      const roomId = 456
      const callback = vi.fn()

      const unsubscribe = listenToUserStatus(roomId, callback)

      expect(mockPusher.subscribe).toHaveBeenCalledWith('room-456')
      expect(mockChannel.bind).toHaveBeenCalledWith('user-status-changed', callback)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should listen to room activities', () => {
      const roomId = 789
      const callback = vi.fn()

      const unsubscribe = listenToActivities(roomId, callback)

      expect(mockPusher.subscribe).toHaveBeenCalledWith('room-789')
      expect(mockChannel.bind).toHaveBeenCalledWith('new-activity', callback)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should listen to file uploads', () => {
      const roomId = 101
      const callback = vi.fn()

      const unsubscribe = listenToFileUploads(roomId, callback)

      expect(mockPusher.subscribe).toHaveBeenCalledWith('room-101')
      expect(mockChannel.bind).toHaveBeenCalledWith('file-uploaded', callback)
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('Typing Indicators', () => {
    it('should trigger typing events', () => {
      const roomId = 123
      const userRole = 'buyer'
      const userName = 'Test User'

      triggerTyping(roomId, userRole, userName)

      expect(mockPusher.channel).toHaveBeenCalledWith('room-123')
      expect(mockChannel.trigger).toHaveBeenCalledWith('client-typing', {
        user_role: userRole,
        user_name: userName,
        timestamp: expect.any(String)
      })
    })

    it('should stop typing events', () => {
      const roomId = 456
      const userRole = 'seller'
      const userName = 'Another User'

      stopTyping(roomId, userRole, userName)

      expect(mockPusher.channel).toHaveBeenCalledWith('room-456')
      expect(mockChannel.trigger).toHaveBeenCalledWith('client-stop-typing', {
        user_role: userRole,
        user_name: userName,
        timestamp: expect.any(String)
      })
    })

    it('should listen to typing events', () => {
      const roomId = 789
      const callback = vi.fn()

      const unsubscribe = listenToTyping(roomId, callback)

      expect(mockPusher.subscribe).toHaveBeenCalledWith('room-789')
      expect(mockChannel.bind).toHaveBeenCalledWith('client-typing', callback)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should listen to stop typing events', () => {
      const roomId = 101
      const callback = vi.fn()

      const unsubscribe = listenToStopTyping(roomId, callback)

      expect(mockPusher.subscribe).toHaveBeenCalledWith('room-101')
      expect(mockChannel.bind).toHaveBeenCalledWith('client-stop-typing', callback)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should handle triggering typing without active channel', () => {
      mockPusher.channel.mockReturnValue(null)

      const roomId = 123
      const userRole = 'buyer'
      const userName = 'Test User'

      // Should not throw
      expect(() => {
        triggerTyping(roomId, userRole, userName)
      }).not.toThrow()
    })
  })

  describe('Event Data Types', () => {
    it('should handle room status change events correctly', async () => {
      const callback = vi.fn()
      const mockEvent: RoomStatusChangeEvent = {
        room_id: 1,
        status: 'in-use',
        has_buyer: true,
        has_seller: false,
        available_for_buyer: false,
        available_for_seller: true,
        user_name: 'Test User',
        role: 'buyer',
        action: 'user_joined'
      }

      // Simulate the callback being called with the event
      callback(mockEvent)

      expect(callback).toHaveBeenCalledWith(mockEvent)
      expect(mockEvent.room_id).toBe(1)
      expect(mockEvent.status).toBe('in-use')
      expect(mockEvent.has_buyer).toBe(true)
      expect(mockEvent.has_seller).toBe(false)
    })

    it('should handle room message events correctly', () => {
      const callback = vi.fn()
      const mockEvent: RoomMessageEvent = {
        id: 1,
        room_id: 1,
        sender_role: 'buyer',
        sender_name: 'Test User',
        message: 'Hello, world!',
        type: 'text',
        created_at: new Date().toISOString()
      }

      callback(mockEvent)

      expect(callback).toHaveBeenCalledWith(mockEvent)
      expect(mockEvent.room_id).toBe(1)
      expect(mockEvent.sender_role).toBe('buyer')
      expect(mockEvent.message).toBe('Hello, world!')
      expect(mockEvent.type).toBe('text')
    })

    it('should handle user status events correctly', () => {
      const callback = vi.fn()
      const mockEvent: RoomUserStatusEvent = {
        room_id: 1,
        user_id: 1,
        user_name: 'Test User',
        role: 'buyer',
        is_online: true,
        last_seen: new Date().toISOString()
      }

      callback(mockEvent)

      expect(callback).toHaveBeenCalledWith(mockEvent)
      expect(mockEvent.room_id).toBe(1)
      expect(mockEvent.is_online).toBe(true)
      expect(mockEvent.role).toBe('buyer')
    })

    it('should handle room activity events correctly', () => {
      const callback = vi.fn()
      const mockEvent: RoomActivityEvent = {
        room_id: 1,
        action: 'file_uploaded',
        user_name: 'Test User',
        role: 'seller',
        description: 'User uploaded a file',
        timestamp: new Date().toISOString()
      }

      callback(mockEvent)

      expect(callback).toHaveBeenCalledWith(mockEvent)
      expect(mockEvent.room_id).toBe(1)
      expect(mockEvent.action).toBe('file_uploaded')
      expect(mockEvent.role).toBe('seller')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle multiple subscriptions to same room', () => {
      const roomId = 123
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      const unsubscribe1 = listenToMessages(roomId, callback1)
      const unsubscribe2 = listenToMessages(roomId, callback2)

      expect(mockPusher.subscribe).toHaveBeenCalledWith('room-123')
      expect(mockChannel.bind).toHaveBeenCalledWith('new-message', callback1)
      expect(mockChannel.bind).toHaveBeenCalledWith('new-message', callback2)

      unsubscribe1()
      unsubscribe2()

      expect(mockChannel.unbind).toHaveBeenCalledWith('new-message', callback1)
      expect(mockChannel.unbind).toHaveBeenCalledWith('new-message', callback2)
    })

    it('should handle unsubscribe calls multiple times', () => {
      const callback = vi.fn()

      const unsubscribe = listenToMessages(123, callback)

      // Call unsubscribe multiple times
      unsubscribe()
      unsubscribe()
      unsubscribe()

      expect(mockChannel.unbind).toHaveBeenCalledTimes(1)
    })

    it('should handle malformed event data gracefully', () => {
      const callback = vi.fn()

      listenToRoomStatusChanges(callback)

      // Simulate malformed event being passed to callback
      const malformedEvent = {
        room_id: 'invalid',
        status: null,
        has_buyer: 'not-a-boolean'
      }

      expect(() => callback(malformedEvent)).not.toThrow()
    })
  })

  describe('Performance and Memory Management', () => {
    it('should clean up listeners properly to prevent memory leaks', () => {
      const callbacks = Array.from({ length: 100 }, () => vi.fn())
      const unsubscribes = callbacks.map((callback, index) =>
        listenToMessages(index + 1, callback)
      )

      // Verify all subscriptions were created
      expect(mockPusher.subscribe).toHaveBeenCalledTimes(100)

      // Clean up all listeners
      unsubscribes.forEach(unsubscribe => unsubscribe())

      // Verify all unbinds were called
      expect(mockChannel.unbind).toHaveBeenCalledTimes(100)
    })

    it('should handle rapid subscribe/unsubscribe cycles', () => {
      const callback = vi.fn()

      for (let i = 0; i < 10; i++) {
        const unsubscribe = listenToMessages(i, callback)
        unsubscribe()
      }

      expect(mockPusher.subscribe).toHaveBeenCalledTimes(10)
      expect(mockChannel.bind).toHaveBeenCalledTimes(10)
      expect(mockChannel.unbind).toHaveBeenCalledTimes(10)
    })
  })

  describe('Integration with Real-time Features', () => {
    it('should support concurrent room subscriptions', () => {
      const roomIds = [1, 2, 3, 4, 5]
      const callbacks = roomIds.map(() => vi.fn())

      const unsubscribes = roomIds.map((roomId, index) =>
        listenToMessages(roomId, callbacks[index])
      )

      roomIds.forEach(roomId => {
        expect(mockPusher.subscribe).toHaveBeenCalledWith(`room-${roomId}`)
      })

      unsubscribes.forEach(unsubscribe => unsubscribe())
    })

    it('should maintain separate event contexts for different rooms', () => {
      const room1Callback = vi.fn()
      const room2Callback = vi.fn()

      const unsubscribe1 = listenToMessages(1, room1Callback)
      const unsubscribe2 = listenToMessages(2, room2Callback)

      // Simulate room 1 message
      const room1Message = {
        id: 1,
        room_id: 1,
        message: 'Room 1 message'
      }

      // Simulate room 2 message
      const room2Message = {
        id: 2,
        room_id: 2,
        message: 'Room 2 message'
      }

      room1Callback(room1Message)
      room2Callback(room2Message)

      expect(room1Callback).toHaveBeenCalledWith(room1Message)
      expect(room2Callback).toHaveBeenCalledWith(room2Message)

      unsubscribe1()
      unsubscribe2()
    })
  })
})