import React, { useState, useEffect } from 'react'
import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  RefreshCw
} from 'lucide-react'
import { router } from '@inertiajs/react'

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

interface TransactionFile {
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
}

interface PageProps {
  pendingTransactions: Transaction[]
  pendingFiles: TransactionFile[]
  stats: VerificationStats
}

export default function TransactionVerificationHub({ pendingTransactions, pendingFiles, stats }: PageProps) {
  const [isLoading, setIsLoading] = useState(false)

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'awaiting_payment_verification': { label: 'Verifikasi Pembayaran', variant: 'destructive' as const, icon: Clock },
      'awaiting_shipping_verification': { label: 'Verifikasi Pengiriman', variant: 'destructive' as const, icon: Truck },
      'paid': { label: 'Dibayar', variant: 'default' as const, icon: CheckCircle },
      'shipped': { label: 'Dikirim', variant: 'default' as const, icon: Package },
      'pending': { label: 'Pending', variant: 'destructive' as const, icon: Clock },
      'verified': { label: 'Terverifikasi', variant: 'default' as const, icon: CheckCircle },
      'rejected': { label: 'Ditolak', variant: 'destructive' as const, icon: AlertCircle },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'default' as const, icon: FileText }
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

  return (
    <>
      <Head title="Verifikasi Transaksi" />

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Verifikasi Transaksi</h1>
                <p className="text-gray-600 mt-2">Kelola verifikasi pembayaran dan pengiriman untuk semua transaksi</p>
              </div>
              <Button
                onClick={refreshData}
                disabled={isLoading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Verifikasi Pembayaran</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.pending_payment_verification}</div>
                <p className="text-xs text-muted-foreground">Menunggu verifikasi</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Verifikasi Pengiriman</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.pending_shipping_verification}</div>
                <p className="text-xs text-muted-foreground">Menunggu verifikasi</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rilis Dana</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.pending_fund_release}</div>
                <p className="text-xs text-muted-foreground">Siap dirilis</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total File Pending</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.total_pending_files}</div>
                <p className="text-xs text-muted-foreground">File menunggu verifikasi</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="transactions" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transactions">Transaksi Pending</TabsTrigger>
              <TabsTrigger value="files">File Pending</TabsTrigger>
            </TabsList>

            {/* Transactions Tab */}
            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Transaksi Menunggu Verifikasi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingTransactions.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak Ada Transaksi Pending</h3>
                      <p className="text-gray-500">Semua transaksi sudah terverifikasi</p>
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
                                <p>Ruang {transaction.room.room_number} • {transaction.currency} {transaction.amount.toLocaleString()}</p>
                                <p>Pembeli: {transaction.buyer?.name || 'N/A'} • Penjual: {transaction.seller?.name || 'N/A'}</p>
                              </div>
                            </div>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <Link href={`/verifications/transactions/${transaction.id}`}>
                                <Eye className="w-4 h-4" />
                                Detail
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
                    File Menunggu Verifikasi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingFiles.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak Ada File Pending</h3>
                      <p className="text-gray-500">Semua file sudah terverifikasi</p>
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
                                <p>Transaksi: #{file.transaction.transaction_number} • Ruang {file.transaction.room.room_number}</p>
                                <p>Diunggah: {new Date(file.created_at).toLocaleString('id-ID')}</p>
                              </div>
                            </div>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <Link href={`/verifications/transactions/${file.transaction.id}`}>
                                <Eye className="w-4 h-4" />
                                Detail Transaksi
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