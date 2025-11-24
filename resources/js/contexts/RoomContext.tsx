import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { RoomState, Room, RoomMessage, RoomActivityLog, RoomUser } from '../types'
import { useAuth } from './AuthContext'

// Import Pusher for real-time functionality
import Pusher from 'pusher-js'

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
  updateTransactionStatus: (status: string) => void
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
  | { type: 'UPDATE_TRANSACTION_STATUS'; payload: string }

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

    case 'UPDATE_TRANSACTION_STATUS':
      if (!state.selectedRoom) return state
      return {
        ...state,
        selectedRoom: {
          ...state.selectedRoom,
          transactionStatus: action.payload,
        },
      }

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

  // Set up Pusher real-time listeners when a room is selected
  useEffect(() => {
    if (!state.selectedRoom || !currentUser) return

    // Initialize Pusher
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_APP_KEY, {
      cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
      wsHost: import.meta.env.VITE_PUSHER_HOST,
      wsPort: parseInt(import.meta.env.VITE_PUSHER_PORT || '443'),
      wssPort: parseInt(import.meta.env.VITE_PUSHER_PORT || '443'),
      forceTLS: import.meta.env.VITE_PUSHER_SCHEME === 'https',
      enabledTransports: ['ws', 'wss'],
    })

    // Subscribe to room channel
    const channel = pusher.subscribe(`room-${state.selectedRoom.id}`)

    // Listen for new messages
    channel.bind('message-sent', (data: any) => {
      const message: RoomMessage = {
        id: data.id,
        room_id: data.room_id,
        user_name: data.sender_name,
        role: data.sender_role,
        message: data.message,
        type: data.type,
        created_at: data.created_at,
      }
      addMessage(message)
    })

    // Listen for room activities
    channel.bind('activity-logged', (data: any) => {
      const activity: RoomActivityLog = {
        id: data.id,
        room_id: data.room_id,
        action: data.action,
        user_name: data.user_name,
        role: data.role,
        description: data.description,
        created_at: data.created_at,
      }
      addActivity(activity)
    })

    // Listen for user status changes
    channel.bind('user-status-changed', (data: any) => {
      updateUserOnlineStatus(data.user_id, data.is_online)
    })

    // Listen for transaction updates
    channel.bind('transaction-updated', (data: any) => {
      if (data.transaction && data.transaction.status) {
        updateTransactionStatus(data.transaction.status)
      }
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`room-${state.selectedRoom?.id || ''}`)
      pusher.disconnect()
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

  const updateTransactionStatus = (status: string) => {
    dispatch({ type: 'UPDATE_TRANSACTION_STATUS', payload: status })
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
    updateTransactionStatus,
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