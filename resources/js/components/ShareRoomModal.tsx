import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useClipboard } from '@/hooks/use-clipboard';
import { Copy, ExternalLink, QrCode, Users, Clock, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import * as QRCode from 'qrcode';
import { encryptRoomId } from '@/lib/roomUrlUtils';

interface ShareLink {
    join_url: string;
    role: 'buyer' | 'seller';
    label: string;
    description: string;
}

interface ShareRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    roomId: number;
    roomNumber: string;
    roomStatus: string;
    needsBuyer: boolean;
    needsSeller: boolean;
    tokenExpiryMinutes: number;
}

export default function ShareRoomModal({
    isOpen,
    onClose,
    roomId,
    roomNumber,
    roomStatus,
    needsBuyer,
    needsSeller,
    tokenExpiryMinutes,
}: ShareRoomModalProps) {
    const [shareLinks, setShareLinks] = useState<{ buyer?: ShareLink; seller?: ShareLink }>({});
    const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedText, copy] = useClipboard();

    const fetchShareLinks = useCallback(async () => {
        if (!isOpen || !roomId) return;

        setLoading(true);
        setError(null);

        try {
            const encryptedRoomId = encryptRoomId(roomId);
            const response = await fetch(`/api/rooms/${encryptedRoomId}/share-links`);
            if (!response.ok) {
                throw new Error('Failed to fetch share links');
            }

            const data = await response.json();
            setShareLinks(data.share_links);

            // Generate QR codes for each link
            const qrCodeData: { [key: string]: string } = {};
            for (const [role, link] of Object.entries(data.share_links)) {
                try {
                    const qrCodeUrl = await QRCode.toDataURL(link.join_url, {
                        width: 200,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#ffffff',
                        },
                    });
                    qrCodeData[role] = qrCodeUrl;
                } catch (qrError) {
                    console.error(`Failed to generate QR code for ${role}:`, qrError);
                }
            }
            setQrCodes(qrCodeData);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load share links');
        } finally {
            setLoading(false);
        }
    }, [isOpen, roomId]);

    useEffect(() => {
        if (isOpen) {
            fetchShareLinks();
        }
    }, [isOpen, fetchShareLinks]);

    const handleCopyLink = async (url: string, role: string) => {
        await copy(url);
    };

    const handleClose = () => {
        setShareLinks({});
        setQrCodes({});
        setError(null);
        onClose();
    };

    const getRoleIcon = (role: 'buyer' | 'seller') => {
        return role === 'buyer' ? (
            <div className="rounded-full bg-green-100 p-1.5">
                <Users className="size-3 text-green-600" />
            </div>
        ) : (
            <div className="rounded-full bg-blue-100 p-1.5">
                <Users className="size-3 text-blue-600" />
            </div>
        );
    };

    const getRoleBadgeColor = (role: 'buyer' | 'seller') => {
        return role === 'buyer'
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-blue-50 text-blue-700 border-blue-200';
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                        <QrCode className="h-6 w-6 text-blue-600" />
                    </div>
                    <DialogTitle className="text-center">
                        Share Room #{roomNumber}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {needsBuyer && needsSeller
                            ? 'This room needs both a buyer and a seller. Share the appropriate links below.'
                            : needsBuyer
                            ? 'This room needs a buyer. Share the link below to invite someone.'
                            : 'This room needs a seller. Share the link below to invite someone.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col space-y-4">
                    {error && (
                        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    )}

                    {!loading && !error && Object.entries(shareLinks).length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            <ShieldCheck className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                            <p className="font-medium">This room is full</p>
                            <p className="text-sm">All roles have been filled. No share links available.</p>
                        </div>
                    )}

                    {!loading && !error && Object.entries(shareLinks).map(([role, link]) => {
                        const shareLink = link as ShareLink;
                        return (
                        <div key={role} className="rounded-lg border border-gray-200 p-4 space-y-3">
                            {/* Role Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {getRoleIcon(shareLink.role)}
                                    <div>
                                        <p className="font-medium text-gray-900">{shareLink.label}</p>
                                        <p className="text-sm text-gray-500">{shareLink.description}</p>
                                    </div>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium border ${getRoleBadgeColor(shareLink.role)}`}>
                                    {shareLink.role}
                                </span>
                            </div>

                            {/* QR Code */}
                            {qrCodes[role] && (
                                <div className="flex justify-center">
                                    <div className="rounded-lg border border-gray-200 p-3 bg-white">
                                        <img
                                            src={qrCodes[role]}
                                            alt={`${shareLink.label} QR Code`}
                                            className="w-32 h-32"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* URL Input and Actions */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                                    <input
                                        type="text"
                                        value={shareLink.join_url}
                                        readOnly
                                        className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleCopyLink(shareLink.join_url, role)}
                                        className="flex items-center gap-1 text-xs"
                                    >
                                        {copiedText === shareLink.join_url ? (
                                            <>
                                                <Copy className="h-3 w-3" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-3 w-3" />
                                                Copy
                                            </>
                                        )}
                                    </Button>
                                </div>
                                <a
                                    href={shareLink.join_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    Open in new tab
                                </a>
                            </div>
                        </div>
                        );
                    })}

                    {/* Expiry Notice */}
                    {!loading && !error && Object.entries(shareLinks).length > 0 && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                            <div className="flex items-start gap-2">
                                <Clock className="h-4 w-4 text-amber-600 mt-0.5" />
                                <div className="text-sm text-amber-700">
                                    <p className="font-medium">Links expire in {tokenExpiryMinutes} minutes</p>
                                    <p className="text-xs text-amber-600 mt-1">
                                        These are one-time secure links that will automatically expire for security.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            className="flex-1"
                        >
                            Close
                        </Button>
                        {!loading && !error && Object.entries(shareLinks).length > 0 && (
                            <Button
                                onClick={fetchShareLinks}
                                className="flex-1"
                            >
                                Refresh Links
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}