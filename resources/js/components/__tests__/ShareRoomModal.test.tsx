import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShareRoomModal from '../ShareRoomModal'
import * as QRCode from 'qrcode'

// Mock qrcode library
vi.mock('qrcode')
const mockQRCode = vi.mocked(QRCode)

// Mock fetch
global.fetch = vi.fn()

describe('ShareRoomModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    roomId: 1,
    roomNumber: '01',
    roomStatus: 'free',
    needsBuyer: true,
    needsSeller: false,
    tokenExpiryMinutes: 5
  }

  const mockShareLinksResponse = {
    room_id: 1,
    room_number: 1,
    status: 'free',
    has_buyer: false,
    has_seller: false,
    is_full: false,
    needs_buyer: true,
    needs_seller: false,
    share_links: {
      buyer: {
        join_url: 'https://example.com/rooms/token123/join',
        role: 'buyer',
        label: 'Buyer Link',
        description: 'Share this link with someone who wants to buy'
      }
    },
    token_expiry_minutes: 5
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default fetch mock
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockShareLinksResponse)
    })

    // Setup QR code mock
    mockQRCode.toDataURL.mockResolvedValue('data:image/png;base64,mock-qrcode-data')

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rendering', () => {
    it('should render modal when isOpen is true', () => {
      render(<ShareRoomModal {...defaultProps} />)

      expect(screen.getByText(/Share Room #01/)).toBeInTheDocument()
      expect(screen.getByText(/This room needs a buyer/)).toBeInTheDocument()
    })

    it('should not render modal when isOpen is false', () => {
      render(<ShareRoomModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByText(/Share Room #01/)).not.toBeInTheDocument()
    })

    it('should display correct room number and status', () => {
      render(<ShareRoomModal {...defaultProps} roomNumber="15" />)

      expect(screen.getByText(/Share Room #15/)).toBeInTheDocument()
    })

    it('should show appropriate message for rooms needing both buyer and seller', () => {
      render(
        <ShareRoomModal
          {...defaultProps}
          needsBuyer={true}
          needsSeller={true}
        />
      )

      expect(screen.getByText(/needs both a buyer and a seller/)).toBeInTheDocument()
    })

    it('should show appropriate message for rooms needing only seller', () => {
      render(
        <ShareRoomModal
          {...defaultProps}
          needsBuyer={false}
          needsSeller={true}
        />
      )

      expect(screen.getByText(/needs a seller/)).toBeInTheDocument()
    })
  })

  describe('API Integration', () => {
    it('should fetch share links on mount', async () => {
      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/rooms/1/share-links')
      })
    })

    it('should handle API errors gracefully', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500
      })

      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load share links/)).toBeInTheDocument()
      })
    })

    it('should handle network errors', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load share links/)).toBeInTheDocument()
      })
    })

    it('should show loading state while fetching', () => {
      ;(global.fetch as any).mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<ShareRoomModal {...defaultProps} />)

      expect(screen.getByRole('status')).toBeInTheDocument() // Loading spinner
    })

    it('should display share links when API call succeeds', async () => {
      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Buyer Link')).toBeInTheDocument()
        expect(screen.getByText(/Share this link with someone who wants to buy/)).toBeInTheDocument()
      })
    })
  })

  describe('QR Code Generation', () => {
    it('should generate QR codes for available links', async () => {
      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(mockQRCode.toDataURL).toHaveBeenCalledWith(
          'https://example.com/rooms/token123/join',
          expect.objectContaining({
            width: 200,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          })
        )
      })

      expect(screen.getByRole('img')).toBeInTheDocument()
      expect(screen.getByAltText('Buyer Link QR Code')).toBeInTheDocument()
    })

    it('should handle QR code generation errors', async () => {
      mockQRCode.toDataURL.mockRejectedValue(new Error('QR generation failed'))

      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Buyer Link')).toBeInTheDocument()
      })

      // QR code should not be displayed, but link should still work
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })

  describe('Copy Link Functionality', () => {
    it('should copy link to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup()
      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Buyer Link')).toBeInTheDocument()
      })

      const copyButton = screen.getByText('Copy')
      await user.click(copyButton)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://example.com/rooms/token123/join'
      )
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })

    it('should show copied state temporarily', async () => {
      const user = userEvent.setup()
      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Buyer Link')).toBeInTheDocument()
      })

      const copyButton = screen.getByText('Copy')
      await user.click(copyButton)

      expect(screen.getByText('Copied!')).toBeInTheDocument()

      // Should return to original state after a moment
      await waitFor(() => {
        expect(screen.getByText('Copy')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('should handle clipboard API errors', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Clipboard failed'))
        }
      })

      const user = userEvent.setup()
      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Buyer Link')).toBeInTheDocument()
      })

      const copyButton = screen.getByText('Copy')
      await user.click(copyButton)

      // Should remain in copy state, not show error to user
      expect(screen.getByText('Copy')).toBeInTheDocument()
    })
  })

  describe('Multiple Share Links', () => {
    beforeEach(() => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockShareLinksResponse,
          share_links: {
            buyer: {
              join_url: 'https://example.com/rooms/buyer-token/join',
              role: 'buyer',
              label: 'Buyer Link',
              description: 'Share this link with someone who wants to buy'
            },
            seller: {
              join_url: 'https://example.com/rooms/seller-token/join',
              role: 'seller',
              label: 'Seller Link',
              description: 'Share this link with someone who wants to sell'
            }
          }
        })
      })
    })

    it('should display multiple share links when both buyer and seller needed', async () => {
      render(
        <ShareRoomModal
          {...defaultProps}
          needsBuyer={true}
          needsSeller={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Buyer Link')).toBeInTheDocument()
        expect(screen.getByText('Seller Link')).toBeInTheDocument()
      })
    })

    it('should generate QR codes for all available links', async () => {
      render(
        <ShareRoomModal
          {...defaultProps}
          needsBuyer={true}
          needsSeller={true}
        />
      )

      await waitFor(() => {
        expect(mockQRCode.toDataURL).toHaveBeenCalledWith(
          'https://example.com/rooms/buyer-token/join',
          expect.any(Object)
        )
        expect(mockQRCode.toDataURL).toHaveBeenCalledWith(
          'https://example.com/rooms/seller-token/join',
          expect.any(Object)
        )
      })
    })
  })

  describe('Full Room State', () => {
    beforeEach(() => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockShareLinksResponse,
          share_links: {}
        })
      })
    })

    it('should show full room message when no share links available', async () => {
      render(
        <ShareRoomModal
          {...defaultProps}
          needsBuyer={false}
          needsSeller={false}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/This room is full/)).toBeInTheDocument()
        expect(screen.getByText(/All roles have been filled/)).toBeInTheDocument()
      })
    })

    it('should hide QR codes when room is full', async () => {
      render(
        <ShareRoomModal
          {...defaultProps}
          needsBuyer={false}
          needsSeller={false}
        />
      )

      await waitFor(() => {
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
      })
    })
  })

  describe('Token Expiry Notice', () => {
    it('should display expiry notice when links are available', async () => {
      render(<ShareRoomModal {...defaultProps} tokenExpiryMinutes={10} />)

      await waitFor(() => {
        expect(screen.getByText(/Links expire in 10 minutes/)).toBeInTheDocument()
      })
    })

    it('should not show expiry notice when no links available', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockShareLinksResponse,
          share_links: {}
        })
      })

      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.queryByText(/Links expire/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Modal Controls', () => {
    it('should call onClose when close button is clicked', async () => {
      const mockOnClose = vi.fn()
      const user = userEvent.setup()

      render(<ShareRoomModal {...defaultProps} onClose={mockOnClose} />)

      // Click outside or escape key would typically close modal
      // For this test, we'll find and click a close button if it exists
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should call onClose when Close button in footer is clicked', async () => {
      const mockOnClose = vi.fn()
      const user = userEvent.setup()

      render(<ShareRoomModal {...defaultProps} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
      })

      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should refresh links when Refresh button is clicked', async () => {
      const user = userEvent.setup()

      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
      })

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)

      expect(global.fetch).toHaveBeenCalledTimes(2) // Initial + refresh
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
      })
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()
      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Test tab navigation
      await user.tab()
      expect(document.activeElement).toBeInTheDocument()
    })

    it('should have descriptive titles for QR codes', async () => {
      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        const qrCode = screen.getByRole('img')
        expect(qrCode).toHaveAttribute('alt', 'Buyer Link QR Code')
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed API response', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          // Missing required fields
          room_id: 1
        })
      })

      render(<ShareRoomModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load share links/)).toBeInTheDocument()
      })
    })

    it('should handle slow network requests', async () => {
      ;(global.fetch as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve(mockShareLinksResponse)
        }), 1000))
      )

      render(<ShareRoomModal {...defaultProps} />)

      // Should show loading state
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('should handle rapid open/close cycles', async () => {
      const { rerender } = render(<ShareRoomModal {...defaultProps} />)

      // Close quickly
      rerender(<ShareRoomModal {...defaultProps} isOpen={false} />)

      // Reopen
      rerender(<ShareRoomModal {...defaultProps} isOpen={true} />)

      // Should not crash
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })
})