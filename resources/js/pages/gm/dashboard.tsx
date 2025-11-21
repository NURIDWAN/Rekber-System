import React, { useState, useEffect } from 'react'
import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/contexts/AuthContext'
import RekberProvider from '@/components/RekberProvider'
import { ShareUrlModal } from '@/components/ShareUrlModal'
import {
  Users,
  MessageCircle,
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Settings,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Package,
  Shield,
  Share
} from 'lucide-react'
import { Room, RoomUser } from '@/types'

interface GMDashboardProps {
  rooms: Room[]
  stats?: {
    totalRooms: number
    activeTransactions: number
    completedTransactions: number
    pendingVerifications: number
  }
}

function GMDashboardContent({ rooms, stats }: GMDashboardProps) {
  const { currentUser } = useAuth()
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('connected')
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareModalRoom, setShareModalRoom] = useState<Room | null>(null)

  // Calculate stats if not provided
  const calculatedStats = {
    totalRooms: stats?.totalRooms || rooms.length,
    activeTransactions: stats?.activeTransactions || rooms.filter(r => r.status === 'in_use').length,
    completedTransactions: stats?.completedTransactions || 0, // This would come from backend
    pendingVerifications: stats?.pendingVerifications || 0, // This would come from backend
  }

  const handleRoomAction = async (roomId: number, action: string) => {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log(`Performing ${action} on room ${roomId}`)
    } catch (error) {
      console.error('Error performing room action:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleShareRoom = (room: Room) => {
    setShareModalRoom(room)
    setShareModalOpen(true)
  }

  const getRoomStatusColor = (status: string) => {
    switch (status) {
      case 'free':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'in_use':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'free':
        return <CheckCircle className="w-4 h-4" />
      case 'in_use':
        return <Clock className="w-4 h-4" />
      default:
        return <AlertTriangle className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head title="GM Dashboard - Rekber System" />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Shield className="w-8 h-8 text-purple-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">GM Dashboard</h1>
                <p className="text-sm text-gray-500">Rekber System Administration</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Badge
                variant="outline"
                className={connectionStatus === 'connected'
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-red-50 text-red-800 border-red-200'
                }
              >
                {connectionStatus === 'connected' ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Connected
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                    Disconnected
                  </>
                )}
              </Badge>

              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>

              <Link href="/rooms">
                <Button variant="outline" size="sm">
                  View All Rooms
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Rooms</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {calculatedStats.totalRooms}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {calculatedStats.activeTransactions}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Activity className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed Today</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {calculatedStats.completedTransactions}
                  </p>
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
                  <p className="text-sm font-medium text-gray-600">Pending Verifications</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {calculatedStats.pendingVerifications}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Room Grid */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Room Management
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rooms.map((room) => (
                <Card
                  key={room.id}
                  className={`transition-all hover:shadow-md cursor-pointer ${
                    selectedRoom?.id === room.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedRoom(room)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">Room {room.room_number}</h3>
                      <Badge
                        variant="secondary"
                        className={getRoomStatusColor(room.status)}
                      >
                        {getStatusIcon(room.status)}
                        <span className="ml-1">
                          {room.status === 'free' ? 'Available' : 'In Use'}
                        </span>
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Status:</span>
                        <span className={`font-medium ${
                          room.status === 'free' ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {room.status === 'free' ? 'Available' : 'Active'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Users:</span>
                        <span className="font-medium">
                          {room.status === 'in_use' ? '2/2' : '0/2'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.location.href = `/rooms/${room.id}`
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleShareRoom(room)
                        }}
                      >
                        <Share className="w-3 h-3" />
                      </Button>

                      {room.status === 'in_use' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRoomAction(room.id, 'reset')
                          }}
                          disabled={isLoading}
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {rooms.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No rooms available</h3>
                <p className="text-gray-500">Rooms will appear here once they are created.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center space-y-2"
                onClick={() => window.location.href = '/gm/reports'}
              >
                <TrendingUp className="w-8 h-8 text-blue-600" />
                <span>View Reports</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center space-y-2"
                onClick={() => window.location.href = '/gm/disputes'}
              >
                <AlertTriangle className="w-8 h-8 text-orange-600" />
                <span>Manage Disputes</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center space-y-2"
                onClick={() => window.location.href = '/gm/settings'}
              >
                <Settings className="w-8 h-8 text-gray-600" />
                <span>System Settings</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Share URL Modal */}
      {shareModalRoom && (
        <ShareUrlModal
          roomId={shareModalRoom.id}
          roomNumber={shareModalRoom.room_number}
          isOpen={shareModalOpen}
          onOpenChange={setShareModalOpen}
        />
      )}
    </div>
  )
}

export default function GMDashboard({ rooms, stats }: GMDashboardProps) {
  return (
    <RekberProvider>
      <GMDashboardContent rooms={rooms} stats={stats} />
    </RekberProvider>
  )
}