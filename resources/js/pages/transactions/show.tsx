import React, { useState, useEffect } from 'react'
import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  Eye,
  Download,
  CheckSquare,
  XSquare,
  FileText,
  CreditCard,
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  Calendar,
  MessageCircle,
  RefreshCw,
  Loader2,
  Activity
} from 'lucide-react'
import { router } from '@inertiajs/react'
import transactionAPI, { TransactionDetails, TransactionFile } from '@/services/transaction-api'
import { showErrorNotification } from '@/utils/notifications'

interface Transaction {
  id: number
  transaction_number: string
  amount: number
  currency: string
  status: string
  payment_status: string
  description: string
  buyer_notes?: string
  seller_notes?: string
  gm_notes?: string
  commission: number
  fee: number
  total_amount: number
  room: {
    id: number
    room_number: number
    status: string
  }
  buyer?: {
    id: number
    name: string
    role: string
  }
  seller?: {
    id: number
    name: number
    role: string
  }
  files: TransactionFile[]
  payment_verified_by?: number
  payment_verified_at?: string
  shipping_verified_by?: number
  shipping_verified_at?: string
  funds_released_by?: number
  funds_released_at?: string
  created_at: string
  updated_at: string
}

interface Activity {
  id: number
  room_id: number
  action: string
  user_name: string
  role: string
  description: string
  created_at: string
}

interface PageProps {
  transaction: Transaction
  activities: Activity[]
}

export default function TransactionVerificationDetail({ transaction, activities }: PageProps) {
  const [verifyingFile, setVerifyingFile] = useState<TransactionFile | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [verificationType, setVerificationType] = useState<'payment' | 'shipping'>('payment')
  const [isLoading, setIsLoading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [releaseFundsModalOpen, setReleaseFundsModalOpen] = useState(false)
  const [releaseFundsNotes, setReleaseFundsNotes] = useState('')

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'pending_payment': { label: 'Menunggu Pembayaran', variant: 'destructive' as const, icon: Clock },
      'awaiting_payment_verification': { label: 'Verifikasi Pembayaran', variant: 'destructive' as const, icon: CreditCard },
      'paid': { label: 'Dibayar', variant: 'default' as const, icon: CheckCircle },
      'awaiting_shipping_verification': { label: 'Verifikasi Pengiriman', variant: 'destructive' as const, icon: Truck },
      'shipped': { label: 'Dikirim', variant: 'default' as const, icon: Package },
      'goods_received': { label: 'Diterima', variant: 'default' as const, icon: CheckCircle },
      'completed': { label: 'Selesai', variant: 'default' as const, icon: CheckCircle },
      'cancelled': { label: 'Dibatalkan', variant: 'destructive' as const, icon: AlertCircle },
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

  const getFileStatusBadge = (status: string) => {
    const statusConfig = {
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

  const getProgressPercentage = () => {
    const steps = ['pending_payment', 'paid', 'shipped', 'completed']
    const currentIndex = steps.indexOf(transaction.status)
    return currentIndex >= 0 ? ((currentIndex + 1) / steps.length) * 100 : 0
  }

  const canVerifyPayment = transaction.status === 'awaiting_payment_verification'
  const canVerifyShipping = transaction.status === 'awaiting_shipping_verification'
  const canReleaseFunds = transaction.status === 'goods_received'

  const handleVerifyFile = async (file: TransactionFile, action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectReason.trim()) {
      showErrorNotification('Harap masukkan alasan penolakan', { title: 'Validasi Gagal' })
      return
    }

    setIsLoading(true)
    try {
      // Use the correct API method based on file type
      if (file.file_type === 'payment_proof') {
        await transactionAPI.verifyPaymentProof(file.id, action, action === 'reject' ? rejectReason : undefined)
      } else if (file.file_type === 'shipping_receipt') {
        await transactionAPI.verifyShippingReceipt(file.id, action, action === 'reject' ? rejectReason : undefined)
      } else {
        throw new Error(`Unknown file type: ${file.file_type}`)
      }

      // Refresh page data
      router.reload({
        only: ['transaction', 'activities'],
        onSuccess: () => {
          setRejectModalOpen(false)
          setRejectReason('')
          setVerifyingFile(null)
        }
      })
    } catch (error) {
      console.error('Verification failed:', error)
      // Error notification is now handled by the API service
    } finally {
      setIsLoading(false)
    }
  }

  const handleReleaseFunds = async () => {
    setIsLoading(true)
    try {
      await transactionAPI.releaseFunds(transaction.id, releaseFundsNotes)

      router.reload({
        only: ['transaction', 'activities'],
        onSuccess: () => {
          setReleaseFundsModalOpen(false)
          setReleaseFundsNotes('')
        }
      })
    } catch (error) {
      console.error('Release funds failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openRejectModal = (file: TransactionFile, type: 'payment' | 'shipping') => {
    setVerifyingFile(file)
    setVerificationType(type)
    setRejectModalOpen(true)
  }

  return (
    <>
      <Head title={`Detail Transaksi #${transaction.transaction_number}`} />

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <Link href="/verifications/transactions">
                    <ArrowLeft className="w-4 h-4" />
                    Kembali
                  </Link>
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Detail Transaksi #{transaction.transaction_number}</h1>
                  <p className="text-gray-600 mt-1">Ruang {transaction.room.room_number}</p>
                </div>
              </div>
              {getStatusBadge(transaction.status)}
            </div>
          </div>

          {/* Progress Bar */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress Transaksi</span>
                  <span>{Math.round(getProgressPercentage())}%</span>
                </div>
                <Progress value={getProgressPercentage()} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Transaction Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Informasi Transaksi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">Jumlah</Label>
                      <p className="font-medium">{transaction.currency} {transaction.amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Total (Termasuk Fee)</Label>
                      <p className="font-medium">{transaction.currency} {transaction.total_amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Komisi</Label>
                      <p className="font-medium">{transaction.currency} {transaction.commission.toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Tanggal Dibuat</Label>
                      <p className="font-medium">{new Date(transaction.created_at).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                  {transaction.description && (
                    <div>
                      <Label className="text-sm text-gray-600">Deskripsi</Label>
                      <p className="text-gray-900">{transaction.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* File Verification */}
              <Card>
                <CardHeader>
                  <CardTitle>Verifikasi File</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {transaction.files
                    .filter(file => file.file_type === 'payment_proof')
                    .map(file => (
                      <div key={file.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-blue-600" />
                            <div>
                              <h4 className="font-medium">Bukti Pembayaran</h4>
                              <p className="text-sm text-gray-600">{file.file_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getFileStatusBadge(file.status)}
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                              onClick={() => {
                                setPreviewImage(file.file_url || '');
                                setPreviewModalOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              Lihat
                            </Button>
                          </div>
                        </div>

                        {canVerifyPayment && file.status === 'pending' && (
                          <div className="flex gap-3 pt-3 border-t">
                            <Button
                              onClick={() => handleVerifyFile(file, 'approve')}
                              disabled={isLoading}
                              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                            >
                              <CheckSquare className="w-4 h-4" />
                              Setujui
                            </Button>
                            <Button
                              onClick={() => openRejectModal(file, 'payment')}
                              disabled={isLoading}
                              variant="destructive"
                              className="flex items-center gap-2"
                            >
                              <XSquare className="w-4 h-4" />
                              Tolak
                            </Button>
                          </div>
                        )}

                        {file.verified_at && (
                          <div className="pt-3 border-t">
                            <p className="text-sm text-gray-600">
                              Terverifikasi pada {new Date(file.verified_at).toLocaleString('id-ID')}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}

                  {transaction.files
                    .filter(file => file.file_type === 'shipping_receipt')
                    .map(file => (
                      <div key={file.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Truck className="w-5 h-5 text-orange-600" />
                            <div>
                              <h4 className="font-medium">Bukti Pengiriman</h4>
                              <p className="text-sm text-gray-600">{file.file_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getFileStatusBadge(file.status)}
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                              onClick={() => {
                                setPreviewImage(file.file_url || '');
                                setPreviewModalOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              Lihat
                            </Button>
                          </div>
                        </div>

                        {canVerifyShipping && file.status === 'pending' && (
                          <div className="flex gap-3 pt-3 border-t">
                            <Button
                              onClick={() => handleVerifyFile(file, 'approve')}
                              disabled={isLoading}
                              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                            >
                              <CheckSquare className="w-4 h-4" />
                              Setujui
                            </Button>
                            <Button
                              onClick={() => openRejectModal(file, 'shipping')}
                              disabled={isLoading}
                              variant="destructive"
                              className="flex items-center gap-2"
                            >
                              <XSquare className="w-4 h-4" />
                              Tolak
                            </Button>
                          </div>
                        )}

                        {file.verified_at && (
                          <div className="pt-3 border-t">
                            <p className="text-sm text-gray-600">
                              Terverifikasi pada {new Date(file.verified_at).toLocaleString('id-ID')}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                </CardContent>
              </Card>

              {/* Activities */}
              <Card>
                <CardHeader>
                  <CardTitle>Aktivitas Terkini</CardTitle>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Belum ada aktivitas</p>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Activity className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-900">{activity.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {activity.user_name} • {activity.role} • {new Date(activity.created_at).toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Admin Actions */}
              {canReleaseFunds && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-green-800">Aksi Admin</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => setReleaseFundsModalOpen(true)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Rilis Dana ke Penjual
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Participants */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Peserta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {transaction.buyer && (
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <Package className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="font-medium">Pembeli</span>
                      </div>
                      <p className="text-sm text-gray-900">{transaction.buyer.name}</p>
                    </div>
                  )}
                  {transaction.seller && (
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Package className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="font-medium">Penjual</span>
                      </div>
                      <p className="text-sm text-gray-900">{transaction.seller.name}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>Catatan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {transaction.buyer_notes && (
                    <div>
                      <Label className="text-sm text-gray-600">Catatan Pembeli</Label>
                      <p className="text-sm text-gray-900">{transaction.buyer_notes}</p>
                    </div>
                  )}
                  {transaction.seller_notes && (
                    <div>
                      <Label className="text-sm text-gray-600">Catatan Penjual</Label>
                      <p className="text-sm text-gray-900">{transaction.seller_notes}</p>
                    </div>
                  )}
                  {transaction.gm_notes && (
                    <div>
                      <Label className="text-sm text-gray-600">Catatan GM</Label>
                      <p className="text-sm text-gray-900">{transaction.gm_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak {verificationType === 'payment' ? 'Bukti Pembayaran' : 'Bukti Pengiriman'}</DialogTitle>
            <DialogDescription>
              Harap berikan alasan penolakan untuk dokumentasi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectReason">Alasan Penolakan</Label>
              <Textarea
                id="rejectReason"
                placeholder="Masukkan alasan penolakan..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectModalOpen(false)
                  setRejectReason('')
                  setVerifyingFile(null)
                }}
              >
                Batal
              </Button>
              <Button
                onClick={() => verifyingFile && handleVerifyFile(verifyingFile, 'reject')}
                disabled={isLoading || !rejectReason.trim()}
                variant="destructive"
                className="flex items-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Tolak
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Release Funds Modal */}
      <Dialog open={releaseFundsModalOpen} onOpenChange={setReleaseFundsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Rilis Dana</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin merilis dana ke penjual? Aksi ini tidak dapat dibatalkan.
              Dana akan ditransfer ke saldo penjual dan transaksi akan ditandai sebagai selesai.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="releaseNotes">Catatan (Opsional)</Label>
              <Textarea
                id="releaseNotes"
                placeholder="Tambahkan catatan..."
                value={releaseFundsNotes}
                onChange={(e) => setReleaseFundsNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setReleaseFundsModalOpen(false)
                  setReleaseFundsNotes('')
                }}
              >
                Batal
              </Button>
              <Button
                onClick={handleReleaseFunds}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Ya, Rilis Dana
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none shadow-none">
          <DialogTitle className="sr-only">Preview File</DialogTitle>
          <DialogDescription className="sr-only">
            Preview of the uploaded file
          </DialogDescription>
          <div className="relative w-full h-full flex items-center justify-center">
            {previewImage && (
              <img
                src={previewImage}
                alt="Preview"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
            )}
            <Button
              className="absolute top-4 right-4 rounded-full bg-black/50 hover:bg-black/70 text-white"
              size="icon"
              onClick={() => setPreviewModalOpen(false)}
            >
              <XSquare className="w-6 h-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}