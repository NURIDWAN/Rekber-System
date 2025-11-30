import { useState } from 'react'
import { Head, Link, router } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AppLayout from '@/layouts/app-layout'
import { getRoomUrl } from '@/lib/roomUrlUtils'
import { ShareUrlModal } from '@/components/ShareUrlModal'
import { cn } from '@/lib/utils'
import {
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Share,
  Search,
  RefreshCw,
  Filter,
  Users,
  Activity,
  LogIn,
  Trash2
} from 'lucide-react'
import { Room } from '@/types'

interface RoomManagementProps {
  rooms: Room[]
  stats: {
    totalRooms: number
    free_rooms: number
    in_use_rooms: number
    active_users: number
  }
}

const breadcrumbs = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Room Management', href: '/gm/rooms' }
]

export default function RoomManagement({ rooms, stats }: RoomManagementProps) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareModalRoom, setShareModalRoom] = useState<Room | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredRooms = rooms.filter(room =>
    room.room_number.toString().includes(searchQuery) ||
    room.buyer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.seller?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Room Management - Rekber System" />

      <div className="min-h-screen bg-slate-50/50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Room Management</h1>
              <p className="text-slate-500">Monitor and manage all active transaction rooms.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Rooms</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalRooms || rooms.length}</p>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-lg">
                    <Package className="w-5 h-5 text-slate-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Active Rooms</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.in_use_rooms}</p>
                  </div>
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Available</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.free_rooms}</p>
                  </div>
                  <div className="p-3 bg-emerald-100 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Active Users</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.active_users}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-medium">All Rooms</CardTitle>
                  <CardDescription>View and manage room details</CardDescription>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search rooms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-slate-300 pl-8 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredRooms.map((room) => (
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
                          className="flex-1 h-8 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.post(`/gm/rooms/${room.id}/join`)
                          }}
                        >
                          <LogIn className="w-3.5 h-3.5 mr-1.5" />
                          Join
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Reset Room"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Are you sure you want to reset this room? This will clear all sessions, messages, and transactions.')) {
                              router.post(`/gm/rooms/${room.id}/reset`)
                            }
                          }}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
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
              {filteredRooms.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>No rooms found matching your search.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
    </AppLayout>
  )
}