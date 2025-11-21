import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { User, Phone, Shield, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface JoinRoomModalProps {
  roomId: number
  roomStatus: 'free' | 'in_use'
  onClose: () => void
  onSubmit: (userData: any) => void
}

export default function JoinRoomModal({
  roomId,
  roomStatus,
  onClose,
  onSubmit
}: JoinRoomModalProps) {
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: roomStatus === 'free' ? 'buyer' : ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else if (!/^\d{10,15}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number'
    }

    if (roomStatus === 'in_use' && !formData.role) {
      newErrors.role = 'Please select your role'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      const userData = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        role: formData.role || 'buyer',
        roomId,
        sessionToken: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      // Log the user in
      login(userData)

      // Submit the form
      onSubmit(userData)

      onClose()
    } catch (error) {
      console.error('Error joining room:', error)
      setErrors({ submit: 'Failed to join room. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const getRoleInfo = () => {
    if (roomStatus === 'free') {
      return {
        title: 'Start Transaction',
        description: 'You will be the buyer in this transaction',
        role: 'buyer',
        badge: 'Buyer',
        badgeColor: 'bg-blue-100 text-blue-800'
      }
    } else {
      return {
        title: 'Join Transaction',
        description: 'Join as the seller for this ongoing transaction',
        role: '',
        badge: 'Seller',
        badgeColor: 'bg-green-100 text-green-800'
      }
    }
  }

  const roleInfo = getRoleInfo()

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <User className="w-5 h-5 mr-2" />
            {roleInfo.title}
          </DialogTitle>
          <DialogDescription>
            Room #{roomId} • {roleInfo.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Room Status Badge */}
          <div className="flex items-center justify-center py-3">
            <Badge
              className={roomStatus === 'free'
                ? 'bg-green-100 text-green-800'
                : 'bg-orange-100 text-orange-800'
              }
              variant="secondary"
            >
              Room is {roomStatus === 'free' ? 'Available' : 'In Use'}
            </Badge>
          </div>

          <Separator />

          {/* Your Role */}
          <div className="text-center">
            <Label className="text-sm font-medium text-gray-700">Your Role</Label>
            <div className="mt-1">
              <Badge className={roleInfo.badgeColor} variant="secondary">
                {roleInfo.badge}
              </Badge>
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="pl-10"
                disabled={isSubmitting}
              />
            </div>
            {errors.name && (
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Phone Input */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                placeholder="Enter your phone number"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="pl-10"
                disabled={isSubmitting}
              />
            </div>
            {errors.phone && (
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.phone}
              </p>
            )}
          </div>

          {/* Role Selection (only for in_use rooms) */}
          {roomStatus === 'in_use' && (
            <div className="space-y-2">
              <Label htmlFor="role">Select Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleInputChange('role', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Seller</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.role}
                </p>
              )}
            </div>
          )}

          {/* Security Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start">
              <Shield className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">Session Information</p>
                <p>
                  Your session will be created when you join this room.
                  No registration required - just enter your details to start.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.submit}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <User className="w-4 h-4 mr-2" />
                  Join Room
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}