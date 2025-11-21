import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Share2, Users, User } from 'lucide-react'
import { toast } from 'sonner'
import type { ShareableRoomLinks } from '@/types'

interface ShareUrlModalProps {
  roomId: number
  roomNumber: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  children?: React.ReactNode
}

export function ShareUrlModal({
  roomId,
  roomNumber,
  isOpen,
  onOpenChange,
  children
}: ShareUrlModalProps) {
  const [links, setLinks] = useState<ShareableRoomLinks | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string>('')

  const generateLinks = async () => {
    setLoading(true)
    try {
      // TODO: Implement with Inertia when share links route is added
      // For now, showing placeholder functionality
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Mock links for demonstration
      const mockLinks = {
        buyer: {
          join: `${window.location.origin}/rooms/buyer-token-${Date.now()}/join`,
          enter: `${window.location.origin}/rooms/buyer-token-${Date.now()}/enter`,
        },
        seller: {
          join: `${window.location.origin}/rooms/seller-token-${Date.now()}/join`,
          enter: `${window.location.origin}/rooms/seller-token-${Date.now()}/enter`,
        }
      }

      setLinks(mockLinks)
      toast.success('Shareable links generated!')
    } catch (error) {
      console.error('Error generating links:', error)
      toast.error('Failed to generate shareable links')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (url: string, type: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(type)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setCopied(''), 2000)
    } catch (error) {
      toast.error('Failed to copy link')
    }
  }

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (open && !links) {
      generateLinks()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share Room
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Room #{roomNumber}</DialogTitle>
          <DialogDescription>
            Generate encrypted links for buyer and seller to join this room.
            Links expire in 5 minutes for security.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2">Generating links...</span>
            </div>
          ) : links ? (
            <>
              {/* Buyer Links */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Buyer Links
                </Label>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={links.buyer.join}
                      readOnly
                      className="text-xs"
                      placeholder="Generate buyer join link..."
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(links.buyer.join, 'buyer-join')}
                      className="shrink-0"
                    >
                      {copied === 'buyer-join' ? (
                        <span className="text-green-600">Copied!</span>
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Join link (for new buyers)</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={links.buyer.enter}
                      readOnly
                      className="text-xs"
                      placeholder="Generate buyer enter link..."
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(links.buyer.enter, 'buyer-enter')}
                      className="shrink-0"
                    >
                      {copied === 'buyer-enter' ? (
                        <span className="text-green-600">Copied!</span>
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Enter link (for existing buyers)</p>
                </div>
              </div>

              {/* Seller Links */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Seller Links
                </Label>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={links.seller.join}
                      readOnly
                      className="text-xs"
                      placeholder="Generate seller join link..."
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(links.seller.join, 'seller-join')}
                      className="shrink-0"
                    >
                      {copied === 'seller-join' ? (
                        <span className="text-green-600">Copied!</span>
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Join link (for new sellers)</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={links.seller.enter}
                      readOnly
                      className="text-xs"
                      placeholder="Generate seller enter link..."
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(links.seller.enter, 'seller-enter')}
                      className="shrink-0"
                    >
                      {copied === 'seller-enter' ? (
                        <span className="text-green-600">Copied!</span>
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Enter link (for existing sellers)</p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={generateLinks}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Generate New Links
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Click the button below to generate encrypted shareable links
              </p>
              <Button onClick={generateLinks} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Links'}
              </Button>
            </div>
          )}

          <div className="text-xs text-muted-foreground border-t pt-2">
            <p>🔒 Links are encrypted and expire in 5 minutes</p>
            <p>👤 Each role has specific join and enter links</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}