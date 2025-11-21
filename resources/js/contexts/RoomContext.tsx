import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { RoomState, Room, RoomMessage, RoomActivityLog, RoomUser } from '../types'
import { echo, joinRoomChannel, joinPresenceChannel, UserPresenceEvent } from '../lib/pusher'
import { useAuth } from './AuthContext'

interface RoomContextType {
  selectedRoom: RoomState | null
  rooms: Room[]
  loading: boolean
  error: string | null
  selectRoom: (room: Room) => void
  updateRoomState: (updates: Partial<RoomState>) => void
  addMessage: (message: RoomMessage) => void
  addActivity: (activity: RoomActivityLog) => void
  updateUserOnlineStatus: (userId: number, isOnline: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

const RoomContext = createContext<RoomContextType | undefined>(undefined)

interface RoomStateData {
  selectedRoom: RoomState | null
  rooms: Room[]
  loading: boolean
  error: string | null
}

type RoomAction =
  | { type: 'SET_ROOMS'; payload: Room[] }
  | { type: 'SELECT_ROOM'; payload: Room }
  | { type: 'UPDATE_ROOM_STATE'; payload: Partial<RoomState> }
  | { type: 'ADD_MESSAGE'; payload: RoomMessage }
  | { type: 'ADD_ACTIVITY'; payload: RoomActivityLog }
  | { type: 'UPDATE_USER_ONLINE_STATUS'; payload: { userId: number; isOnline: boolean } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

function roomReducer(state: RoomStateData, action: RoomAction): RoomStateData {
  switch (action.type) {
    case 'SET_ROOMS':
      return { ...state, rooms: action.payload }

    case 'SELECT_ROOM':
      const newRoomState: RoomState = {
        id: action.payload.id,
        room_number: action.payload.room_number,
        status: action.payload.status,
        users: [],
        messages: [],
        activities: [],
        onlineUsers: [],
        transactionStatus: 'waiting_payment',
      }
      return { ...state, selectedRoom: newRoomState, loading: true, error: null }

    case 'UPDATE_ROOM_STATE':
      if (!state.selectedRoom) return state
      return {
        ...state,
        selectedRoom: { ...state.selectedRoom, ...action.payload },
      }

    case 'ADD_MESSAGE':
      if (!state.selectedRoom) return state
      return {
        ...state,
        selectedRoom: {
          ...state.selectedRoom,
          messages: [...state.selectedRoom.messages, action.payload],
        },
      }

    case 'ADD_ACTIVITY':
      if (!state.selectedRoom) return state
      return {
        ...state,
        selectedRoom: {
          ...state.selectedRoom,
          activities: [...state.selectedRoom.activities, action.payload],
        },
      }

    case 'UPDATE_USER_ONLINE_STATUS':
      if (!state.selectedRoom) return state

      const updatedOnlineUsers = state.selectedRoom.onlineUsers.map(user =>
        user.id === action.payload.userId
          ? { ...user, is_online: action.payload.isOnline }
          : user
      )

      // If user is not in onlineUsers list and is now online, add them
      const userExists = state.selectedRoom.onlineUsers.some(user => user.id === action.payload.userId)
      if (!userExists && action.payload.isOnline) {
        const user = state.selectedRoom.users.find(u => u.id === action.payload.userId)
        if (user) {
          updatedOnlineUsers.push({ ...user, is_online: true })
        }
      }

      return {
        ...state,
        selectedRoom: {
          ...state.selectedRoom,
          onlineUsers: updatedOnlineUsers.filter(u => u.is_online),
        },
      }

    case 'SET_LOADING':
      return { ...state, loading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload }

    default:
      return state
  }
}

interface RoomProviderProps {
  children: ReactNode
}

export function RoomProvider({ children }: RoomProviderProps) {
  const [state, dispatch] = useReducer(roomReducer, {
    selectedRoom: null,
    rooms: [],
    loading: false,
    error: null,
  })

  const { currentUser } = useAuth()

  // Set up real-time listeners when a room is selected
  useEffect(() => {
    if (!state.selectedRoom || !currentUser) return

    const roomId = state.selectedRoom.id

    // Join the room channel for messages and activities
    const roomChannel = joinRoomChannel(roomId)

    roomChannel.listen('RoomMessageSent', (event: RoomMessage) => {
      dispatch({ type: 'ADD_MESSAGE', payload: event })
    })

    roomChannel.listen('RoomActivityLogged', (event: RoomActivityLog) => {
      dispatch({ type: 'ADD_ACTIVITY', payload: event })
    })

    // Join presence channel for online status
    const presenceChannel = joinPresenceChannel(roomId, currentUser.sessionToken || '')

    presenceChannel.here((users: UserPresenceEvent[]) => {
      // Set initial online users
      users.forEach(user => {
        dispatch({
          type: 'UPDATE_USER_ONLINE_STATUS',
          payload: { userId: parseInt(user.id), isOnline: true }
        })
      })
    })

    presenceChannel.joining((user: UserPresenceEvent) => {
      dispatch({
        type: 'UPDATE_USER_ONLINE_STATUS',
        payload: { userId: parseInt(user.id), isOnline: true }
      })
    })

    presenceChannel.leaving((user: UserPresenceEvent) => {
      dispatch({
        type: 'UPDATE_USER_ONLINE_STATUS',
        payload: { userId: parseInt(user.id), isOnline: false }
      })
    })

    // Cleanup function
    return () => {
      roomChannel.stopListening('RoomMessageSent')
      roomChannel.stopListening('RoomActivityLogged')
      echo.leave(`room.${roomId}`)
      echo.leave(`presence.room.${roomId}`)
    }
  }, [state.selectedRoom?.id, currentUser])

  const selectRoom = (room: Room) => {
    dispatch({ type: 'SELECT_ROOM', payload: room })
  }

  const updateRoomState = (updates: Partial<RoomState>) => {
    dispatch({ type: 'UPDATE_ROOM_STATE', payload: updates })
  }

  const addMessage = (message: RoomMessage) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message })
  }

  const addActivity = (activity: RoomActivityLog) => {
    dispatch({ type: 'ADD_ACTIVITY', payload: activity })
  }

  const updateUserOnlineStatus = (userId: number, isOnline: boolean) => {
    dispatch({ type: 'UPDATE_USER_ONLINE_STATUS', payload: { userId, isOnline } })
  }

  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading })
  }

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }

  const value: RoomContextType = {
    selectedRoom: state.selectedRoom,
    rooms: state.rooms,
    loading: state.loading,
    error: state.error,
    selectRoom,
    updateRoomState,
    addMessage,
    addActivity,
    updateUserOnlineStatus,
    setLoading,
    setError,
  }

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

export function useRoom() {
  const context = useContext(RoomContext)
  if (context === undefined) {
    throw new Error('useRoom must be used within a RoomProvider')
  }
  return context
}