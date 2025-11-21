export interface Room {
  id: number
  room_number: number
  status: 'free' | 'in_use'
  created_at: string
  updated_at: string
}

export interface RoomUser {
  id: number
  room_id: number
  name: string
  phone: string
  role: 'buyer' | 'seller'
  session_token: string
  is_online: boolean
  joined_at: string
  updated_at: string
}

export interface RoomMessage {
  id: number
  room_id: number
  user_name: string
  role: 'buyer' | 'seller' | 'gm'
  message: string
  type: 'text' | 'image' | 'system'
  file_path?: string
  created_at: string
}

export interface RoomActivityLog {
  id: number
  room_id: number
  action: string
  user_name: string
  role: 'buyer' | 'seller' | 'gm'
  description: string
  created_at: string
}

export interface GmUser {
  id: number
  name: string
  email: string
  password: string
  created_at: string
}

export interface User {
  id?: number
  name: string
  role: 'buyer' | 'seller' | 'gm'
  sessionToken?: string
  email?: string
  roomId?: number
}

export interface RoomState {
  id: number
  room_number: number
  status: 'free' | 'in_use'
  users: RoomUser[]
  messages: RoomMessage[]
  activities: RoomActivityLog[]
  onlineUsers: RoomUser[]
  transactionStatus: 'waiting_payment' | 'payment_verified' | 'shipping' | 'completed' | 'disputed'
}

export interface AppState {
  currentUser: User | null
  connectionStatus: 'connected' | 'disconnected' | 'connecting'
  selectedRoom: RoomState | null
  rooms: Room[]
  loading: boolean
  error: string | null
}

// Actions for state management
export type AppAction =
  | { type: 'SET_CURRENT_USER'; payload: User | null }
  | { type: 'SET_CONNECTION_STATUS'; payload: 'connected' | 'disconnected' | 'connecting' }
  | { type: 'SET_SELECTED_ROOM'; payload: RoomState | null }
  | { type: 'UPDATE_ROOM_STATE'; payload: { roomId: number; updates: Partial<RoomState> } }
  | { type: 'ADD_MESSAGE'; payload: { roomId: number; message: RoomMessage } }
  | { type: 'ADD_ACTIVITY'; payload: { roomId: number; activity: RoomActivityLog } }
  | { type: 'UPDATE_USER_ONLINE_STATUS'; payload: { roomId: number; userId: number; isOnline: boolean } }
  | { type: 'SET_ROOMS'; payload: Room[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

export interface JoinRoomData {
  name: string
  phone: string
  role: 'buyer' | 'seller'
}

export interface MessageFormData {
  message: string
  type: 'text' | 'image'
  file?: File
}

// Encrypted URL Types
export interface EncryptedRoomToken {
  room_id: number
  role: 'buyer' | 'seller'
  timestamp: number
  random_key: string
  hash: string
}

export interface ShareableRoomLinks {
  buyer: {
    join: string
    enter: string
  }
  seller: {
    join: string
    enter: string
  }
}

export interface ShareLinksResponse {
  success: boolean
  message: string
  data: {
    room: {
      id: number
      room_number: number
      status: string
    }
    links: ShareableRoomLinks
  }
}

export interface TokenJoinRequest {
  name: string
  phone: string
}