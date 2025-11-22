import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRealtimeRooms } from '../useRealtimeRooms'
import { listenToRoomStatusChanges, onConnectionEstablished, onConnectionError, onConnectionDisconnected } from '@/lib/websocket'
import type { RoomStatusChangeEvent } from '@/lib/websocket'

// Mock the websocket module
vi.mock('@/lib/websocket')

const mockListenToRoomStatusChanges = vi.mocked(listenToRoomStatusChanges)
const mockOnConnectionEstablished = vi.mocked(onConnectionEstablished)
const mockOnConnectionError = vi.mocked(onConnectionError)
const mockOnConnectionDisconnected = vi.mocked(onConnectionDisconnected)

describe('useRealtimeRooms', () => {
  const initialRooms = [
    {
      id: 1,
      status: 'free' as const,
      lastActivity: '2 min ago',
      participants: ['Buyer', 'Seller', 'GM'],
      has_buyer: false,
      has_seller: false,
      available_for_buyer: true,
      available_for_seller: false,
      room_number: 1
    },
    {
      id: 2,
      status: 'in-use' as const,
      lastActivity: '5 min ago',
      participants: ['Buyer', 'Seller', 'GM'],
      has_buyer: true,
      has_seller: false,
      available_for_buyer: false,
      available_for_seller: true,
      room_number: 2
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock implementations
    mockListenToRoomStatusChanges.mockReturnValue(() => {})
    mockOnConnectionEstablished.mockReturnValue(() => {})
    mockOnConnectionError.mockReturnValue(() => {})
    mockOnConnectionDisconnected.mockReturnValue(() => {})
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial State', () => {
    it('should return initial rooms and connection state', () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))

      expect(result.current.rooms).toEqual(initialRooms)
      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionError).toBe(null)
      expect(typeof result.current.isRoomAvailableForSharing).toBe('function')
      expect(typeof result.current.updateRoomStatus).toBe('function')
    })

    it('should initialize with correct room data', () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))

      expect(result.current.rooms).toHaveLength(2)
      expect(result.current.rooms[0].id).toBe(1)
      expect(result.current.rooms[1].id).toBe(2)
    })
  })

  describe('Connection Management', () => {
    it('should establish WebSocket connection on mount', () => {
      renderHook(() => useRealtimeRooms(initialRooms))

      expect(mockListenToRoomStatusChanges).toHaveBeenCalledWith(expect.any(Function))
      expect(mockOnConnectionEstablished).toHaveBeenCalledWith(expect.any(Function))
      expect(mockOnConnectionError).toHaveBeenCalledWith(expect.any(Function))
      expect(mockOnConnectionDisconnected).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should set connected state when connection is established', () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))
      const connectionCallback = mockOnConnectionEstablished.mock.calls[0][0]

      act(() => {
        connectionCallback()
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.connectionError).toBe(null)
    })

    it('should handle connection errors', () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))
      const errorCallback = mockOnConnectionError.mock.calls[0][0]

      act(() => {
        errorCallback(new Error('Connection failed'))
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionError).toBe('Connection failed')
    })

    it('should handle disconnection', () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))
      const disconnectCallback = mockOnConnectionDisconnected.mock.calls[0][0]

      // First connect
      const connectCallback = mockOnConnectionEstablished.mock.calls[0][0]
      act(() => connectCallback())

      expect(result.current.isConnected).toBe(true)

      // Then disconnect
      act(() => disconnectCallback())

      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('Room Status Updates', () => {
    it('should update room status when WebSocket event is received', async () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))
      const statusCallback = mockListenToRoomStatusChanges.mock.calls[0][0]

      const statusEvent: RoomStatusChangeEvent = {
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

      act(() => {
        statusCallback(statusEvent)
      })

      expect(result.current.rooms[0].status).toBe('in-use')
      expect(result.current.rooms[0].has_buyer).toBe(true)
      expect(result.current.rooms[0].available_for_buyer).toBe(false)
      expect(result.current.rooms[0].available_for_seller).toBe(true)
    })

    it('should handle multiple room updates', () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))
      const statusCallback = mockListenToRoomStatusChanges.mock.calls[0][0]

      // Update room 1
      const room1Update: RoomStatusChangeEvent = {
        room_id: 1,
        status: 'in-use',
        has_buyer: true,
        has_seller: false,
        available_for_buyer: false,
        available_for_seller: true,
        user_name: 'User 1',
        role: 'buyer',
        action: 'user_joined'
      }

      act(() => {
        statusCallback(room1Update)
      })

      expect(result.current.rooms[0].has_buyer).toBe(true)

      // Update room 2
      const room2Update: RoomStatusChangeEvent = {
        room_id: 2,
        status: 'in-use',
        has_buyer: true,
        has_seller: true,
        available_for_buyer: false,
        available_for_seller: false,
        user_name: 'User 2',
        role: 'seller',
        action: 'user_joined'
      }

      act(() => {
        statusCallback(room2Update)
      })

      expect(result.current.rooms[1].has_seller).toBe(true)
      expect(result.current.rooms[1].available_for_seller).toBe(false)
    })

    it('should ignore updates for non-existent rooms', () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))
      const statusCallback = mockListenToRoomStatusChanges.mock.calls[0][0]

      const nonExistentRoomUpdate: RoomStatusChangeEvent = {
        room_id: 999,
        status: 'in-use',
        has_buyer: true,
        has_seller: false,
        available_for_buyer: false,
        available_for_seller: true,
        user_name: 'Ghost User',
        role: 'buyer',
        action: 'user_joined'
      }

      act(() => {
        statusCallback(nonExistentRoomUpdate)
      })

      // Rooms should remain unchanged
      expect(result.current.rooms).toEqual(initialRooms)
    })
  })

  describe('Room Availability Logic', () => {
    it('should correctly identify rooms available for sharing', () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))

      // Room 1 is available for buyer (free)
      expect(result.current.isRoomAvailableForSharing(result.current.rooms[0])).toBe(true)

      // Room 2 is available for seller (has buyer, no seller)
      expect(result.current.isRoomAvailableForSharing(result.current.rooms[1])).toBe(true)
    })

    it('should return false for rooms not available for sharing', () => {
      const fullRooms = [
        {
          ...initialRooms[0],
          has_buyer: true,
          has_seller: true,
          available_for_buyer: false,
          available_for_seller: false
        }
      ]

      const { result } = renderHook(() => useRealtimeRooms(fullRooms))

      expect(result.current.isRoomAvailableForSharing(result.current.rooms[0])).toBe(false)
    })

    it('should update sharing availability when room status changes', () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))
      const statusCallback = mockListenToRoomStatusChanges.mock.calls[0][0]

      // Initially available for buyer
      expect(result.current.isRoomAvailableForSharing(result.current.rooms[0])).toBe(true)

      // Update to full room
      const fullRoomUpdate: RoomStatusChangeEvent = {
        room_id: 1,
        status: 'in-use',
        has_buyer: true,
        has_seller: true,
        available_for_buyer: false,
        available_for_seller: false,
        user_name: 'Last User',
        role: 'seller',
        action: 'user_joined'
      }

      act(() => {
        statusCallback(fullRoomUpdate)
      })

      // Should no longer be available for sharing
      expect(result.current.isRoomAvailableForSharing(result.current.rooms[0])).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle WebSocket initialization errors', () => {
      mockListenToRoomStatusChanges.mockImplementation(() => {
        throw new Error('WebSocket initialization failed')
      })

      const { result } = renderHook(() => useRealtimeRooms(initialRooms))

      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionError).toBe('WebSocket initialization failed')
    })

    it('should handle connection event binding errors', () => {
      mockOnConnectionEstablished.mockImplementation(() => {
        throw new Error('Failed to bind connection event')
      })

      const { result } = renderHook(() => useRealtimeRooms(initialRooms))

      expect(result.current.isConnected).toBe(false)
    })

    it('should handle room status update errors gracefully', () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))
      const statusCallback = mockListenToRoomStatusChanges.mock.calls[0][0]

      const invalidEvent = {
        // Missing required fields
        room_id: 1,
        status: 'invalid-status'
      } as any

      // Should not throw
      expect(() => {
        act(() => statusCallback(invalidEvent))
      }).not.toThrow()

      // Room should remain unchanged
      expect(result.current.rooms[0]).toEqual(initialRooms[0])
    })
  })

  describe('Cleanup', () => {
    it('should clean up WebSocket listeners on unmount', () => {
      const mockUnsubscribe = vi.fn()
      mockListenToRoomStatusChanges.mockReturnValue(mockUnsubscribe)
      mockOnConnectionEstablished.mockReturnValue(vi.fn())
      mockOnConnectionError.mockReturnValue(vi.fn())
      mockOnConnectionDisconnected.mockReturnValue(vi.fn())

      const { unmount } = renderHook(() => useRealtimeRooms(initialRooms))

      unmount()

      // Should not throw and cleanup should be handled
      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('should handle cleanup when listeners throw errors', () => {
      const mockUnsubscribe = vi.fn().mockImplementation(() => {
        throw new Error('Cleanup failed')
      })
      mockListenToRoomStatusChanges.mockReturnValue(mockUnsubscribe)

      const { unmount } = renderHook(() => useRealtimeRooms(initialRooms))

      // Should not throw during unmount
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Reactivity and Updates', () => {
    it('should update rooms when initialRooms prop changes', () => {
      const { result, rerender } = renderHook(
        ({ rooms }) => useRealtimeRooms(rooms),
        { initialProps: { rooms: initialRooms } }
      )

      expect(result.current.rooms).toEqual(initialRooms)

      const newRooms = [
        ...initialRooms,
        {
          id: 3,
          status: 'free' as const,
          lastActivity: '1 min ago',
          participants: ['Buyer', 'Seller', 'GM'],
          has_buyer: false,
          has_seller: false,
          available_for_buyer: true,
          available_for_seller: false,
          room_number: 3
        }
      ]

      rerender({ rooms: newRooms })

      expect(result.current.rooms).toEqual(newRooms)
      expect(result.current.rooms).toHaveLength(3)
    })

    it('should maintain WebSocket connection across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ rooms }) => useRealtimeRooms(rooms),
        { initialProps: { rooms: initialRooms } }
      )

      // Establish connection
      const connectCallback = mockOnConnectionEstablished.mock.calls[0][0]
      act(() => connectCallback())

      expect(result.current.isConnected).toBe(true)

      // Re-render with new rooms
      const newRooms = [...initialRooms]
      rerender({ rooms: newRooms })

      // Connection should remain
      expect(result.current.isConnected).toBe(true)
    })
  })

  describe('Performance and Optimization', () => {
    it('should not create unnecessary subscriptions', () => {
      const { rerender } = renderHook(
        ({ rooms }) => useRealtimeRooms(rooms),
        { initialProps: { rooms: initialRooms } }
      )

      const initialCallCount = mockListenToRoomStatusChanges.mock.calls.length

      rerender({ rooms: initialRooms })
      rerender({ rooms: initialRooms })

      // Should not create additional subscriptions
      expect(mockListenToRoomStatusChanges.mock.calls.length).toBe(initialCallCount)
    })

    it('should batch multiple room status updates', () => {
      const { result } = renderHook(() => useRealtimeRooms(initialRooms))
      const statusCallback = mockListenToRoomStatusChanges.mock.calls[0][0]

      const updates: RoomStatusChangeEvent[] = [
        {
          room_id: 1,
          status: 'in-use',
          has_buyer: true,
          has_seller: false,
          available_for_buyer: false,
          available_for_seller: true,
          user_name: 'User 1',
          role: 'buyer',
          action: 'user_joined'
        },
        {
          room_id: 2,
          status: 'in-use',
          has_buyer: true,
          has_seller: true,
          available_for_buyer: false,
          available_for_seller: false,
          user_name: 'User 2',
          role: 'seller',
          action: 'user_joined'
        }
      ]

      act(() => {
        updates.forEach(update => statusCallback(update))
      })

      expect(result.current.rooms[0].has_buyer).toBe(true)
      expect(result.current.rooms[1].has_seller).toBe(true)
    })
  })
})