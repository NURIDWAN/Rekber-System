import React, { useEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { useRoom } from '@/contexts/RoomContext'
import { useAuth } from '@/contexts/AuthContext'
import RekberProvider from '@/components/RekberProvider'
import RoomsNavbar from '@/components/RoomsNavbar'
import { encryptRoomId } from '@/lib/roomUrlUtils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Users,
  MessageCircle,
  Activity,
  Upload,
  CheckCircle,
  Clock,
  Truck,
  AlertCircle,
  Settings
} from 'lucide-react'
import JoinRoomModal from '@/components/JoinRoomModal'
import ChatInterface from '@/components/ChatInterface'
import FileUploadModal from '@/components/FileUploadModal'
import ActivityTimeline from '@/components/ActivityTimeline'
import ConnectionStatus from '@/components/ConnectionStatus'
import transactionAPI, { UploadResponse } from '@/services/transaction-api'

function RoomDetailContent({ room }: { room: any }) {
  const { currentUser, isAuthenticated } = useAuth()
  const {
    selectedRoom,
    selectRoom,
    loading,
    error,
    updateRoomState
  } = useRoom()
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadType, setUploadType] = useState<'payment' | 'receipt'>('payment')
  const [transactionId, setTransactionId] = useState<number | null>(null)
  const [transactionStatus, setTransactionStatus] = useState<string>('pending_payment')

  useEffect(() => {
    if (room) {
      selectRoom(room)
      loadTransaction(room.id)
    }
  }, [room, selectRoom])

  const handleJoinRoom = (userData: any) => {
    // API call to join room would go here
    console.log('Joining room:', userData)
    setShowJoinModal(false)
  }

  const loadTransaction = async (roomId: number) => {
    try {
      // For now, we'll use a simple approach
      // The backend will create/get the transaction when the file is uploaded
      // We'll use the room ID as a placeholder since the transaction will be linked to the room
      const tempTransactionId = roomId // Use room ID as temporary identifier

      setTransactionId(tempTransactionId)

      // Set initial status based on room state
      setTransactionStatus('pending_payment')
    } catch (error) {
      console.error('Failed to load transaction:', error)
      // Fallback: use room ID as transaction ID
      setTransactionId(roomId)
      setTransactionStatus('pending_payment')
    }
  }

  const handleFileUpload = (file: File, type: 'payment' | 'receipt') => {
    // This function is no longer used - we use the new callback interface
    console.log('Uploading file:', file, type)
    setShowUploadModal(false)
  }

  const handleUploadSuccess = (response: UploadResponse) => {
    console.log('Upload successful:', response)

    // Update transaction status if provided
    if (response.data?.transaction) {
      setTransactionStatus(response.data.transaction.status)
      // Update room state if needed
      if (selectedRoom) {
        updateRoomState({
          ...selectedRoom,
          transactionStatus: response.data.transaction.status
        })
      }
    }

    setShowUploadModal(false)
  }

  const getTransactionStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_payment':
      case 'awaiting_payment_verification':
        return <Clock className="w-4 h-4" />
      case 'paid':
      case 'awaiting_shipping_verification':
        return <CheckCircle className="w-4 h-4 text-blue-600" />
      case 'shipped':
        return <Truck className="w-4 h-4 text-blue-600" />
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-orange-600" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'disputed':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-gray-600" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getTransactionStatusColor = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return 'bg-yellow-100 text-yellow-800'
      case 'awaiting_payment_verification':
        return 'bg-orange-100 text-orange-800'
      case 'paid':
        return 'bg-blue-100 text-blue-800'
      case 'awaiting_shipping_verification':
        return 'bg-purple-100 text-purple-800'
      case 'shipped':
        return 'bg-indigo-100 text-indigo-800'
      case 'delivered':
        return 'bg-cyan-100 text-cyan-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'disputed':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading room...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Room</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Link href="/rooms">
                <Button variant="outline">Back to Rooms</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!selectedRoom) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-pulse rounded-full h-12 w-12 bg-gray-300 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Room Not Found</h2>
              <p className="text-gray-600 mb-4">The room you're looking for doesn't exist.</p>
              <Link href="/rooms">
                <Button variant="outline">Back to Rooms</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isUserInRoom = currentUser && selectedRoom.users.some(user => user.name === currentUser.name)
  const isGM = currentUser?.role === 'gm'

  return (
    <div className="min-h-screen bg-gray-50">
      <Head title={`Room ${selectedRoom.room_number} - Rekber System`} />

      <RoomsNavbar
        roomNumber={selectedRoom.room_number}
        roomStatus={selectedRoom.status}
        onLeaveRoom={() => window.location.href = '/rooms'}
        currentUser={currentUser}
        encryptedRoomId={encryptRoomId(selectedRoom.id)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Room Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Transaction Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Current Status</span>
                    <Badge
                      className={getTransactionStatusColor(transactionStatus)}
                      variant="secondary"
                    >
                      {getTransactionStatusIcon(transactionStatus)}
                      <span className="ml-1 capitalize">
                        {transactionStatus.replace('_', ' ')}
                      </span>
                    </Badge>
                  </div>

                  <Separator />

                  {/* Action buttons based on role and status */}
                  {isUserInRoom && transactionId && (
                    <div className="flex flex-wrap gap-2">
                      {currentUser?.role === 'buyer' && transactionStatus === 'pending_payment' && (
                        <Button
                          onClick={() => { setUploadType('payment'); setShowUploadModal(true) }}
                          className="flex-1"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Payment Proof
                        </Button>
                      )}

                      {currentUser?.role === 'seller' && transactionStatus === 'paid' && (
                        <Button
                          onClick={() => { setUploadType('receipt'); setShowUploadModal(true) }}
                          className="flex-1"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Shipping Receipt
                        </Button>
                      )}

                      {currentUser?.role === 'buyer' && transactionStatus === 'shipped' && (
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={async () => {
                            if (!transactionId) return
                            try {
                              const response = await transactionAPI.markAsDelivered(transactionId)
                              if (response.success) {
                                handleUploadSuccess(response)
                              }
                            } catch (error) {
                              console.error('Failed to confirm delivery:', error)
                            }
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Confirm Receipt
                        </Button>
                      )}
                    </div>
                  )}

                  {!isUserInRoom && selectedRoom.status === 'free' && !isGM && (
                    <Button
                      onClick={() => setShowJoinModal(true)}
                      className="w-full"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Join Room as Buyer
                    </Button>
                  )}

                  {!isUserInRoom && selectedRoom.status === 'in_use' && !isGM && (
                    <Button
                      onClick={() => setShowJoinModal(true)}
                      className="w-full"
                      variant="outline"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Join Room as Seller
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chat Interface */}
            <Card className="h-96">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80 p-0">
                <ChatInterface roomId={selectedRoom.id} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participants */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Participants ({selectedRoom.onlineUsers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedRoom.onlineUsers.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No participants online
                    </p>
                  ) : (
                    selectedRoom.onlineUsers.map((user) => (
                      <div key={user.id} className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src="" />
                          <AvatarFallback>
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {user.role}
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityTimeline activities={selectedRoom.activities.slice(-5)} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showJoinModal && (
        <JoinRoomModal
          roomId={selectedRoom.id}
          roomStatus={selectedRoom.status}
          onClose={() => setShowJoinModal(false)}
          onSubmit={handleJoinRoom}
        />
      )}

      {showUploadModal && transactionId && (
        <FileUploadModal
          type={uploadType}
          transactionId={transactionId}
          roomId={selectedRoom?.id}
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  )
}

export default function RoomDetail({ room }: { room: any }) {
  return (
    <RekberProvider>
      <RoomDetailContent room={room} />
    </RekberProvider>
  )
}