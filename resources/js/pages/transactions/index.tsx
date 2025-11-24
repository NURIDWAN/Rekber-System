import React, { useState, useEffect } from 'react'
import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  FileText,
  CreditCard,
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  Eye,
  Clock,
  Users,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Wifi,
  WifiOff,
  Settings,
  Globe,
  Zap,
  Activity,
  Filter
} from 'lucide-react'
import { router } from '@inertiajs/react'
import transactionAPI, { TransactionDetails, TransactionFile } from '@/services/transaction-api'
import transactionWebSocket, { TransactionUpdateEvent, FileVerificationEvent } from '@/services/transaction-websocket'

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
  buyer?: {
    name: string
  }
  seller?: {
    name: string
  }
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

// Translations
const translations = {
  id: {
    title: 'Manajemen Transaksi',
    subtitle: 'Kelola verifikasi pembayaran dan pengiriman untuk semua transaksi',
    pendingPayment: 'Verifikasi Pembayaran',
    pendingShipping: 'Verifikasi Pengiriman',
    pendingFunds: 'Rilis Dana',
    pendingFiles: 'Total File Pending',
    totalTransactions: 'Total Transaksi',
    activeTransactions: 'Transaksi Aktif',
    completedTransactions: 'Transaksi Selesai',
    disputedTransactions: 'Transaksi Dispute',
    waitingVerification: 'Menunggu verifikasi',
    pending: 'Pending',
    verified: 'Terverifikasi',
    rejected: 'Ditolak',
    paid: 'Dibayar',
    shipped: 'Dikirim',
    noData: 'Tidak Ada Data',
    noPending: 'Tidak Ada Transaksi Pending',
    allVerified: 'Semua transaksi sudah terverifikasi',
    refresh: 'Refresh',
    detail: 'Detail',
    transactionDetail: 'Detail Transaksi',
    connectionStatus: 'Status Koneksi',
    realTimeUpdates: 'Update Real-time',
    view: 'Lihat',
    showAdvanced: 'Tampilkan Fitur Lanjutan',
    transactionsTab: 'Transaksi Pending',
    filesTab: 'File Pending',
    buyer: 'Pembeli',
    seller: 'Penjual',
    room: 'Ruang',
    uploadedAt: 'Diunggah',
    waitingText: 'Menunggu'
  },
  en: {
    title: 'Transaction Management',
    subtitle: 'Manage payment and shipping verification for all transactions',
    pendingPayment: 'Payment Verification',
    pendingShipping: 'Shipping Verification',
    pendingFunds: 'Fund Release',
    pendingFiles: 'Total Pending Files',
    totalTransactions: 'Total Transactions',
    activeTransactions: 'Active Transactions',
    completedTransactions: 'Completed Transactions',
    disputedTransactions: 'Disputed Transactions',
    waitingVerification: 'Waiting verification',
    pending: 'Pending',
    verified: 'Verified',
    rejected: 'Rejected',
    paid: 'Paid',
    shipped: 'Shipped',
    noData: 'No Data',
    noPending: 'No Pending Transactions',
    allVerified: 'All transactions are verified',
    refresh: 'Refresh',
    detail: 'Detail',
    transactionDetail: 'Transaction Detail',
    connectionStatus: 'Connection Status',
    realTimeUpdates: 'Real-time Updates',
    view: 'View',
    showAdvanced: 'Show Advanced Features',
    transactionsTab: 'Pending Transactions',
    filesTab: 'Pending Files',
    buyer: 'Buyer',
    seller: 'Seller',
    room: 'Room',
    uploadedAt: 'Uploaded',
    waitingText: 'Waiting'
  }
}

export default function UnifiedTransactionManagement({ pendingTransactions, pendingFiles, stats }: PageProps) {
  const [language, setLanguage] = useState<'id' | 'en'>('id')
  const [isLoading, setIsLoading] = useState(false)
  const [isAdvancedMode, setIsAdvancedMode] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [realtimeUpdates, setRealtimeUpdates] = useState<string[]>([])

  const t = translations[language]

  useEffect(() => {
    // Setup WebSocket for real-time updates
    setupWebSocketListeners()

    // Set connection status checker
    const connectionChecker = setInterval(() => {
      setIsConnected(transactionWebSocket.getConnectionStatus())
    }, 5000)

    return () => {
      connectionChecker && clearInterval(connectionChecker)
      transactionWebSocket.cleanup()
    }
  }, [])

  const setupWebSocketListeners = () => {
    // Listen to transaction updates
    const unsubscribeTransaction = transactionWebSocket.onTransactionUpdate(
      (event: TransactionUpdateEvent) => {
        console.log('Transaction update received:', event)
        setLastUpdate(new Date())
        setIsConnected(true)

        // Add to update log
        setRealtimeUpdates(prev => [
          ...prev.slice(-2), // Keep only last 3 updates
          `[${new Date().toLocaleTimeString()}] ${event.event_type}: ${event.transaction.transaction_number}`
        ])

        // Refresh data periodically for now
        setTimeout(() => {
          refreshData()
        }, 1000)
      },
      'all'
    )

    // Listen to file verification updates
    const unsubscribeFile = transactionWebSocket.onFileVerificationUpdate(
      (event: FileVerificationEvent) => {
        console.log('File verification update received:', event)
        setLastUpdate(new Date())
        setIsConnected(true)

        setRealtimeUpdates(prev => [
          ...prev.slice(-2),
          `[${new Date().toLocaleTimeString()}] File ${event.action}: ${event.file.file_name}`
        ])

        setTimeout(() => {
          refreshData()
        }, 1000)
      },
      'all'
    )

    return () => {
      unsubscribeTransaction()
      unsubscribeFile()
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'awaiting_payment_verification': {
        label: language === 'id' ? 'Verifikasi Pembayaran' : 'Payment Verification',
        variant: 'destructive' as const,
        icon: Clock
      },
      'awaiting_shipping_verification': {
        label: language === 'id' ? 'Verifikasi Pengiriman' : 'Shipping Verification',
        variant: 'destructive' as const,
        icon: Truck
      },
      'paid': { label: t.paid, variant: 'default' as const, icon: CheckCircle },
      'shipped': { label: t.shipped, variant: 'default' as const, icon: Package },
      'pending': { label: t.pending, variant: 'destructive' as const, icon: Clock },
      'verified': { label: t.verified, variant: 'default' as const, icon: CheckCircle },
      'rejected': { label: t.rejected, variant: 'destructive' as const, icon: AlertCircle },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      variant: 'default' as const,
      icon: FileText
    }
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    )
  }

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'payment_proof': return <CreditCard className="w-4 h-4" />
      case 'shipping_receipt': return <Truck className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const refreshData = () => {
    setIsLoading(true)
    router.reload({
      only: ['pendingTransactions', 'pendingFiles', 'stats'],
      onSuccess: () => setIsLoading(false),
      onFinish: () => setIsLoading(false)
    })
  }

  const getAdvancedStats = () => {
    if (!isAdvancedMode) return []

    return [
      {
        title: t.totalTransactions,
        value: stats.total_transactions,
        icon: Package,
        color: 'text-gray-600'
      },
      {
        title: t.activeTransactions,
        value: stats.active_transactions,
        icon: Activity,
        color: 'text-blue-600'
      },
      {
        title: t.completedTransactions,
        value: stats.completed_transactions,
        icon: CheckCircle,
        color: 'text-green-600'
      },
      {
        title: t.disputedTransactions,
        value: stats.disputed_transactions,
        icon: AlertCircle,
        color: 'text-red-600'
      }
    ]
  }

  return (
    <>
      <Head title={t.title} />

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
                <p className="text-gray-600 mt-2">{t.subtitle}</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Language Toggle */}
                <div className="flex items-center gap-2 bg-white rounded-lg border p-2">
                  <Globe className="w-4 h-4 text-gray-600" />
                  <Button
                    variant={language === 'id' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setLanguage('id')}
                  >
                    ID
                  </Button>
                  <Button
                    variant={language === 'en' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setLanguage('en')}
                  >
                    EN
                  </Button>
                </div>

                {/* Advanced Mode Toggle */}
                <div className="flex items-center gap-2 bg-white rounded-lg border p-2">
                  <Settings className="w-4 h-4 text-gray-600" />
                  <Label htmlFor="advanced-mode" className="text-sm">
                    {t.showAdvanced}
                  </Label>
                  <Switch
                    id="advanced-mode"
                    checked={isAdvancedMode}
                    onCheckedChange={setIsAdvancedMode}
                  />
                </div>

                {/* Real-time Status */}
                <div className="flex items-center gap-2 bg-white rounded-lg border p-2">
                  {isConnected ? (
                    <Wifi className="w-4 h-4 text-green-600" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-sm text-gray-600">
                    {t.connectionStatus}
                  </span>
                </div>

                {/* Refresh Button */}
                <Button
                  onClick={refreshData}
                  disabled={isLoading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  {t.refresh}
                </Button>
              </div>
            </div>

            {/* Real-time Updates Log */}
            {isAdvancedMode && realtimeUpdates.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-2 text-blue-900 mb-2">
                  <Zap className="w-4 h-4" />
                  <span className="font-medium text-sm">{t.realTimeUpdates}</span>
                  {lastUpdate && (
                    <span className="text-xs text-blue-700">
                      (Last: {lastUpdate.toLocaleTimeString()})
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {realtimeUpdates.map((update, index) => (
                    <div key={index} className="text-xs text-blue-800 font-mono">
                      {update}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.pendingPayment}</CardTitle>
                <CreditCard className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.pending_payment_verification}</div>
                <p className="text-xs text-muted-foreground">{t.waitingVerification}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.pendingShipping}</CardTitle>
                <Truck className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.pending_shipping_verification}</div>
                <p className="text-xs text-muted-foreground">{t.waitingVerification}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.pendingFunds}</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.pending_fund_release}</div>
                <p className="text-xs text-muted-foreground">{t.waitingText}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.pendingFiles}</CardTitle>
                <FileText className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.total_pending_files}</div>
                <p className="text-xs text-muted-foreground">{t.waitingVerification}</p>
              </CardContent>
            </Card>
          </div>

          {/* Advanced Stats */}
          {isAdvancedMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {getAdvancedStats().map((stat, index) => {
                const Icon = stat.icon
                return (
                  <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                      <p className="text-xs text-muted-foreground">{t.waitingText}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Main Content */}
          <Tabs defaultValue="transactions" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transactions" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                {t.transactionsTab}
              </TabsTrigger>
              <TabsTrigger value="files" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t.filesTab}
              </TabsTrigger>
            </TabsList>

            {/* Transactions Tab */}
            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    {t.noPending}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingTransactions.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{t.allVerified}</h3>
                      <p className="text-gray-500">{t.allVerified.toLowerCase()}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingTransactions.map((transaction) => (
                        <div key={transaction.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-medium">#{transaction.transaction_number}</span>
                                {getStatusBadge(transaction.status)}
                              </div>
                              <div className="text-sm text-gray-600 space-y-1">
                                <p>{t.room} {transaction.room.room_number} • {transaction.currency} {transaction.amount.toLocaleString()}</p>
                                <p>{t.buyer}: {transaction.buyer?.name || 'N/A'} • {t.seller}: {transaction.seller?.name || 'N/A'}</p>
                              </div>
                            </div>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <Link href={`/transactions/${transaction.id}`}>
                                <Eye className="w-4 h-4" />
                                {t.detail}
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {t.filesTab}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingFiles.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{t.noData}</h3>
                      <p className="text-gray-500">{t.allVerified.toLowerCase()}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingFiles.map((file) => (
                        <div key={file.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                {getFileTypeIcon(file.file_type)}
                                <span className="font-medium">{file.file_name}</span>
                                {getStatusBadge(file.status)}
                              </div>
                              <div className="text-sm text-gray-600 space-y-1">
                                <p>{t.transactionDetail}: #{file.transaction.transaction_number} • {t.room} {file.transaction.room.room_number}</p>
                                <p>{t.uploadedAt}: {new Date(file.created_at).toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}</p>
                              </div>
                            </div>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <Link href={`/transactions/${file.transaction.id}`}>
                                <Eye className="w-4 h-4" />
                                {t.transactionDetail}
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}