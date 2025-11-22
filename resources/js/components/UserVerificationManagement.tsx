import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  UserCheck,
  UserX,
  Clock,
  FileText,
  Image,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye
} from 'lucide-react'

interface UserVerification {
  id: number
  user_id: number
  id_card_number: string
  id_card_image: string
  selfie_image: string
  status: 'pending' | 'verified' | 'rejected'
  rejection_reason?: string
  verified_at?: string
  created_at: string
  updated_at: string
  user: {
    id: number
    name: string
    email: string
  }
}

interface VerificationStats {
  total: number
  pending: number
  verified: number
  rejected: number
}

export function UserVerificationManagement() {
  const [verifications, setVerifications] = useState<UserVerification[]>([])
  const [stats, setStats] = useState<VerificationStats>({
    total: 0,
    pending: 0,
    verified: 0,
    rejected: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedVerification, setSelectedVerification] = useState<UserVerification | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    fetchVerifications()
    fetchStats()
  }, [statusFilter])

  const fetchVerifications = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/verifications?${params}`)
      const data = await response.json()

      // Filter by search term if provided
      let filteredVerifications = data.data || []
      if (searchTerm) {
        filteredVerifications = filteredVerifications.filter((v: UserVerification) =>
          v.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.id_card_number.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      setVerifications(filteredVerifications)
    } catch (error) {
      console.error('Error fetching verifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/verifications/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleApprove = async (verification: UserVerification) => {
    if (!confirm('Are you sure you want to approve this verification?')) return

    try {
      const response = await fetch(`/api/verifications/${verification.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        }
      })

      if (response.ok) {
        await fetchVerifications()
        await fetchStats()
        alert('Verification approved successfully!')
      } else {
        alert('Failed to approve verification')
      }
    } catch (error) {
      console.error('Error approving verification:', error)
      alert('Error approving verification')
    }
  }

  const handleReject = async () => {
    if (!selectedVerification || !rejectReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }

    try {
      const response = await fetch(`/api/verifications/${selectedVerification.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        },
        body: JSON.stringify({ reason: rejectReason })
      })

      if (response.ok) {
        await fetchVerifications()
        await fetchStats()
        setRejectDialogOpen(false)
        setRejectReason('')
        setSelectedVerification(null)
        alert('Verification rejected successfully!')
      } else {
        alert('Failed to reject verification')
      }
    } catch (error) {
      console.error('Error rejecting verification:', error)
      alert('Error rejecting verification')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
      case 'verified':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Verified</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const openImageDialog = (imageUrl: string, title: string) => {
    setSelectedImage({ url: imageUrl, title })
    setImageDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <UserCheck className="w-8 h-8 text-purple-600" />
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">User Verification Management</h2>
          <p className="text-sm text-gray-500">Manage user identity verification requests</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Verified</p>
                <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Search by name, email, or ID card number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchVerifications} disabled={loading}>
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : verifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No verification requests found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4">User</th>
                    <th className="text-left p-4">ID Card Number</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Submitted</th>
                    <th className="text-left p-4">Documents</th>
                    <th className="text-left p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.map((verification) => (
                    <tr key={verification.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{verification.user.name}</div>
                          <div className="text-sm text-gray-500">{verification.user.email}</div>
                        </div>
                      </td>
                      <td className="p-4">{verification.id_card_number}</td>
                      <td className="p-4">{getStatusBadge(verification.status)}</td>
                      <td className="p-4">
                        <div className="text-sm">
                          {new Date(verification.created_at).toLocaleDateString()}
                        </div>
                        {verification.verified_at && (
                          <div className="text-xs text-gray-500">
                            Verified: {new Date(verification.verified_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openImageDialog(`/storage/${verification.id_card_image}`, 'ID Card')}
                          >
                            <Image className="w-4 h-4 mr-1" />
                            ID Card
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openImageDialog(`/storage/${verification.selfie_image}`, 'Selfie')}
                          >
                            <Image className="w-4 h-4 mr-1" />
                            Selfie
                          </Button>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex space-x-2">
                          {verification.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(verification)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setSelectedVerification(verification)
                                  setRejectDialogOpen(true)
                                }}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {verification.status === 'rejected' && verification.rejection_reason && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedVerification(verification)
                                setRejectReason(verification.rejection_reason || '')
                                setRejectDialogOpen(true)
                              }}
                            >
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              View Reason
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-reason">Rejection Reason</Label>
              <Textarea
                id="reject-reason"
                placeholder="Please provide a reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                disabled={selectedVerification?.status === 'rejected'}
              />
            </div>
            <div className="flex space-x-2">
              {selectedVerification?.status === 'pending' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={!rejectReason.trim()}
                  >
                    Reject
                  </Button>
                  <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                    Cancel
                  </Button>
                </>
              )}
              {selectedVerification?.status === 'rejected' && (
                <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                  Close
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {selectedImage && (
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="max-w-full max-h-96 object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}