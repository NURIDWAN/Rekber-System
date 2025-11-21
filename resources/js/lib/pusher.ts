import Pusher from 'pusher-js'
import Echo from 'laravel-echo'

declare global {
  interface Window {
    Pusher: any
    Echo: any
  }
}

export function initializePusher() {
  window.Pusher = Pusher

  const echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY || 'your-pusher-key',
    wsHost: import.meta.env.VITE_PUSHER_HOST || 'ws-mt1.pusher.com',
    wsPort: import.meta.env.VITE_PUSHER_PORT ?? 80,
    wssPort: import.meta.env.VITE_PUSHER_PORT ?? 443,
    forceTLS: (import.meta.env.VITE_PUSHER_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1',
  })

  return echo
}

export const echo = initializePusher()

// WebSocket connection status
export function getConnectionStatus() {
  return echo.connector.pusher.connection.state
}

export function onConnectionChange(callback: (status: string) => void) {
  echo.connector.pusher.connection.bind('state_change', (states: any) => {
    callback(states.current)
  })
}

// Room-specific channels
export function joinRoomChannel(roomId: string) {
  return echo.channel(`room.${roomId}`)
}

export function joinPresenceChannel(roomId: string, userId: string) {
  return echo.join(`presence.room.${roomId}`)
}

// Event types for our Rekber system
export interface RoomMessageEvent {
  id: number
  room_id: number
  user_name: string
  role: 'buyer' | 'seller' | 'gm'
  message: string
  type: 'text' | 'image' | 'system'
  created_at: string
}

export interface RoomActivityEvent {
  id: number
  room_id: number
  action: string
  user_name: string
  role: 'buyer' | 'seller' | 'gm'
  description: string
  created_at: string
}

export interface UserPresenceEvent {
  id: string
  name: string
  role: 'buyer' | 'seller' | 'gm'
  info: {
    role: string
    joined_at: string
  }
}