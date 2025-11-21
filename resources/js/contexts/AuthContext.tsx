import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { User, AppAction } from '../types'

interface AuthContextType {
  currentUser: User | null
  login: (user: User) => void
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  isAuthenticated: boolean
  isGM: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthState {
  currentUser: User | null
}

type AuthAction =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      // Store session in localStorage for persistence
      if (action.payload.sessionToken) {
        localStorage.setItem('rekber_session', JSON.stringify(action.payload))
      }
      return { currentUser: action.payload }
    case 'LOGOUT':
      localStorage.removeItem('rekber_session')
      return { currentUser: null }
    case 'UPDATE_USER':
      if (!state.currentUser) return state
      const updatedUser = { ...state.currentUser, ...action.payload }
      if (updatedUser.sessionToken) {
        localStorage.setItem('rekber_session', JSON.stringify(updatedUser))
      }
      return { currentUser: updatedUser }
    default:
      return state
  }
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, { currentUser: null })

  // Check for existing session on mount
  useEffect(() => {
    const storedSession = localStorage.getItem('rekber_session')
    if (storedSession) {
      try {
        const user = JSON.parse(storedSession)
        dispatch({ type: 'LOGIN', payload: user })
      } catch (error) {
        console.error('Failed to parse stored session:', error)
        localStorage.removeItem('rekber_session')
      }
    }
  }, [])

  const login = (user: User) => {
    dispatch({ type: 'LOGIN', payload: user })
  }

  const logout = () => {
    dispatch({ type: 'LOGOUT' })
  }

  const updateUser = (updates: Partial<User>) => {
    dispatch({ type: 'UPDATE_USER', payload: updates })
  }

  const value: AuthContextType = {
    currentUser: state.currentUser,
    login,
    logout,
    updateUser,
    isAuthenticated: !!state.currentUser,
    isGM: state.currentUser?.role === 'gm',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}