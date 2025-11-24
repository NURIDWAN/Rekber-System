import React, { useState, useEffect } from 'react'
import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import RekberProvider from '@/components/RekberProvider'
import { ShareUrlModal } from '@/components/ShareUrlModal'
import { getRoomUrl } from '@/lib/roomUrlUtils'
import transactionAPI, { TransactionDetails, TransactionFile } from '@/services/transaction-api'
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
  Share,
  FileText,
  Truck,
  CreditCard,
  CheckSquare,
  XSquare,
  AlertCircle,
  Loader2
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

interface GMStats {
  pending_payment_verification: number
  pending_shipping_verification: number
  pending_fund_release: number
  disputed_transactions: number
  active_transactions: number
}

interface PendingTransaction {
  id: number
  transaction_number: string
  amount: number
  currency: string
  status: string
  room: {
    id: number
    room_number: string
  }
  buyer: {
    name: string
  } | null
  seller: {
    name: string
  } | null
  files: TransactionFile[]
}

function GMDashboardContent({ rooms, stats }: GMDashboardProps) {
  const { currentUser } = useAuth()
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('connected')
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareModalRoom, setShareModalRoom] = useState<Room | null>(null)

  // New state for transaction management
  const [gmStats, setGmStats] = useState<GMStats | null>(null)
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([])
  const [pendingFiles, setPendingFiles] = useState<TransactionFile[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [verifyingFile, setVerifyingFile] = useState<TransactionFile | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectModalOpen, setRejectModalOpen] = useState(false)

  // Calculate stats if not provided
  const calculatedStats = {
    totalRooms: stats?.totalRooms || rooms.length,
    activeTransactions: stats?.activeTransactions || rooms.filter(r => r.status === 'in_use').length,
    completedTransactions: stats?.completedTransactions || 0, // This would come from backend
    pendingVerifications: stats?.pendingVerifications || 0, // This would come from backend
  }

  useEffect(() => {
    loadDashboardData()
    // Auto-refresh data every 30 seconds
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    try {
      // Load pending transactions
      const transactionsResponse = await transactionAPI.getPendingTransactions('all', 100)
      if (transactionsResponse.success) {
        const transactions = transactionsResponse.data.data || []

        // Calculate stats
        const calculatedGMStats: GMStats = {
          pending_payment_verification: transactions.filter((t: PendingTransaction) => t.status === 'awaiting_payment_verification').length,
          pending_shipping_verification: transactions.filter((t: PendingTransaction) => t.status === 'awaiting_shipping_verification').length,
          pending_fund_release: transactions.filter((t: PendingTransaction) => t.status === 'delivered').length,
          disputed_transactions: transactions.filter((t: PendingTransaction) => t.status === 'disputed').length,
          active_transactions: transactions.filter((t: PendingTransaction) => ['pending_payment', 'awaiting_payment_verification', 'paid', 'awaiting_shipping_verification', 'shipped', 'delivered'].includes(t.status)).length
        }
        setGmStats(calculatedGMStats)
        setPendingTransactions(transactions)
      }

      // Load pending files
      const filesResponse = await transactionAPI.getPendingFiles('all', 50)
      if (filesResponse.success) {
        setPendingFiles(filesResponse.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
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

  const handleFileVerification = async (file: TransactionFile, action: 'approve' | 'reject', reason?: string) => {
    setIsLoading(true)
    try {
      if (action === 'approve') {
        if (file.file_type === 'payment_proof') {
          await transactionAPI.verifyPaymentProof(file.id, 'approve')
        } else {
          await transactionAPI.verifyShippingReceipt(file.id, 'approve')
        }
      } else {
        if (file.file_type === 'payment_proof') {
          await transactionAPI.verifyPaymentProof(file.id, 'reject', reason)
        } else {
          await transactionAPI.verifyShippingReceipt(file.id, 'reject', reason)
        }
      }
      await loadDashboardData()
    } catch (error) {
      console.error('Verification failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFundRelease = async (transactionId: number) => {
    setIsLoading(true)
    try {
      await transactionAPI.releaseFunds(transactionId)
      await loadDashboardData()
    } catch (error) {
      console.error('Fund release failed:', error)
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

  const getTransactionStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_payment':
      case 'awaiting_payment_verification':
        return <CreditCard className="w-4 h-4" />
      case 'paid':
      case 'awaiting_shipping_verification':
        return <Package className="w-4 h-4" />
      case 'shipped':
        return <Truck className="w-4 h-4" />
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />
      case 'disputed':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getTransactionStatusBadge = (status: string) => {
    const colors = {
      'pending_payment': 'bg-yellow-100 text-yellow-800',
      'awaiting_payment_verification': 'bg-orange-100 text-orange-800',
      'paid': 'bg-blue-100 text-blue-800',
      'awaiting_shipping_verification': 'bg-purple-100 text-purple-800',
      'shipped': 'bg-indigo-100 text-indigo-800',
      'delivered': 'bg-cyan-100 text-cyan-800',
      'disputed': 'bg-red-100 text-red-800',
      'completed': 'bg-green-100 text-green-800'
    }

    return (
      <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {getTransactionStatusIcon(status)}
        <span className="ml-1 capitalize">{status.replace('_', ' ')}</span>
      </Badge>
    )
  }

  const getFileTypeIcon = (fileType: string) => {
    return fileType === 'payment_proof' ?
      <CreditCard className="w-4 h-4" /> :
      <Package className="w-4 h-4" />
  }

  const getFileTypeBadge = (fileType: string) => {
    const colors = {
      'payment_proof': 'bg-blue-100 text-blue-800',
      'shipping_receipt': 'bg-green-100 text-green-800'
    }

    return (
      <Badge className={colors[fileType as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {getFileTypeIcon(fileType)}
        <span className="ml-1">{fileType === 'payment_proof' ? 'Payment Proof' : 'Shipping Receipt'}</span>
      </Badge>
    )
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

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="rooms">Room Management</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Payment Verification</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {gmStats?.pending_payment_verification || 0}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <CreditCard className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Shipping Verification</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {gmStats?.pending_shipping_verification || 0}
                  </p>
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
                  <p className="text-sm font-medium text-gray-600">Fund Release</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {gmStats?.pending_fund_release || 0}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Disputed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {gmStats?.disputed_transactions || 0}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gmStats?.pending_payment_verification! > 0 && (
                <Button
                  onClick={() => { setActiveTab('transactions'); }}
                  className="w-full"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Verify Payments
                </Button>
              )}
              {gmStats?.pending_shipping_verification! > 0 && (
                <Button
                  onClick={() => { setActiveTab('transactions'); }}
                  variant="outline"
                  className="w-full"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Verify Shipping
                </Button>
              )}
              {gmStats?.pending_fund_release! > 0 && (
                <Button
                  onClick={() => { setActiveTab('transactions'); }}
                  variant="outline"
                  className="w-full"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Release Funds
                </Button>
              )}
              {gmStats?.disputed_transactions! > 0 && (
                <Button
                  onClick={() => { setActiveTab('transactions'); }}
                  variant="destructive"
                  className="w-full"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Handle Disputes
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Transaction Verification</span>
                  <Button onClick={loadDashboardData} variant="outline" size="sm" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Refresh
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && !pendingFiles.length ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : pendingFiles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No pending files to verify</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingFiles.map((file) => (
                      <FileVerificationCard
                        key={file.id}
                        file={file}
                        onVerification={loadDashboardData}
                        onApprove={() => handleFileVerification(file, 'approve')}
                        onReject={() => {
                          setVerifyingFile(file)
                          setRejectModalOpen(true)
                        }}
                        isLoading={isLoading}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>Pending Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && !pendingTransactions.length ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : pendingTransactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No pending transactions</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingTransactions.map((transaction) => (
                      <div key={transaction.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="font-medium">{transaction.transaction_number}</span>
                              {getTransactionStatusBadge(transaction.status)}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div>
                                <p className="font-medium">Room</p>
                                <p>#{transaction.room.room_number}</p>
                              </div>
                              <div>
                                <p className="font-medium">Buyer</p>
                                <p>{transaction.buyer?.name || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="font-medium">Seller</p>
                                <p>{transaction.seller?.name || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="font-medium">Amount</p>
                                <p>{transaction.currency} {transaction.amount.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {(transaction.status === 'delivered' || transaction.status === 'shipped') && (
                              <Button
                                size="sm"
                                onClick={() => handleFundRelease(transaction.id)}
                                disabled={isLoading}
                              >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                                Release Funds
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rooms Tab */}
          <TabsContent value="rooms" className="space-y-6">
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
          </TabsContent>
        </Tabs>
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

      {/* Reject Modal */}
      {rejectModalOpen && verifyingFile && (
        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Reject File</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this {verifyingFile.file_type === 'payment_proof' ? 'payment proof' : 'shipping receipt'}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Rejection Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRejectModalOpen(false)
                    setRejectReason('')
                    setVerifyingFile(null)
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (verifyingFile && rejectReason.trim()) {
                      handleFileVerification(verifyingFile, 'reject', rejectReason.trim())
                      setRejectModalOpen(false)
                      setRejectReason('')
                      setVerifyingFile(null)
                    }
                  }}
                  disabled={isLoading || !rejectReason.trim()}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XSquare className="w-4 h-4 mr-2" />}
                  Reject File
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// File Verification Card Component
interface FileVerificationCardProps {
  file: TransactionFile
  onVerification: () => void
  onApprove: () => void
  onReject: () => void
  isLoading: boolean
}

function FileVerificationCard({ file, onVerification, onApprove, onReject, isLoading }: FileVerificationCardProps) {
  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            {getFileTypeBadge(file.file_type)}
            <span className="font-medium">{file.file_name}</span>
            <span className="text-sm text-gray-500">{file.file_size_formatted}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <p className="font-medium">Transaction</p>
              <p>#{file.transaction_id}</p>
            </div>
            <div>
              <p className="font-medium">Uploaded By</p>
              <p className="capitalize">{file.uploaded_by}</p>
            </div>
            <div>
              <p className="font-medium">Created</p>
              <p>{new Date(file.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(file.file_url, '_blank')}
          >
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReject}
            disabled={isLoading}
          >
            <XSquare className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            disabled={isLoading}
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            Approve
          </Button>
        </div>
      </div>
    </div>
  )
}

// Helper functions moved outside component
function getTransactionStatusIcon(status: string) {
  switch (status) {
    case 'pending_payment':
    case 'awaiting_payment_verification':
      return <CreditCard className="w-4 h-4" />
    case 'paid':
    case 'awaiting_shipping_verification':
      return <Package className="w-4 h-4" />
    case 'shipped':
      return <Truck className="w-4 h-4" />
    case 'delivered':
      return <CheckCircle className="w-4 h-4" />
    case 'disputed':
      return <AlertCircle className="w-4 h-4" />
    default:
      return <Clock className="w-4 h-4" />
  }
}

function getTransactionStatusBadge(status: string) {
  const colors = {
    'pending_payment': 'bg-yellow-100 text-yellow-800',
    'awaiting_payment_verification': 'bg-orange-100 text-orange-800',
    'paid': 'bg-blue-100 text-blue-800',
    'awaiting_shipping_verification': 'bg-purple-100 text-purple-800',
    'shipped': 'bg-indigo-100 text-indigo-800',
    'delivered': 'bg-cyan-100 text-cyan-800',
    'disputed': 'bg-red-100 text-red-800',
    'completed': 'bg-green-100 text-green-800'
  }

  return (
    <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
      {getTransactionStatusIcon(status)}
      <span className="ml-1 capitalize">{status.replace('_', ' ')}</span>
    </Badge>
  )
}

function getFileTypeIcon(fileType: string) {
  return fileType === 'payment_proof' ?
    <CreditCard className="w-4 h-4" /> :
    <Package className="w-4 h-4" />
}

function getFileTypeBadge(fileType: string) {
  const colors = {
    'payment_proof': 'bg-blue-100 text-blue-800',
    'shipping_receipt': 'bg-green-100 text-green-800'
  }

  return (
    <Badge className={colors[fileType as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
      {getFileTypeIcon(fileType)}
      <span className="ml-1">{fileType === 'payment_proof' ? 'Payment Proof' : 'Shipping Receipt'}</span>
    </Badge>
  )
}

export default function GMDashboard({ rooms, stats }: GMDashboardProps) {
  return (
    <RekberProvider>
      <GMDashboardContent rooms={rooms} stats={stats} />
    </RekberProvider>
  )
}