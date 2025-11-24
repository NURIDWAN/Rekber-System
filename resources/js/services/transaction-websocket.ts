// Transaction WebSocket Service
// Handles real-time transaction updates

interface TransactionUpdateEvent {
  event_type: string
  transaction: {
    id: number
    transaction_number: string
    status: string
    amount: number
    currency: string
    room_id: number
    buyer_id?: number
    seller_id?: number
    payment_verified_at?: string
    shipping_verified_at?: string
    funds_released_at?: string
    completed_at?: string
    progress: number
    current_action?: {
      text: string
      required_by: string
      next_status: string
    }
  }
  room: {
    id: number
    room_number: number
    status: string
  }
  data: {
    user_name?: string
    user_role?: string
    gm_name?: string
    file_id?: number
    reason?: string
    description?: string
    rejection_reason?: string
  }
  timestamp: string
}

interface FileVerificationEvent {
  action: 'approve' | 'reject'
  file: {
    id: number
    file_type: 'payment_proof' | 'shipping_receipt'
    file_name: string
    status: 'pending' | 'verified' | 'rejected'
    verified_at?: string
    rejection_reason?: string
    uploaded_by: 'buyer' | 'seller'
    file_url: string
  }
  transaction: {
    id: number
    transaction_number: string
    status: string
    progress: number
    current_action?: {
      text: string
      required_by: string
      next_status: string
    }
  }
  room: {
    id: number
    room_number: number
  }
  reason?: string
  timestamp: string
}

type TransactionEventHandler = (event: TransactionUpdateEvent) => void
type FileVerificationEventHandler = (event: FileVerificationEvent) => void

class TransactionWebSocketService {
  private listeners: Map<string, Set<TransactionEventHandler>> = new Map()
  private fileListeners: Map<string, Set<FileVerificationEventHandler>> = new Map()
  private socket: WebSocket | null = null
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 1000
  private pollingInterval: NodeJS.Timeout | null = null
  private isPolling: boolean = false
  private roomId: number | null = null
  private role: string | null = null

  constructor() {
    // Do not auto-start connection
  }

  public setContext(roomId: number, role: string) {
    this.roomId = roomId;
    this.role = role;
  }

  public start() {
    if (this.isPolling) return;
    this.initializeConnection();
  }

  public stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
  }

  private initializeConnection() {
    try {
      // WebSocket server not available, use polling fallback immediately
      console.log('WebSocket server not available, using polling fallback')
      this.startPolling()
      return
    } catch (error) {
      console.error('Failed to initialize Transaction WebSocket:', error)
      this.startPolling()
    }
  }

  private startPolling() {
    if (this.isPolling) return

    this.isPolling = true
    console.log('Starting polling fallback for transaction updates')

    // Initial check
    this.checkForUpdates()

    // Poll every 10 seconds
    this.pollingInterval = setInterval(() => {
      this.checkForUpdates()
    }, 10000)
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
    this.isPolling = false
  }

  private async checkForUpdates() {
    try {
      let transactions: any[] = [];
      let files: any[] = [];

      console.log(`[TransactionWebSocket] Checking updates for role: ${this.role}, roomId: ${this.roomId}`);

      if (this.role === 'gm') {
        // GM Mode: Poll GM endpoints
        const [transactionsResponse, filesResponse] = await Promise.all([
          fetch('/api/gm/pending-transactions'),
          fetch('/api/gm/pending-files')
        ]);

        if (transactionsResponse.ok) {
          const data = await transactionsResponse.json();
          transactions = data.data ? data.data.data : [];
        }

        if (filesResponse.ok) {
          const data = await filesResponse.json();
          files = data.data ? data.data.data : [];
        }
      } else if (this.roomId) {
        // Room Mode: Poll room endpoint
        const response = await fetch(`/api/rooms/${this.roomId}/polling-data`);
        if (response.ok) {
          const data = await response.json();
          console.log(`[TransactionWebSocket] Room polling data:`, data);
          if (data.success && data.data) {
            transactions = data.data.transactions || [];
            files = data.data.files || [];
            console.log(`[TransactionWebSocket] Parsed ${transactions.length} transactions, ${files.length} files`);
          }
        } else {
          console.warn(`[TransactionWebSocket] Room polling failed: ${response.status}`);
        }
      } else {
        // No context, do nothing
        return;
      }

      // Emit events for updated transactions
      if (Array.isArray(transactions)) {
        transactions.forEach((transaction: any) => {
          console.log(`[TransactionWebSocket] Processing transaction update:`, transaction);
          this.handleTransactionUpdate({
            event_type: 'transaction.status_updated',
            transaction: {
              id: transaction.id,
              transaction_number: transaction.transaction_number,
              status: transaction.status,
              amount: transaction.amount,
              currency: transaction.currency,
              room_id: transaction.room_id,
              progress: transaction.progress || 0,
              current_action: transaction.current_action
            },
            room: {
              id: transaction.room_id,
              room_number: transaction.room_number,
              status: transaction.room_status
            },
            data: {
              user_name: transaction.buyer_name,
              user_role: 'buyer'
            },
            timestamp: new Date().toISOString()
          })
        });
      }

      // Emit events for file verification
      if (Array.isArray(files)) {
        files.forEach((file: any) => {
          this.handleFileVerificationUpdate({
            action: file.status === 'verified' ? 'approve' : 'reject',
            file: {
              id: file.id,
              file_type: file.file_type,
              file_name: file.file_name,
              status: file.status,
              verified_at: file.verified_at,
              rejection_reason: file.rejection_reason,
              uploaded_by: file.uploaded_by,
              file_url: file.file_url
            },
            transaction: {
              id: file.transaction_id,
              transaction_number: file.transaction_number,
              status: file.transaction_status,
              progress: file.transaction_progress || 0,
              current_action: file.transaction_current_action
            },
            room: {
              id: file.room_id,
              room_number: file.room_number
            },
            reason: file.rejection_reason,
            timestamp: new Date().toISOString()
          })
        });
      }
    } catch (error) {
      console.error('Error checking for transaction updates:', error)
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: any) {
    const { type, event, payload } = data

    switch (type) {
      case 'transaction.updated':
        this.handleTransactionUpdate(event)
        break
      case 'file.verification.updated':
        this.handleFileVerificationUpdate(event)
        break
      default:
        console.log('Unknown event type:', type)
    }
  }

  /**
   * Handle transaction update events
   */
  private handleTransactionUpdate(event: TransactionUpdateEvent) {
    console.log(`[TransactionWebSocket] Handling transaction update for room ${event.room.id}, status: ${event.transaction.status}`);

    // Notify all transaction listeners
    this.listeners.forEach((listeners, key) => {
      if (key === 'global' || key === `room_${event.room.id}`) {
        console.log(`[TransactionWebSocket] Notifying ${listeners.size} listeners for key: ${key}`);
        listeners.forEach(listener => {
          try {
            listener(event)
          } catch (error) {
            console.error('Error in transaction event listener:', error)
          }
        })
      }
    })
  }

  /**
   * Handle file verification update events
   */
  private handleFileVerificationUpdate(event: FileVerificationEvent) {
    // Notify all file verification listeners
    this.fileListeners.forEach((listeners, key) => {
      if (key === 'global' || key === `room_${event.room.id}` || key === `file_${event.file.id}`) {
        listeners.forEach(listener => {
          try {
            listener(event)
          } catch (error) {
            console.error('Error in file verification event listener:', error)
          }
        })
      }
    })
  }

  /**
   * Subscribe to transaction updates
   */
  onTransactionUpdate(handler: TransactionEventHandler, scope?: string | number): () => void {
    const key = scope ? `room_${scope}` : 'global'

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }

    this.listeners.get(key)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(handler)
      if (this.listeners.get(key)?.size === 0) {
        this.listeners.delete(key)
      }
    }
  }

  /**
   * Subscribe to file verification updates
   */
  onFileVerificationUpdate(handler: FileVerificationEventHandler, scope?: string | number): () => void {
    const key = scope ? `file_${scope}` : 'global'

    if (!this.fileListeners.has(key)) {
      this.fileListeners.set(key, new Set())
    }

    this.fileListeners.get(key)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.fileListeners.get(key)?.delete(handler)
      if (this.fileListeners.get(key)?.size === 0) {
        this.fileListeners.delete(key)
      }
    }
  }

  /**
   * Subscribe to room-specific updates
   */
  onRoomUpdate(roomId: number, transactionHandler: TransactionEventHandler, fileHandler: FileVerificationEventHandler): () => void {
    const unsubscribeTransaction = this.onTransactionUpdate(transactionHandler, roomId)
    const unsubscribeFile = this.onFileVerificationUpdate(fileHandler, roomId)

    return () => {
      unsubscribeTransaction()
      unsubscribeFile()
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected
  }

  /**
   * Manually refresh data (useful for testing)
   */
  refresh() {
    if (this.isConnected && this.socket) {
      // Send a ping to keep the connection alive
      this.socket.send(JSON.stringify({ type: 'ping' }))
    } else {
      this.initializeConnection()
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.listeners.clear()
    this.fileListeners.clear()
  }
}

// Create singleton instance
const transactionWebSocket = new TransactionWebSocketService()

export default transactionWebSocket
export type { TransactionUpdateEvent, FileVerificationEvent, TransactionEventHandler, FileVerificationEventHandler }