import React from 'react'
import { RoomActivityLog } from '@/types'
import { format } from 'date-fns'
import {
  User,
  UserCheck,
  Upload,
  CheckCircle,
  Truck,
  AlertCircle,
  Clock
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ActivityTimelineProps {
  activities: RoomActivityLog[]
}

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'user_joined':
        return <UserCheck className="w-4 h-4 text-green-600" />
      case 'payment_uploaded':
        return <Upload className="w-4 h-4 text-blue-600" />
      case 'payment_verified':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'shipping_uploaded':
        return <Truck className="w-4 h-4 text-orange-600" />
      case 'receipt_confirmed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'dispute_created':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'room_reset':
        return <Clock className="w-4 h-4 text-gray-600" />
      default:
        return <User className="w-4 h-4 text-gray-600" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'user_joined':
        return 'bg-green-50 border-green-200'
      case 'payment_uploaded':
        return 'bg-blue-50 border-blue-200'
      case 'payment_verified':
        return 'bg-green-50 border-green-200'
      case 'shipping_uploaded':
        return 'bg-orange-50 border-orange-200'
      case 'receipt_confirmed':
        return 'bg-green-50 border-green-200'
      case 'dispute_created':
        return 'bg-red-50 border-red-200'
      case 'room_reset':
        return 'bg-gray-50 border-gray-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'gm':
        return 'bg-purple-100 text-purple-800'
      case 'buyer':
        return 'bg-blue-100 text-blue-800'
      case 'seller':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatActivityTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

      if (diffInMinutes < 1) {
        return 'Just now'
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`
      } else if (diffInMinutes < 1440) { // 24 hours
        const hours = Math.floor(diffInMinutes / 60)
        return `${hours}h ago`
      } else {
        return format(date, 'MMM d, HH:mm')
      }
    } catch {
      return ''
    }
  }

  if (activities.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <ActivityIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activities yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div
          key={activity.id}
          className={`relative flex items-start space-x-3 p-3 rounded-lg border ${getActionColor(
            activity.action
          )} ${
            index !== activities.length - 1 ? 'border-b-0' : ''
          }`}
        >
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {getActivityIcon(activity.action)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-sm font-medium text-gray-900 truncate">
                {activity.user_name}
              </span>
              <Badge
                variant="secondary"
                className={`text-xs ${getRoleBadgeColor(activity.role)}`}
              >
                {activity.role}
              </Badge>
            </div>

            <p className="text-sm text-gray-700 mb-1">
              {activity.description}
            </p>

            <p className="text-xs text-gray-500">
              {formatActivityTime(activity.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Helper component for empty state icon
function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}