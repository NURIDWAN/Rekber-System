import React, { useState, useEffect } from 'react'
import { Head, Link, router } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AppLayout from '@/layouts/app-layout'
import { cn } from '@/lib/utils'
import {
  FileText,
  CreditCard,
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  Eye,
  Clock,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  AlertTriangle
} from 'lucide-react'
import transactionWebSocket, { TransactionUpdateEvent, FileVerificationEvent } from '@/services/transaction-websocket'

// Interfaces
interface Transaction {
  id: number
  transaction_number: string
  amount: number
  currency: string
  status: string
  room: {
    id: number
    room_number: number
  }
  buyer?: { name: string }
  seller?: { name: string }
  files: Array<{
    id: number
    file_type: string
    file_name: string
    status: string
  }>
  created_at: string
}

interface TransactionFileItem {
  id: number
  file_type: string
  file_name: string
  status: string
  transaction: {
    id: number
    transaction_number: string
    room: {
      room_number: number
    }
  }
  created_at: string
}

interface VerificationStats {
  pending_payment_verification: number
  pending_shipping_verification: number
  pending_fund_release: number
  total_pending_files: number
  total_transactions: number
  active_transactions: number
  completed_transactions: number
  disputed_transactions: number
}

interface PageProps {
  pendingTransactions: Transaction[]
  pendingFiles: TransactionFileItem[]
  stats: VerificationStats
}

const breadcrumbs = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Transactions', href: '/gm/transactions' }
]

export default function TransactionManagement({ pendingTransactions, pendingFiles, stats }: PageProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const unsubscribeTransaction = transactionWebSocket.onTransactionUpdate(
      () => refreshData(),
      'all'
    )
    const unsubscribeFile = transactionWebSocket.onFileVerificationUpdate(
      () => refreshData(),
      'all'
    )

    return () => {
      unsubscribeTransaction()
      unsubscribeFile()
      transactionWebSocket.cleanup()
    }
  }, [])

  const refreshData = () => {
    setIsLoading(true)
    router.reload({
      only: ['pendingTransactions', 'pendingFiles', 'stats'],
      onFinish: () => setIsLoading(false)
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      awaiting_payment_verification: "bg-amber-100 text-amber-700 border-amber-200",
      awaiting_shipping_verification: "bg-blue-100 text-blue-700 border-blue-200",
      paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
      shipped: "bg-indigo-100 text-indigo-700 border-indigo-200",
      completed: "bg-green-100 text-green-700 border-green-200",
      disputed: "bg-red-100 text-red-700 border-red-200",
      cancelled: "bg-slate-100 text-slate-700 border-slate-200"
    }

    const labels = {
      awaiting_payment_verification: "Verify Payment",
      awaiting_shipping_verification: "Verify Shipping",
      paid: "Paid",
      shipped: "Shipped",
      completed: "Completed",
      disputed: "Disputed",
      cancelled: "Cancelled"
    }

    return (
      <Badge variant="outline" className={cn("font-medium", styles[status as keyof typeof styles] || "bg-gray-100")}>
        {labels[status as keyof typeof labels] || status.replace(/_/g, ' ')}
      </Badge>
    )
  }

  const filteredTransactions = pendingTransactions.filter(t =>
    t.transaction_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.buyer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.seller?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Transaction Management - Rekber System" />

      <div className="min-h-screen bg-slate-50/50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transaction Management</h1>
              <p className="text-slate-500">Manage verification queues and monitor transaction flows.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={refreshData} disabled={isLoading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Pending Payment</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.pending_payment_verification}</p>
                  </div>
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <CreditCard className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Pending Shipping</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.pending_shipping_verification}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Truck className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Pending Release</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.pending_fund_release}</p>
                  </div>
                  <div className="p-3 bg-emerald-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Disputed</p>
                    <p className="text-2xl font-bold text-red-600">{stats.disputed_transactions}</p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="transactions" className="space-y-6">
            <TabsList className="bg-white border border-slate-200 p-1">
              <TabsTrigger value="transactions" className="data-[state=active]:bg-slate-100">
                Pending Transactions
                {pendingTransactions.length > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-700">{pendingTransactions.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="files" className="data-[state=active]:bg-slate-100">
                Pending Files
                {pendingFiles.length > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-700">{pendingFiles.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-medium">Transaction Queue</CardTitle>
                      <CardDescription>Transactions requiring your attention</CardDescription>
                    </div>
                    <div className="relative w-64">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search transactions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-slate-300 pl-8 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredTransactions.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-emerald-500/50" />
                        <p className="font-medium text-slate-900">All caught up!</p>
                        <p>No pending transactions found.</p>
                      </div>
                    ) : (
                      filteredTransactions.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-medium text-slate-900">#{transaction.transaction_number}</span>
                              {getStatusBadge(transaction.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500">
                              <span>Room #{transaction.room.room_number}</span>
                              <span>•</span>
                              <span>{transaction.currency} {transaction.amount.toLocaleString()}</span>
                              <span>•</span>
                              <span>{new Date(transaction.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/transactions/${transaction.id}`}>
                              View Details
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">File Verification Queue</CardTitle>
                  <CardDescription>Payment proofs and shipping receipts waiting for review</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pendingFiles.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-emerald-500/50" />
                        <p className="font-medium text-slate-900">No pending files</p>
                        <p>All uploaded files have been verified.</p>
                      </div>
                    ) : (
                      pendingFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-slate-100 rounded-lg">
                              {file.file_type === 'payment_proof' ? (
                                <CreditCard className="h-5 w-5 text-slate-600" />
                              ) : (
                                <Truck className="h-5 w-5 text-slate-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{file.file_name}</p>
                              <p className="text-sm text-slate-500">
                                Transaction #{file.transaction.transaction_number} • {new Date(file.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/transactions/${file.transaction.id}`}>
                              Verify
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  )
}