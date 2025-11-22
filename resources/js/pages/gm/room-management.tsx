import React, { useState } from 'react'
import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AppLayout from '@/layouts/app-layout'
import { dashboard } from '@/routes'
import { type BreadcrumbItem } from '@/types'
import {
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  RefreshCw,
  TrendingUp,
  Package,
  Shield,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Timer,
  MessageSquare,
  UserPlus,
  Settings,
  Trash2,
  Edit
} from 'lucide-react'

interface RoomUser {
  id: number
  name: string
  role: 'buyer' | 'seller'
  is_online: boolean
  joined_at: string
  last_seen: string
}

interface Room {
  id: number
  room_number: string
  status: 'free' | 'in_use'
  created_at: string
  updated_at: string
  has_buyer: boolean
  has_seller: boolean
  is_available_for_buyer: boolean
  is_available_for_seller: boolean
  participants: string[]
  users: RoomUser[]
  message_count: number
  last_message?: any
  activity_count: number
  last_activity?: any
}

interface RoomManagementProps {
  rooms: Room[]
  stats: {
    total_rooms: number
    free_rooms: number
    in_use_rooms: number
    active_users: number
  }
}

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Room Management', href: '/gm/rooms' }
]

export default function RoomManagement({ rooms, stats }: RoomManagementProps) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  const getRoomStatusColor = (status: string) => {
    switch (status) {
      case 'free':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'in_use':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'free':
        return <CheckCircle className="w-4 h-4" />
      case 'in_use':
        return <Users className="w-4 h-4" />
      default:
        return <AlertTriangle className="w-4 h-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'buyer':
        return 'bg-blue-100 text-blue-800'
      case 'seller':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Room Management - Rekber System" />

      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Shield className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Room Management</h1>
              <p className="text-sm text-gray-500">Kelola dan monitor semua ruang transaksi</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
            <Link href={dashboard()}>
              <Button variant="outline" size="sm">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Rooms</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_rooms}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Free Rooms</p>
                <p className="text-2xl font-bold text-green-600">{stats.free_rooms}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Use</p>
                <p className="text-2xl font-bold text-blue-600">{stats.in_use_rooms}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-orange-600">{stats.active_users}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rooms Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>All Rooms</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-gray-900">Room</th>
                  <th className="text-left p-3 font-medium text-gray-900">Status</th>
                  <th className="text-left p-3 font-medium text-gray-900">Participants</th>
                  <th className="text-left p-3 font-medium text-gray-900">Messages</th>
                  <th className="text-left p-3 font-medium text-gray-900">Activity</th>
                  <th className="text-left p-3 font-medium text-gray-900">Last Updated</th>
                  <th className="text-left p-3 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div className="flex items-center space-x-3">
                        <div className="font-medium text-gray-900">#{room.room_number}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge className={`${getRoomStatusColor(room.status)} flex items-center space-x-1 w-fit`}>
                        {getStatusIcon(room.status)}
                        <span className="capitalize">{room.status.replace('_', ' ')}</span>
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="space-y-1">
                        {room.users.map((user) => (
                          <div key={user.id} className="flex items-center space-x-2">
                            <Badge className={`${getRoleColor(user.role)} text-xs`}>
                              {user.role}
                            </Badge>
                            <span className="text-sm text-gray-700">{user.name}</span>
                            {user.is_online && (
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            )}
                          </div>
                        ))}
                        {room.users.length === 0 && (
                          <span className="text-sm text-gray-500">No participants</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{room.message_count}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{room.activity_count}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-gray-500">
                        {formatDateTime(room.updated_at)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <Link href={`/rooms/${room.id}`}>
                          <Button variant="outline" size="sm" title="View Room">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/rooms/${room.id}/invitations`}>
                          <Button variant="outline" size="sm" title="Manage Invitations">
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Room Details"
                          onClick={() => setSelectedRoom(room)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {rooms.length === 0 && (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No rooms found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selected Room Details Modal (if needed) */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Room #{selectedRoom.room_number} Details</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRoom(null)}
              >
                ×
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Participants</h3>
                {selectedRoom.users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <Badge className={getRoleColor(user.role)}>
                        {user.role}
                      </Badge>
                      <span>{user.name}</span>
                      {user.is_online && (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      Joined: {formatDateTime(user.joined_at)}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Activity Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Messages</p>
                    <p className="font-semibold">{selectedRoom.message_count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Activity Count</p>
                    <p className="font-semibold">{selectedRoom.activity_count}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}