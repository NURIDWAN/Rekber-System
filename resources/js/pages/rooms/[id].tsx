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

  useEffect(() => {
    if (room) {
      selectRoom(room)
    }
  }, [room, selectRoom])

  const handleJoinRoom = (userData: any) => {
    // API call to join room would go here
    console.log('Joining room:', userData)
    setShowJoinModal(false)
  }

  const handleFileUpload = (file: File, type: 'payment' | 'receipt') => {
    // API call for file upload would go here
    console.log('Uploading file:', file, type)
    setShowUploadModal(false)
  }

  const getTransactionStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting_payment':
        return <Clock className="w-4 h-4" />
      case 'payment_verified':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'shipping':
        return <Truck className="w-4 h-4 text-blue-600" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'disputed':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getTransactionStatusColor = (status: string) => {
    switch (status) {
      case 'waiting_payment':
        return 'bg-yellow-100 text-yellow-800'
      case 'payment_verified':
        return 'bg-green-100 text-green-800'
      case 'shipping':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'disputed':
        return 'bg-red-100 text-red-800'
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
                      className={getTransactionStatusColor(selectedRoom.transactionStatus)}
                      variant="secondary"
                    >
                      {getTransactionStatusIcon(selectedRoom.transactionStatus)}
                      <span className="ml-1 capitalize">
                        {selectedRoom.transactionStatus.replace('_', ' ')}
                      </span>
                    </Badge>
                  </div>

                  <Separator />

                  {/* Action buttons based on role and status */}
                  {isUserInRoom && (
                    <div className="flex flex-wrap gap-2">
                      {currentUser?.role === 'buyer' && selectedRoom.transactionStatus === 'waiting_payment' && (
                        <Button
                          onClick={() => { setUploadType('payment'); setShowUploadModal(true) }}
                          className="flex-1"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Payment Proof
                        </Button>
                      )}

                      {currentUser?.role === 'seller' && selectedRoom.transactionStatus === 'payment_verified' && (
                        <Button
                          onClick={() => { setUploadType('receipt'); setShowUploadModal(true) }}
                          className="flex-1"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Shipping Receipt
                        </Button>
                      )}

                      {currentUser?.role === 'buyer' && selectedRoom.transactionStatus === 'shipping' && (
                        <Button variant="outline" className="flex-1">
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

      {showUploadModal && (
        <FileUploadModal
          type={uploadType}
          onClose={() => setShowUploadModal(false)}
          onSubmit={(file) => handleFileUpload(file, uploadType)}
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