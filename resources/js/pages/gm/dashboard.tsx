import React, { useState, useEffect } from 'react'
import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import transactionAPI, { TransactionFile } from '@/services/transaction-api'
import AppLayout from '@/layouts/app-layout'
import { cn } from '@/lib/utils'
import {
  MessageCircle,
  Activity,
  CheckCircle,
  Clock,
  Settings,
  RefreshCw,
  TrendingUp,
  Package,
  CreditCard,
  AlertCircle,
  ArrowRight,
  Eye,
  AlertTriangle
} from 'lucide-react'
import { Room } from '@/types'

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
  status: string
}

const breadcrumbs = [
  {
    title: 'Admin Dashboard',
    href: '/dashboard',
  },
];

export default function GMDashboard({ rooms, stats }: GMDashboardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('connected')

  const [gmStats, setGmStats] = useState<GMStats | null>(null)
  const [pendingFiles, setPendingFiles] = useState<TransactionFile[]>([])

  useEffect(() => {
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      const transactionsResponse = await transactionAPI.getPendingTransactions('all', 100)
      if (transactionsResponse.success) {
        const transactions = transactionsResponse.data.data || []
        const calculatedGMStats: GMStats = {
          pending_payment_verification: transactions.filter((t: PendingTransaction) => t.status === 'awaiting_payment_verification').length,
          pending_shipping_verification: transactions.filter((t: PendingTransaction) => t.status === 'awaiting_shipping_verification').length,
          pending_fund_release: transactions.filter((t: PendingTransaction) => t.status === 'delivered').length,
          disputed_transactions: transactions.filter((t: PendingTransaction) => t.status === 'disputed').length,
          active_transactions: transactions.filter((t: PendingTransaction) => ['pending_payment', 'awaiting_payment_verification', 'paid', 'awaiting_shipping_verification', 'shipped', 'delivered'].includes(t.status)).length
        }
        setGmStats(calculatedGMStats)
      }

      const filesResponse = await transactionAPI.getPendingFiles('all', 5)
      if (filesResponse.success) {
        setPendingFiles(filesResponse.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Admin Dashboard - Rekber System" />

      <div className="min-h-screen bg-slate-50/50">
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
                <Button variant="secondary" size="sm" className="gap-2" onClick={loadDashboardData} disabled={isLoading}>
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  Refresh
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
                      <Activity className="h-3 w-3" /> Action Required
                    </span>
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
          <div className="space-y-6">

            {/* Quick Actions */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link href="/transactions" className="w-full">
                    <Button
                      className="w-full h-auto py-4 flex flex-col gap-2 bg-slate-900 hover:bg-slate-800"
                    >
                      <CreditCard className="h-6 w-6" />
                      <span>Verify Payments ({gmStats?.pending_payment_verification || 0})</span>
                    </Button>
                  </Link>
                  <Link href="/transactions" className="w-full">
                    <Button
                      variant="outline"
                      className="w-full h-auto py-4 flex flex-col gap-2 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Package className="h-6 w-6 text-slate-600" />
                      <span>Verify Shipping ({gmStats?.pending_shipping_verification || 0})</span>
                    </Button>
                  </Link>
                  <Link href="/transactions" className="w-full">
                    <Button
                      variant="outline"
                      className="w-full h-auto py-4 flex flex-col gap-2 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <TrendingUp className="h-6 w-6 text-slate-600" />
                      <span>Release Funds ({gmStats?.pending_fund_release || 0})</span>
                    </Button>
                  </Link>
                  <Link href="/transactions" className="w-full">
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-auto py-4 flex flex-col gap-2 border-slate-200 hover:bg-slate-50 hover:text-slate-900",
                        gmStats?.disputed_transactions! > 0 && "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                      )}
                    >
                      <AlertCircle className={cn("h-6 w-6", gmStats?.disputed_transactions! > 0 ? "text-rose-600" : "text-slate-600")} />
                      <span>Handle Disputes ({gmStats?.disputed_transactions || 0})</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Recent Activity / Pending Files */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-medium">Pending Verifications</CardTitle>
                      <CardDescription>Recent files waiting for review</CardDescription>
                    </div>
                    <Link href="/transactions">
                      <Button variant="ghost" size="sm">View All</Button>
                    </Link>
                  </div>
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
                          <Link href={`/transactions/${file.transaction?.id}`}>
                            <Button size="sm" variant="outline">
                              Review
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Active Rooms Preview */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-medium">Active Rooms</CardTitle>
                      <CardDescription>Recently active transaction rooms</CardDescription>
                    </div>
                    <Link href="/gm/rooms">
                      <Button variant="ghost" size="sm">View All</Button>
                    </Link>
                  </div>
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
                        <Link href={`/rooms/${room.id}`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4 text-slate-400" />
                          </Button>
                        </Link>
                      </div>
                    ))}
                    {rooms.filter(r => r.status === 'in_use').length === 0 && (
                      <p className="text-center text-sm text-slate-500 py-4">No active rooms at the moment.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}