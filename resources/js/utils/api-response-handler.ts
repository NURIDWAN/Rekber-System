import { showUnauthorizedNotification, showAuthErrorNotification, showNetworkErrorNotification, showSuccessNotification, showErrorNotification } from './notifications'
import { router } from '@inertiajs/react'

export interface ApiResponse {
  success?: boolean
  message?: string
  error?: string
  errors?: Record<string, string[]>
  data?: any
}

export const handleApiResponse = (
  response: ApiResponse,
  options?: {
    successMessage?: string
    showSuccessOnSuccess?: boolean
    showErrorOnError?: boolean
    redirectTo?: string
    onSuccess?: () => void
    onError?: () => void
  }
): ApiResponse => {
  const {
    successMessage,
    showSuccessOnSuccess = true,
    showErrorOnError = true,
    redirectTo,
    onSuccess,
    onError
  } = options || {}

  if (response.success) {
    if (showSuccessOnSuccess) {
      showSuccessNotification(successMessage || response.message || 'Operasi berhasil')
    }
    onSuccess?.()

    if (redirectTo) {
      router.visit(redirectTo)
    }
  } else {
    if (showErrorOnError) {
      showErrorNotification(response.error || response.message || 'Terjadi kesalahan')
    }
    onError?.()
  }

  return response
}

export const handleApiError = (error: any): never => {
  console.error('API Error:', error)

  // Handle network errors
  if (!error.response) {
    showNetworkErrorNotification()
    throw error
  }

  const { status, data } = error.response

  // Handle authentication errors
  if (status === 401) {
    showAuthErrorNotification(data?.error || data?.message || 'Sesi Anda telah berakhir')
    // Redirect to login page after a delay
    setTimeout(() => {
      router.visit('/login')
    }, 2000)
    throw error
  }

  // Handle authorization errors
  if (status === 403) {
    showUnauthorizedNotification(data?.error || data?.message || 'Anda tidak memiliki akses')
    throw error
  }

  // Handle validation errors (422)
  if (status === 422) {
    if (data?.errors) {
      const errorMessages = Object.values(data.errors).flat()
      const errorMessage = errorMessages[0] || 'Data yang dimasukkan tidak valid'
      showErrorNotification(errorMessage, { title: 'Validasi Gagal' })
      throw error
    } else if (data?.error || data?.message) {
      const errorMessage = data?.error || data?.message
      showErrorNotification(errorMessage, { title: 'Kesalahan Validasi' })
      throw error
    }
  }

  // Handle bad request errors (400)
  if (status === 400) {
    const errorMessage = data?.error || data?.message || error.message || 'Permintaan tidak valid'
    console.group('❌ 400 Bad Request Error')
    console.log('📊 Status:', status)
    console.log('📦 Data:', data)
    console.log('🔥 Error:', error)
    console.log('💬 Message:', errorMessage)
    console.groupEnd()

    // Try to show notification with fallback
    try {
      showErrorNotification(errorMessage, { title: 'Permintaan Gagal' })
    } catch (notifError) {
      console.error('Failed to show notification:', notifError)
      alert(errorMessage) // Fallback to alert if toast fails
    }
    throw error
  }

  // Handle server errors
  if (status >= 500) {
    showErrorNotification('Terjadi kesalahan pada server. Silakan coba lagi nanti.', {
      title: 'Kesalahan Server'
    })
    throw error
  }

  // Handle other client errors (404, 409, etc.)
  if (status >= 400 && status < 500) {
    const errorMessage = data?.error || data?.message || error.message || 'Terjadi kesalahan'
    showErrorNotification(errorMessage, { title: 'Kesalahan' })
    throw error
  }

  // Handle other errors
  const errorMessage = data?.error || data?.message || error.message || 'Terjadi kesalahan'
  showErrorNotification(errorMessage)
  throw error
}

// Specific handlers for different types of API responses
export const handleTransactionResponse = (response: ApiResponse, operation: string) => {
  return handleApiResponse(response, {
    successMessage: `${operation} berhasil`,
    showErrorOnError: true
  })
}

export const handleFileUploadResponse = (response: ApiResponse, fileName: string) => {
  return handleApiResponse(response, {
    successMessage: `File "${fileName}" berhasil diunggah`,
    showErrorOnError: true
  })
}

export const handleVerificationResponse = (response: ApiResponse, type: 'payment' | 'shipping', action: 'approve' | 'reject') => {
  const actionText = action === 'approve' ? 'disetujui' : 'ditolak'
  const typeText = type === 'payment' ? 'pembayaran' : 'pengiriman'

  return handleApiResponse(response, {
    successMessage: `Bukti ${typeText} berhasil ${actionText}`,
    showErrorOnError: true
  })
}

export const handleAuthResponse = (response: ApiResponse, operation: string) => {
  return handleApiResponse(response, {
    successMessage: `${operation} berhasil`,
    showErrorOnError: true
  })
}