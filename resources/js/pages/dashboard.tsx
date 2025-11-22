import React, { useState } from 'react'
import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AppLayout from '@/layouts/app-layout'
import { dashboard } from '@/routes'
import { type BreadcrumbItem } from '@/types'
import RekberProvider from '@/components/RekberProvider'
import { ShareUrlModal } from '@/components/ShareUrlModal'
import { getRoomUrl } from '@/lib/roomUrlUtils'
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
  Share,
  DollarSign,
  CreditCard,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Timer
} from 'lucide-react'
import { Room } from '@/types'

interface DashboardProps {
  rooms: Room[]
  stats?: {
    totalRooms: number
    activeTransactions: number
    completedTransactions: number
    pendingVerifications: number
  }
  transactionStats?: {
    total_transactions: number
    pending_payment: number
    active_transactions: number
    completed_transactions: number
    disputed_transactions: number
    total_volume: number
    total_commission: number
    pending_payment_amount: number
  }
  recentTransactions?: Array<{
    id: number
    transaction_number: string
    amount: number
    currency: string
    status: string
    status_label: {
      text: string
      color: string
    }
    room_number: number
    buyer_name: string
    seller_name: string
    created_at: string
  }>
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

function DashboardContent({ rooms, stats, transactionStats, recentTransactions }: DashboardProps) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareModalRoom, setShareModalRoom] = useState<Room | null>(null)

  // Calculate stats if not provided
  const calculatedStats = {
    totalRooms: stats?.totalRooms || rooms.length,
    activeTransactions: stats?.activeTransactions || rooms.filter(r => r.status === 'in_use').length,
    completedTransactions: stats?.completedTransactions || 0,
    pendingVerifications: stats?.pendingVerifications || 0,
  }

  const handleRoomAction = async (roomId: number, action: string) => {
    setIsLoading(true)
    try {
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
    <>
      <Head title="Dashboard - Rekber System" />

      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <Shield className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">Rekber System Administration</p>
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

      {/* Transaction Status Cards */}
      {transactionStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {transactionStats.total_transactions}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Payment</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {transactionStats.pending_payment}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Timer className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Escrow</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {transactionStats.active_transactions}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Disputed</p>
                  <p className="text-2xl font-bold text-red-600">
                    {transactionStats.disputed_transactions}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Financial Summary */}
      {transactionStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Volume</p>
                  <p className="text-2xl font-bold text-gray-900">
                    Rp {(transactionStats.total_volume || 0).toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <ArrowUpRight className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Commission Earned</p>
                  <p className="text-2xl font-bold text-gray-900">
                    Rp {(transactionStats.total_commission || 0).toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Amount</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    Rp {(transactionStats.pending_payment_amount || 0).toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Room Management Section */}
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
              <Link href="/rooms">
                <Button variant="outline" size="sm">
                  View All Rooms
                </Button>
              </Link>
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
                        window.location.href = getRoomUrl(room)
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

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.location.href = `/rooms/${room.id}/invitations`
                      }}
                      title="Manage Invitations"
                    >
                      <Users className="w-3 h-3" />
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

      {/* Recent Transactions Feed */}
      {recentTransactions && recentTransactions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Recent Transactions
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/transactions'}>
                View All Transactions
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-white rounded-lg border">
                      <FileText className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {transaction.transaction_number}
                      </div>
                      <div className="text-sm text-gray-600">
                        Room {transaction.room_number} • {transaction.buyer_name} & {transaction.seller_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {transaction.created_at}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        Rp {transaction.amount.toLocaleString('id-ID')}
                      </div>
                      <Badge
                        variant="secondary"
                        className={`bg-${transaction.status_label.color}-100 text-${transaction.status_label.color}-800 border-${transaction.status_label.color}-200`}
                      >
                        {transaction.status_label.text}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {recentTransactions.length === 0 && (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions yet</h3>
                <p className="text-gray-500">Transactions will appear here once they are created.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => window.location.href = '/reports'}
            >
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <span>View Reports</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => window.location.href = '/verifications'}
            >
              <Users className="w-8 h-8 text-purple-600" />
              <span>User Verifications</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => window.location.href = '/disputes'}
            >
              <AlertTriangle className="w-8 h-8 text-orange-600" />
              <span>Manage Disputes</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => window.location.href = '/settings'}
            >
              <Shield className="w-8 h-8 text-gray-600" />
              <span>System Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Share URL Modal */}
      {shareModalRoom && (
        <ShareUrlModal
          roomId={shareModalRoom.id}
          roomNumber={shareModalRoom.room_number}
          isOpen={shareModalOpen}
          onOpenChange={setShareModalOpen}
        />
      )}
    </>
  )
}

export default function Dashboard({ rooms, stats, transactionStats, recentTransactions }: DashboardProps) {
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <RekberProvider>
        <DashboardContent rooms={rooms} stats={stats} transactionStats={transactionStats} recentTransactions={recentTransactions} />
      </RekberProvider>
    </AppLayout>
  )
}
