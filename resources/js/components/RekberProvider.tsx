import React from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { RoomProvider } from '@/contexts/RoomContext'

interface RekberProviderProps {
  children: React.ReactNode
}

export default function RekberProvider({ children }: RekberProviderProps) {
  return (
    <AuthProvider>
      <RoomProvider>
        {children}
      </RoomProvider>
    </AuthProvider>
  )
}