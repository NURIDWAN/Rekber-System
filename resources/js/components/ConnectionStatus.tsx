import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  getConnectionStatus,
  onConnectionEstablished,
  onConnectionError,
  onConnectionDisconnected,
} from '@/lib/websocket'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

export default function ConnectionStatus() {
  const [status, setStatus] = useState<string>('disconnected')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    // Get initial connection status
    setStatus(getConnectionStatus())

    // Listen for connection events
    const unsubscribeConnected = onConnectionEstablished(() => {
      setStatus('connected')
    })

    const unsubscribeError = onConnectionError(() => {
      setStatus('disconnected')
    })

    const unsubscribeDisconnected = onConnectionDisconnected(() => {
      setStatus('disconnected')
    })

    // Listen for browser online/offline events
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      unsubscribeConnected()
      unsubscribeError()
      unsubscribeDisconnected()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        label: 'Offline',
        className: 'bg-red-100 text-red-800 border-red-200',
        variant: 'destructive' as const
      }
    }

    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          label: 'Connected',
          className: 'bg-green-100 text-green-800 border-green-200',
          variant: 'default' as const
        }
      case 'connecting':
        return {
          icon: Loader2,
          label: 'Connecting...',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          variant: 'secondary' as const
        }
      case 'disconnected':
        return {
          icon: WifiOff,
          label: 'Disconnected',
          className: 'bg-red-100 text-red-800 border-red-200',
          variant: 'destructive' as const
        }
      default:
        return {
          icon: WifiOff,
          label: 'Unknown',
          className: 'bg-gray-100 text-gray-800 border-gray-200',
          variant: 'secondary' as const
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} flex items-center gap-1 px-2 py-1`}
    >
      <Icon className="w-3 h-3" />
      <span className="text-xs font-medium">{config.label}</span>
    </Badge>
  )
}