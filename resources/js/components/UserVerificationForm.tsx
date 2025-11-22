import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Upload,
  UserCheck,
  FileText,
  Camera,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

interface UserVerificationFormProps {
  userId?: number
  onVerificationSubmitted?: () => void
}

export function UserVerificationForm({ userId, onVerificationSubmitted }: UserVerificationFormProps) {
  const [formData, setFormData] = useState({
    id_card_number: '',
    id_card_image: null as File | null,
    selfie_image: null as File | null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleFileChange = (field: 'id_card_image' | 'selfie_image', file: File | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: file
    }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!formData.id_card_number.trim()) {
      setError('ID card number is required')
      return
    }

    if (!formData.id_card_image || !formData.selfie_image) {
      setError('Both ID card and selfie images are required')
      return
    }

    // File size validation (max 2MB)
    if (formData.id_card_image.size > 2 * 1024 * 1024 || formData.selfie_image.size > 2 * 1024 * 1024) {
      setError('Image files must be less than 2MB')
      return
    }

    // File type validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(formData.id_card_image.type) || !allowedTypes.includes(formData.selfie_image.type)) {
      setError('Only JPEG and PNG images are allowed')
      return
    }

    setLoading(true)

    try {
      const formPayload = new FormData()
      formPayload.append('id_card_number', formData.id_card_number)
      formPayload.append('id_card_image', formData.id_card_image)
      formPayload.append('selfie_image', formData.selfie_image)

      const response = await fetch('/api/verifications', {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        },
        body: formPayload
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setFormData({
          id_card_number: '',
          id_card_image: null,
          selfie_image: null,
        })
        onVerificationSubmitted?.()
      } else {
        setError(data.message || 'Failed to submit verification')
      }
    } catch (error) {
      console.error('Error submitting verification:', error)
      setError('An error occurred while submitting verification')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-green-800 mb-2">Verification Submitted!</h3>
          <p className="text-green-600 mb-4">
            Your verification request has been submitted successfully. We will review it within 24-48 hours.
          </p>
          <Button onClick={() => setSuccess(false)} variant="outline">
            Submit Another Verification
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <UserCheck className="w-5 h-5 text-purple-600" />
          <span>Identity Verification</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="id_card_number">ID Card Number</Label>
            <Input
              id="id_card_number"
              type="text"
              placeholder="Enter your ID card number"
              value={formData.id_card_number}
              onChange={(e) => setFormData(prev => ({ ...prev, id_card_number: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="id_card_image">ID Card Image</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <input
                id="id_card_image"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={(e) => handleFileChange('id_card_image', e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="id_card_image" className="cursor-pointer">
                {formData.id_card_image ? (
                  <div className="space-y-2">
                    <FileText className="w-8 h-8 text-green-600 mx-auto" />
                    <p className="text-sm text-green-600">{formData.id_card_image.name}</p>
                    <p className="text-xs text-gray-500">Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                    <p className="text-sm text-gray-600">Click to upload ID card image</p>
                    <p className="text-xs text-gray-500">JPEG, PNG (max 2MB)</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="selfie_image">Selfie Image</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <input
                id="selfie_image"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={(e) => handleFileChange('selfie_image', e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="selfie_image" className="cursor-pointer">
                {formData.selfie_image ? (
                  <div className="space-y-2">
                    <Camera className="w-8 h-8 text-green-600 mx-auto" />
                    <p className="text-sm text-green-600">{formData.selfie_image.name}</p>
                    <p className="text-xs text-gray-500">Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Camera className="w-8 h-8 text-gray-400 mx-auto" />
                    <p className="text-sm text-gray-600">Click to upload selfie image</p>
                    <p className="text-xs text-gray-500">JPEG, PNG (max 2MB)</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Submitting...' : 'Submit Verification'}
          </Button>

          <div className="text-xs text-gray-500 space-y-1">
            <p>• Make sure your ID card is clear and not blurry</p>
            <p>• Selfie should show your face clearly with good lighting</p>
            <p>• Verification typically takes 24-48 hours</p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}