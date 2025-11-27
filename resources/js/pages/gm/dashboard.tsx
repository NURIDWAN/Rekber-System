import React, { useState, useEffect } from 'react'
import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import RekberProvider from '@/components/RekberProvider'
import { ShareUrlModal } from '@/components/ShareUrlModal'
import { getRoomUrl } from '@/lib/roomUrlUtils'
import transactionAPI, { TransactionDetails, TransactionFile } from '@/services/transaction-api'
import AppLayout from '@/layouts/app-layout'
import { cn } from '@/lib/utils'
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
  Loader2,
  ArrowRight,
  Search,
  Filter
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

const breadcrumbs = [
  {
    title: 'Admin Dashboard',
    href: '/dashboard',
  },
];

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
    completedTransactions: stats?.completedTransactions || 0,
    pendingVerifications: stats?.pendingVerifications || 0,
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
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'in_use':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'free':
        return <CheckCircle className="w-3.5 h-3.5" />
      case 'in_use':
        return <Clock className="w-3.5 h-3.5" />
      default:
        return <AlertTriangle className="w-3.5 h-3.5" />
    }
  }

  const getTransactionStatusBadge = (status: string) => {
    const styles = {
      'pending_payment': 'bg-amber-100 text-amber-700 border-amber-200',
      'awaiting_payment_verification': 'bg-orange-100 text-orange-700 border-orange-200',
      'paid': 'bg-blue-100 text-blue-700 border-blue-200',
      'awaiting_shipping_verification': 'bg-violet-100 text-violet-700 border-violet-200',
      'shipped': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'delivered': 'bg-cyan-100 text-cyan-700 border-cyan-200',
      'disputed': 'bg-rose-100 text-rose-700 border-rose-200',
      'completed': 'bg-emerald-100 text-emerald-700 border-emerald-200'
    }

    return (
      <Badge variant="outline" className={cn("font-medium", styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700 border-slate-200')}>
        <span className="capitalize">{status.replace(/_/g, ' ')}</span>
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Head title="Admin Dashboard - Rekber System" />

      {/* Hero Section with Stats */}
      <div className="relative overflow-hidden bg-slate-900 pb-32 pt-12">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-slate-900 to-slate-900" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard Overview</h1>
              <p className="mt-2 text-slate-400">Welcome back, Administrator. Here's what's happening today.</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={cn(
                "px-3 py-1 border-slate-700",
                connectionStatus === 'connected' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
              )}>
                <div className={cn("mr-2 h-2 w-2 rounded-full", connectionStatus === 'connected' ? "bg-emerald-400" : "bg-rose-400")} />
                {connectionStatus === 'connected' ? 'System Online' : 'System Offline'}
              </Badge>
              <Button variant="secondary" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>

          {/* Main Stats Grid */}
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-none bg-white/10 text-white backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Pending Verifications</p>
                    <p className="mt-2 text-3xl font-bold">{gmStats?.pending_payment_verification || 0}</p>
                  </div>
                  <div className="rounded-lg bg-white/10 p-3">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-slate-300">
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Activity className="h-3 w-3" /> +2
                  </span>
                  <span className="ml-1.5">since last hour</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-white/10 text-white backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Active Transactions</p>
                    <p className="mt-2 text-3xl font-bold">{gmStats?.active_transactions || 0}</p>
                  </div>
                  <div className="rounded-lg bg-white/10 p-3">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-slate-300">
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" /> Stable
                  </span>
                  <span className="ml-1.5">volume today</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-white/10 text-white backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Active Rooms</p>
                    <p className="mt-2 text-3xl font-bold">{rooms.filter(r => r.status === 'in_use').length}</p>
                  </div>
                  <div className="rounded-lg bg-white/10 p-3">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-slate-300">
                  <span className="text-slate-400 font-medium">
                    {rooms.length} total rooms
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-white/10 text-white backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Disputes</p>
                    <p className="mt-2 text-3xl font-bold">{gmStats?.disputed_transactions || 0}</p>
                  </div>
                  <div className="rounded-lg bg-white/10 p-3">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-slate-300">
                  {gmStats?.disputed_transactions ? (
                    <span className="text-rose-400 font-medium flex items-center gap-1">
                      Action Required
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      All clear
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative mx-auto -mt-24 max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-full max-w-md grid-cols-3 bg-white/10 p-1 text-white backdrop-blur-md">
              <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">Overview</TabsTrigger>
              <TabsTrigger value="transactions" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">Transactions</TabsTrigger>
              <TabsTrigger value="rooms" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">Rooms</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-white/90 backdrop-blur hover:bg-white" onClick={loadDashboardData} disabled={isLoading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                Refresh Data
              </Button>
            </div>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Quick Actions */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    onClick={() => setActiveTab('transactions')}
                    className="h-auto py-4 flex flex-col gap-2 bg-slate-900 hover:bg-slate-800"
                  >
                    <CreditCard className="h-6 w-6" />
                    <span>Verify Payments ({gmStats?.pending_payment_verification || 0})</span>
                  </Button>
                  <Button
                    onClick={() => setActiveTab('transactions')}
                    variant="outline"
                    className="h-auto py-4 flex flex-col gap-2 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Package className="h-6 w-6 text-slate-600" />
                    <span>Verify Shipping ({gmStats?.pending_shipping_verification || 0})</span>
                  </Button>
                  <Button
                    onClick={() => setActiveTab('transactions')}
                    variant="outline"
                    className="h-auto py-4 flex flex-col gap-2 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <TrendingUp className="h-6 w-6 text-slate-600" />
                    <span>Release Funds ({gmStats?.pending_fund_release || 0})</span>
                  </Button>
                  <Button
                    onClick={() => setActiveTab('transactions')}
                    variant="outline"
                    className={cn(
                      "h-auto py-4 flex flex-col gap-2 border-slate-200 hover:bg-slate-50 hover:text-slate-900",
                      gmStats?.disputed_transactions! > 0 && "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                    )}
                  >
                    <AlertCircle className={cn("h-6 w-6", gmStats?.disputed_transactions! > 0 ? "text-rose-600" : "text-slate-600")} />
                    <span>Handle Disputes ({gmStats?.disputed_transactions || 0})</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Recent Activity / Pending Files */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Pending Verifications</CardTitle>
                  <CardDescription>Files waiting for your review</CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                      <CheckCircle className="h-12 w-12 text-slate-200 mb-3" />
                      <p>All caught up! No pending files.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingFiles.slice(0, 5).map((file) => (
                        <div key={file.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-full", file.file_type === 'payment_proof' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600")}>
                              {file.file_type === 'payment_proof' ? <CreditCard className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {file.file_type === 'payment_proof' ? 'Payment Proof' : 'Shipping Receipt'}
                              </p>
                              <p className="text-xs text-slate-500">
                                Room #{file.transaction?.room?.room_number || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setActiveTab('transactions')}>
                            Review
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Status / Recent Rooms */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Active Rooms</CardTitle>
                  <CardDescription>Recently active transaction rooms</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {rooms.filter(r => r.status === 'in_use').slice(0, 5).map((room) => (
                      <div key={room.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">Room #{room.room_number}</p>
                            <p className="text-xs text-slate-500">
                              {room.buyer?.name || 'Waiting'} & {room.seller?.name || 'Waiting'}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={getRoomUrl(room)} target="_blank" rel="noreferrer">
                            <Eye className="h-4 w-4 text-slate-400" />
                          </a>
                        </Button>
                      </div>
                    ))}
                    {rooms.filter(r => r.status === 'in_use').length === 0 && (
                      <p className="text-center text-sm text-slate-500 py-4">No active rooms at the moment.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-medium">Verification Queue</CardTitle>
                    <CardDescription>Process pending payments and shipping receipts</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Filter className="mr-2 h-4 w-4" />
                      Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading && !pendingFiles.length ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : pendingFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-slate-100 p-4 mb-4">
                      <CheckSquare className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">All caught up!</h3>
                    <p className="text-slate-500">No pending files to verify at this time.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Transaction History</CardTitle>
                <CardDescription>Recent transactions and their status</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingTransactions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No transactions found.</div>
                ) : (
                  <div className="rounded-md border border-slate-200">
                    <div className="divide-y divide-slate-200">
                      {pendingTransactions.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="rounded-full bg-slate-100 p-2">
                              <FileText className="h-5 w-5 text-slate-600" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{transaction.transaction_number}</p>
                              <p className="text-sm text-slate-500">
                                Room #{transaction.room.room_number} • {transaction.currency} {transaction.amount.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {getTransactionStatusBadge(transaction.status)}
                            {(transaction.status === 'delivered' || transaction.status === 'shipped') && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleFundRelease(transaction.id)}
                                disabled={isLoading}
                              >
                                {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <TrendingUp className="h-3 w-3 mr-2" />}
                                Release Funds
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rooms Tab */}
          <TabsContent value="rooms" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-medium">Room Management</CardTitle>
                    <CardDescription>Monitor and manage all active rooms</CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search rooms..."
                      className="w-full rounded-md border border-slate-300 pl-8 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {rooms.map((room) => (
                    <Card
                      key={room.id}
                      className={cn(
                        "transition-all hover:shadow-md cursor-pointer border-slate-200",
                        selectedRoom?.id === room.id && "ring-2 ring-slate-900"
                      )}
                      onClick={() => setSelectedRoom(room)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-slate-900">Room #{room.room_number}</h3>
                          <Badge variant="secondary" className={getRoomStatusColor(room.status)}>
                            {getStatusIcon(room.status)}
                            <span className="ml-1.5 capitalize">{room.status.replace('_', ' ')}</span>
                          </Badge>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Buyer</span>
                            <span className="font-medium text-slate-900 truncate max-w-[100px]">{room.buyer?.name || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Seller</span>
                            <span className="font-medium text-slate-900 truncate max-w-[100px]">{room.seller?.name || '—'}</span>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 h-8 text-slate-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = getRoomUrl(room)
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleShareRoom(room)
                            }}
                          >
                            <Share className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {rooms.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p>No rooms found.</p>
                  </div>
                )}
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
              <DialogTitle>Reject Verification</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this {verifyingFile.file_type === 'payment_proof' ? 'payment proof' : 'shipping receipt'}. This will be sent to the user.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Rejection Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., Image is blurry, Incorrect amount, etc."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
            <DialogFooter>
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
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XSquare className="w-4 h-4 mr-2" />}
                Reject File
              </Button>
            </DialogFooter>
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
    <Card className="overflow-hidden border-slate-200 transition-all hover:shadow-md">
      <div className="aspect-video w-full bg-slate-100 relative group cursor-pointer" onClick={() => window.open(file.file_url, '_blank')}>
        <img
          src={file.file_url}
          alt="Verification Proof"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
        </div>
        <div className="absolute top-2 right-2">
          <Badge className={cn("shadow-sm", file.file_type === 'payment_proof' ? "bg-blue-500 hover:bg-blue-600" : "bg-purple-500 hover:bg-purple-600")}>
            {file.file_type === 'payment_proof' ? 'Payment' : 'Shipping'}
          </Badge>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="mb-4 space-y-1">
          <p className="font-medium text-slate-900">Room #{file.transaction?.room?.room_number}</p>
          <p className="text-xs text-slate-500">
            Uploaded by {file.uploader?.name || 'Unknown'} • {new Date(file.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="w-full border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
            disabled={isLoading}
          >
            Reject
          </Button>
          <Button
            className="w-full bg-slate-900 hover:bg-slate-800"
            onClick={(e) => {
              e.stopPropagation();
              onApprove();
            }}
            disabled={isLoading}
          >
            Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard({ rooms, stats }: GMDashboardProps) {
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <RekberProvider>
        <GMDashboardContent rooms={rooms} stats={stats} />
      </RekberProvider>
    </AppLayout>
  )
}