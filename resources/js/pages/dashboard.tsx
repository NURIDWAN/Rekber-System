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
  Package,
  Shield,
  Share,
  DollarSign,
  CreditCard,
  Users,
  ArrowUpRight,
  FileText,
  Timer,
  AlertTriangle
} from 'lucide-react'
import { Room } from '@/types'

interface DashboardProps {
  rooms: Room[]
  stats?: {
    total_rooms: number
    free_rooms: number
    in_use_rooms: number
    active_users: number
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
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareModalRoom, setShareModalRoom] = useState<Room | null>(null)

  const calculatedStats = {
    totalRooms: stats?.total_rooms ?? rooms.length,
    inUseRooms: stats?.in_use_rooms ?? rooms.filter(r => r.status === 'in_use').length,
    freeRooms: stats?.free_rooms ?? rooms.filter(r => r.status === 'free').length,
    activeUsers: stats?.active_users ?? 0,
    activeTransactions: transactionStats?.active_transactions ?? 0,
    completedTransactions: transactionStats?.completed_transactions ?? 0,
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
            <p className="text-sm text-gray-500">Ringkasan cepat kinerja ruangan dan transaksi</p>
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
                <p className="text-sm font-medium text-gray-600">Rooms In Use</p>
                <p className="text-2xl font-bold text-gray-900">
                  {calculatedStats.inUseRooms}
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
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {calculatedStats.activeUsers}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
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
              <div className="p-3 bg-yellow-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-purple-600" />
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

      {/* Room Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Rooms Overview
            </CardTitle>
            <Link href="/rooms">
              <Button variant="outline" size="sm">
                Browse Rooms
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rooms.map((room) => (
              <Card key={room.id} className="transition-all hover:shadow-md">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Room #{room.room_number}</h3>
                    <Badge variant="secondary" className={getRoomStatusColor(room.status)}>
                      {room.status === 'free' ? 'Free' : 'In Use'}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 flex flex-col gap-1">
                    <span>Buyer: {room.buyer?.name || '—'}</span>
                    <span>Seller: {room.seller?.name || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => (window.location.href = getRoomUrl(room))}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShareRoom(room)}
                    >
                      <Share className="w-3 h-3" />
                    </Button>
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
