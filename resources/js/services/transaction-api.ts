import axios from 'axios'

// API base URL
const API_BASE = '/api'

// Transaction API endpoints
export interface UploadResponse {
  success: boolean
  message: string
  data?: {
    file?: {
      id: number
      file_url: string
      file_name: string
      file_size: string
      mime_type: string
      status: string
      verified_at?: string
      rejection_reason?: string
    }
    transaction?: {
      status: string
      progress: number
      current_action?: any
      payment_rejection_reason?: string
      shipping_rejection_reason?: string
    }
  }
}

export interface TransactionDetails {
  id: number
  transaction_number: string
  room_id: number
  buyer_id?: number
  seller_id?: number
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
  // MVP fields
  payment_verified_by?: number
  payment_verified_at?: string
  payment_rejection_reason?: string
  shipping_verified_by?: number
  shipping_verified_at?: string
  shipping_rejection_reason?: string
  funds_released_by?: number
  funds_released_at?: string
  payment_proof_uploaded_at?: string
  payment_proof_uploaded_by?: number
  shipping_receipt_uploaded_at?: string
  shipping_receipt_uploaded_by?: number
  // Timestamps
  paid_at?: string
  shipped_at?: string
  delivered_at?: string
  completed_at?: string
  cancelled_at?: string
  created_at: string
  updated_at: string
  // Relationships
  room?: {
    id: number
    room_number: string
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
  files?: TransactionFile[]
  paymentVerifier?: any
  shippingVerifier?: any
  fundsReleaser?: any
}

export interface TransactionFile {
  id: number
  room_id: number
  transaction_id: number
  file_type: 'payment_proof' | 'shipping_receipt'
  file_path: string
  file_name: string
  file_size: number
  mime_type: string
  uploaded_by: 'buyer' | 'seller'
  verified_by?: number
  rejection_reason?: string
  status: 'pending' | 'verified' | 'rejected'
  verified_at?: string
  created_at: string
  updated_at: string
  // Appended attributes
  file_url?: string
  file_size_formatted?: string
  // Relationships
  verifier?: any
}

class TransactionAPI {
  /**
   * Upload payment proof for a transaction
   */
  async uploadPaymentProof(transactionId: number, file: File): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post(
        `${API_BASE}/transactions/${transactionId}/upload-payment-proof`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
          }
        }
      )
      return response.data
    } catch (error: any) {
      console.error('Payment proof upload failed:', error)
      throw error.response?.data || { success: false, message: 'Upload failed' }
    }
  }

  /**
   * Upload shipping receipt for a transaction
   */
  async uploadShippingReceipt(transactionId: number, file: File): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post(
        `${API_BASE}/transactions/${transactionId}/upload-shipping-receipt`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
          }
        }
      )
      return response.data
    } catch (error: any) {
      console.error('Shipping receipt upload failed:', error)
      throw error.response?.data || { success: false, message: 'Upload failed' }
    }
  }

  /**
   * Get transaction by room ID
   */
  async getTransactionByRoomId(roomId: number): Promise<{ success: boolean; data: TransactionDetails }> {
    try {
      const response = await axios.get(`${API_BASE}/transactions/by-room/${roomId}`)
      return response.data
    } catch (error: any) {
      console.error('Get transaction by room ID failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to get transaction by room ID' }
    }
  }

  /**
   * Get transaction details
   */
  async getTransactionDetails(transactionId: number): Promise<{ success: boolean; data: TransactionDetails }> {
    try {
      const response = await axios.get(`${API_BASE}/transactions/${transactionId}`)
      return response.data
    } catch (error: any) {
      console.error('Get transaction details failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to get transaction details' }
    }
  }

  /**
   * Get transaction files
   */
  async getTransactionFiles(transactionId: number): Promise<{ success: boolean; data: TransactionFile[] }> {
    try {
      const response = await axios.get(`${API_BASE}/transactions/${transactionId}/files`)
      return response.data
    } catch (error: any) {
      console.error('Get transaction files failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to get transaction files' }
    }
  }

  /**
   * Mark transaction as delivered (buyer action)
   */
  async markAsDelivered(transactionId: number): Promise<UploadResponse> {
    try {
      const response = await axios.post(`${API_BASE}/transactions/${transactionId}/mark-delivered`, {}, {
        headers: {
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Mark as delivered failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to confirm delivery' }
    }
  }

  /**
   * Create dispute for transaction
   */
  async createDispute(transactionId: number, reason: string, description?: string): Promise<UploadResponse> {
    try {
      const response = await axios.post(`${API_BASE}/transactions/${transactionId}/dispute`, {
        reason,
        description
      }, {
        headers: {
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Create dispute failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to create dispute' }
    }
  }

  /**
   * Delete transaction file (if pending)
   */
  async deleteFile(fileId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.delete(`${API_BASE}/transactions/files/${fileId}`, {
        headers: {
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Delete file failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to delete file' }
    }
  }

  // GM-specific methods

  /**
   * Get pending transactions for GM
   */
  async getPendingTransactions(status?: string, limit: number = 20): Promise<{ success: boolean; data: any }> {
    try {
      const params = new URLSearchParams()
      if (status && status !== 'all') params.append('status', status)
      params.append('limit', limit.toString())

      const response = await axios.get(`${API_BASE}/gm/pending-transactions?${params}`)
      return response.data
    } catch (error: any) {
      console.error('Get pending transactions failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to get pending transactions' }
    }
  }

  /**
   * Get pending files for GM verification
   */
  async getPendingFiles(fileType?: string, limit: number = 20): Promise<{ success: boolean; data: any }> {
    try {
      const params = new URLSearchParams()
      if (fileType && fileType !== 'all') params.append('file_type', fileType)
      params.append('limit', limit.toString())

      const response = await axios.get(`${API_BASE}/gm/pending-files?${params}`)
      return response.data
    } catch (error: any) {
      console.error('Get pending files failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to get pending files' }
    }
  }

  /**
   * Get transaction details for GM
   */
  async getGMTransactionDetails(transactionId: number): Promise<{ success: boolean; data: TransactionDetails }> {
    try {
      const response = await axios.get(`${API_BASE}/gm/transactions/${transactionId}`)
      return response.data
    } catch (error: any) {
      console.error('Get GM transaction details failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to get transaction details' }
    }
  }

  /**
   * Get file details for GM verification
   */
  async getGMFileDetails(fileId: number): Promise<{ success: boolean; data: TransactionFile }> {
    try {
      const response = await axios.get(`${API_BASE}/gm/files/${fileId}`)
      return response.data
    } catch (error: any) {
      console.error('Get GM file details failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to get file details' }
    }
  }

  /**
   * Verify payment proof (GM action)
   */
  async verifyPaymentProof(fileId: number, action: 'approve' | 'reject', reason?: string): Promise<UploadResponse> {
    try {
      const response = await axios.post(`${API_BASE}/gm/files/${fileId}/verify-payment`, {
        action,
        reason: action === 'reject' ? reason : undefined
      }, {
        headers: {
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Verify payment proof failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to verify payment proof' }
    }
  }

  /**
   * Verify shipping receipt (GM action)
   */
  async verifyShippingReceipt(fileId: number, action: 'approve' | 'reject', reason?: string): Promise<UploadResponse> {
    try {
      const response = await axios.post(`${API_BASE}/gm/files/${fileId}/verify-shipping`, {
        action,
        reason: action === 'reject' ? reason : undefined
      }, {
        headers: {
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Verify shipping receipt failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to verify shipping receipt' }
    }
  }

  /**
   * Release funds (GM action)
   */
  async releaseFunds(transactionId: number, notes?: string): Promise<UploadResponse> {
    try {
      const response = await axios.post(`${API_BASE}/gm/transactions/${transactionId}/release-funds`, {
        notes
      }, {
        headers: {
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Release funds failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to release funds' }
    }
  }

  /**
   * Update GM notes for transaction
   */
  async updateNotes(transactionId: number, notes: string): Promise<UploadResponse> {
    try {
      const response = await axios.put(`${API_BASE}/gm/transactions/${transactionId}/notes`, {
        notes
      }, {
        headers: {
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Update notes failed:', error)
      throw error.response?.data || { success: false, message: 'Failed to update notes' }
    }
  }
}

export const transactionAPI = new TransactionAPI()
export default transactionAPI