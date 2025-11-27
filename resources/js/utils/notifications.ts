import { toast } from '@/hooks/use-toast'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface NotificationOptions {
  title?: string
  description?: string
  duration?: number
}

export const showNotification = (
  type: NotificationType,
  description: string,
  options?: Omit<NotificationOptions, 'description'>
) => {
  const variant = type === 'error' ? 'destructive' : type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'default'

  toast({
    variant,
    title: options?.title || getDefaultTitle(type),
    description,
    duration: options?.duration
  })
}

const getDefaultTitle = (type: NotificationType): string => {
  switch (type) {
    case 'success':
      return 'Berhasil'
    case 'error':
      return 'Terjadi Kesalahan'
    case 'warning':
      return 'Peringatan'
    case 'info':
      return 'Informasi'
    default:
      return ''
  }
}

export const showSuccessNotification = (description: string, options?: NotificationOptions) => {
  showNotification('success', description, options)
}

export const showErrorNotification = (description: string, options?: NotificationOptions) => {
  showNotification('error', description, options)
}

export const showWarningNotification = (description: string, options?: NotificationOptions) => {
  showNotification('warning', description, options)
}

export const showInfoNotification = (description: string, options?: NotificationOptions) => {
  showNotification('info', description, options)
}

// Specific notification types for the application
export const showUnauthorizedNotification = (message = 'Anda tidak memiliki akses ke halaman ini') => {
  showErrorNotification(message, { title: 'Akses Ditolak' })
}

export const showAuthErrorNotification = (message = 'Terjadi kesalahan autentikasi') => {
  showErrorNotification(message, { title: 'Autentikasi Gagal' })
}

export const showNetworkErrorNotification = (message = 'Terjadi kesalahan jaringan. Silakan coba lagi.') => {
  showErrorNotification(message, { title: 'Kesalahan Jaringan' })
}

export const showVerificationSuccessNotification = (type: 'payment' | 'shipping') => {
  showSuccessNotification(
    `Bukti ${type === 'payment' ? 'pembayaran' : 'pengiriman'} berhasil diverifikasi`,
    { title: 'Verifikasi Berhasil' }
  )
}

export const showVerificationRejectedNotification = (type: 'payment' | 'shipping', reason?: string) => {
  showErrorNotification(
    `Bukti ${type === 'payment' ? 'pembayaran' : 'pengiriman'} ditolak${reason ? ': ' + reason : ''}`,
    { title: 'Verifikasi Ditolak' }
  )
}

export const showFileUploadSuccessNotification = (fileName: string) => {
  showSuccessNotification(`File "${fileName}" berhasil diunggah`, { title: 'Upload Berhasil' })
}

export const showFileUploadErrorNotification = (fileName?: string) => {
  showErrorNotification(
    fileName ? `Gagal mengunggah file "${fileName}"` : 'Gagal mengunggah file',
    { title: 'Upload Gagal' }
  )
}