import React, { useState, useEffect } from 'react'
import { Head } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  FileText,
  CreditCard,
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  Eye,
  CheckSquare,
  XSquare,
  Loader2,
  RefreshCw,
  TrendingUp,
  Wifi,
  WifiOff
} from 'lucide-react'
import transactionAPI, { TransactionDetails, TransactionFile } from '@/services/transaction-api'
import transactionWebSocket, { TransactionUpdateEvent, FileVerificationEvent } from '@/services/transaction-websocket'

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

export default function GMTransactions() {
  const [gmStats, setGmStats] = useState<GMStats | null>(null)
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([])
  const [pendingFiles, setPendingFiles] = useState<TransactionFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [verifyingFile, setVerifyingFile] = useState<TransactionFile | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [realtimeUpdates, setRealtimeUpdates] = useState<string[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    loadDashboardData()
    // Setup WebSocket listeners
    setupWebSocketListeners()

    // Auto-refresh data every 30 seconds (as fallback)
    const interval = setInterval(loadDashboardData, 30000)
    return () => {
      clearInterval(interval)
      // Cleanup WebSocket listeners
      transactionWebSocket.cleanup()
    }
  }, [])

  const setupWebSocketListeners = () => {
    // Listen to transaction updates
    const unsubscribeTransaction = transactionWebSocket.onTransactionUpdate(
      (event: TransactionUpdateEvent) => {
        console.log('Transaction update received:', event)

        // Update real-time status
        setLastUpdate(new Date())
        setIsConnected(true)

        // Add to update log
        setRealtimeUpdates(prev => [
          ...prev.slice(-4), // Keep only last 5 updates
          `[${new Date().toLocaleTimeString()}] ${event.event_type}: Transaction ${event.transaction.transaction_number}`
        ])

        // Update data based on event type
        handleTransactionUpdate(event)
      },
      'gm'
    )

    // Listen to file verification updates
    const unsubscribeFile = transactionWebSocket.onFileVerificationUpdate(
      (event: FileVerificationEvent) => {
        console.log('File verification update received:', event)

        // Update real-time status
        setLastUpdate(new Date())
        setIsConnected(true)

        // Add to update log
        setRealtimeUpdates(prev => [
          ...prev.slice(-4), // Keep only last 5 updates
          `[${new Date().toLocaleTimeString()}] File ${event.action}: ${event.file.file_name}`
        ])

        // Update data based on event
        handleFileVerificationUpdate(event)
      },
      'gm'
    )

    // Set connection status checker
    const connectionChecker = setInterval(() => {
      setIsConnected(transactionWebSocket.getConnectionStatus())
    }, 5000)

    return () => {
      connectionChecker && clearInterval(connectionChecker)
    }
  }

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

  // Handle real-time transaction updates from WebSocket
  const handleTransactionUpdate = (event: TransactionUpdateEvent) => {
    // Update pending transactions if the transaction is in the list
    setPendingTransactions(prev => {
      const transactionIndex = prev.findIndex(t => t.id === event.transaction.id)

      if (transactionIndex !== -1) {
        // Update existing transaction
        const updated = [...prev]
        updated[transactionIndex] = {
          ...updated[transactionIndex],
          status: event.transaction.status,
          progress: event.transaction.progress,
          current_action: event.transaction.current_action,
        }
        return updated
      } else if (
        // Include transactions that need GM attention
        ['awaiting_payment_verification', 'awaiting_shipping_verification', 'delivered', 'disputed'].includes(event.transaction.status)
      ) {
        // Add new transaction if it needs GM attention
        return [
          ...prev,
          {
            id: event.transaction.id,
            transaction_number: event.transaction.transaction_number,
            amount: event.transaction.amount,
            currency: event.transaction.currency,
            status: event.transaction.status,
            room: {
              id: event.transaction.room_id,
              room_number: event.transaction.room.room_number,
            },
            buyer: null, // Would need to fetch this data
            seller: null, // Would need to fetch this data
            files: [],
          }
        ]
      }

      return prev.filter(t => t.id !== event.transaction.id)
    })

    // Update pending files if a file was verified
    if (event.event_type === 'payment_verified' || event.event_type === 'payment_rejected') {
      setPendingFiles(prev =>
        prev.filter(f => f.transaction_id !== event.transaction.id)
      )
    }
  }

  // Handle real-time file verification updates from WebSocket
  const handleFileVerificationUpdate = (event: FileVerificationEvent) => {
    // Update pending files list
    setPendingFiles(prev => {
      const fileIndex = prev.findIndex(f => f.id === event.file.id)

      if (fileIndex !== -1) {
        // Remove the file since it's now verified/rejected
        return prev.filter(f => f.id !== event.file.id)
      }

      return prev
    })

    // Update corresponding transaction
    setPendingTransactions(prev => {
      const transactionIndex = prev.findIndex(t => t.id === event.transaction.id)

      if (transactionIndex !== -1) {
        const updated = [...prev]
        updated[transactionIndex] = {
          ...updated[transactionIndex],
          status: event.transaction.status,
          progress: event.transaction.progress,
          current_action: event.transaction.current_action,
        }
        return updated
      }

      return prev
    })
  }

  const getStatusIcon = (status: string) => {
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
        return <Loader2 className="w-4 h-4" />
    }
  }

  const getStatusBadge = (status: string) => {
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
        {getStatusIcon(status)}
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
      <Head title="Transaction Management - GM Dashboard" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Transaction Management</h1>
              <p className="text-gray-600 mt-2">Verify files and manage escrow transactions</p>
            </div>
            {/* Connection Status and Real-time Updates */}
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <>
                    <Wifi className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-green-600 font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-red-500" />
                    <span className="text-sm text-red-600 font-medium">Disconnected</span>
                  </>
                )}
              </div>
              {/* Real-time Updates Log */}
              {realtimeUpdates.length > 0 && (
                <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
                  <p className="text-xs font-medium text-gray-600 mb-1">Recent Updates</p>
                  <div className="space-y-1">
                    {realtimeUpdates.map((update, index) => (
                      <p key={index} className="text-xs text-gray-700 truncate">
                        {update}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

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

        {/* File Verification Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>File Verification</span>
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
                  <div key={file.id} className="border rounded-lg p-4 hover:bg-gray-50">
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
                          onClick={() => {
                            setVerifyingFile(file)
                            setRejectModalOpen(true)
                          }}
                          disabled={isLoading}
                        >
                          <XSquare className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleFileVerification(file, 'approve')}
                          disabled={isLoading}
                        >
                          <CheckSquare className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
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
                          {getStatusBadge(transaction.status)}
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
      </div>

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