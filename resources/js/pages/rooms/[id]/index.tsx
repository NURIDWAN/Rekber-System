import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

import RoomsNavbar from '@/components/RoomsNavbar';
import { useMultiSession } from '@/contexts/MultiSessionContext';
// WebSocket imports
import {
    listenToMessages,
    listenToUserStatus,
    listenToActivities,
    listenToFileUploads,
    getConnectionStatus,
    unsubscribeFromRoom,
    onConnectionEstablished,
    onConnectionError,
    onConnectionDisconnected,
} from '@/lib/websocket';
import transactionWebSocket, { TransactionUpdateEvent, FileVerificationEvent } from '@/services/transaction-websocket';
import {
    Send,
    User,
    Users,
    ShoppingCart,
    Shield,
    MessageCircle,
    Activity,
    Clock,
} from 'lucide-react';
import Toast, { ToastType } from '@/components/Toast';

import { transactionAPI } from '@/services/transaction-api';
import RoomTour from '@/components/RoomTour';
import Swal from 'sweetalert2';

interface RoomData {
    id: number;
    room_number: number;
    status: string;
    buyer?: {
        name: string;
        is_online: boolean;
        joined_at: string;
    };
    seller?: {
        name: string;
        is_online: boolean;
        joined_at: string;
    };
    messages: Array<{
        id: number;
        sender_role: string;
        sender_name: string;
        message: string;
        type: string;
        created_at: string;
    }>;
    files?: Array<{
        id: number;
        file_path: string;
        file_name: string;
        file_type: string;
    }>;
    expires_at?: string;
    is_expired?: boolean;
}

interface ShareLinks {
    buyer: { join: string; enter: string };
    seller: { join: string; enter: string };
    pin_enabled?: boolean;
    pin?: string | null;
}

interface PageProps {
    room: RoomData;
    currentUser: {
        role: 'buyer' | 'seller' | 'gm';
        name: string;
        is_online: boolean;
    };
    share_links: ShareLinks;
    encrypted_room_id?: string;
}

type ConnectionState = 'connected' | 'connecting' | 'disconnected';

interface PaymentUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (amount: number, file: File) => void;
    isProcessing: boolean;
}

function PaymentUploadModal({ isOpen, onClose, onSubmit, isProcessing }: PaymentUploadModalProps) {
    const [amount, setAmount] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !file) return;
        onSubmit(Number(amount), file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-bold text-slate-900">Upload Bukti Pembayaran</h3>
                <p className="mt-1 text-sm text-slate-500">
                    Masukkan nominal transfer dan upload bukti pembayaran Anda.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="amount" className="text-sm font-medium text-slate-700">
                            Nominal Transfer (Rp)
                        </label>
                        <input
                            id="amount"
                            type="number"
                            min="0"
                            placeholder="Contoh: 150000"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="file" className="text-sm font-medium text-slate-700">
                            Bukti Transfer
                        </label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition-colors hover:bg-slate-100"
                        >
                            {file ? (
                                <div className="text-center">
                                    <p className="text-sm font-medium text-slate-900">{file.name}</p>
                                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                                        </svg>
                                    </div>
                                    <p className="mt-2 text-sm font-medium text-slate-900">Klik untuk upload</p>
                                    <p className="mt-1 text-xs text-slate-500">PNG, JPG, GIF max 5MB</p>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                id="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            disabled={isProcessing}
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isProcessing || !amount || !file}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isProcessing ? 'Mengunggah...' : 'Kirim Bukti'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface ImagePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    fileName: string;
}

function ImagePreviewModal({ isOpen, onClose, imageUrl, fileName }: ImagePreviewModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 text-white/70 hover:text-white transition p-2"
                >
                    <span className="sr-only">Close</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <img
                    src={imageUrl}
                    alt={fileName}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl bg-black"
                />
                <div className="mt-4 text-white/90 text-sm font-medium bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                    {fileName}
                </div>
            </div>
        </div>
    );
}

const useCountdown = (targetDate?: string) => {
    const [timeLeft, setTimeLeft] = useState<{
        days: number;
        hours: number;
        minutes: number;
        isExpired: boolean;
    }>({ days: 0, hours: 0, minutes: 0, isExpired: false });

    useEffect(() => {
        if (!targetDate) return;

        const calculateTimeLeft = () => {
            const difference = +new Date(targetDate) - +new Date();

            if (difference > 0) {
                setTimeLeft({
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    isExpired: false,
                });
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, isExpired: true });
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 60000); // Update every minute

        return () => clearInterval(timer);
    }, [targetDate]);

    return timeLeft;
};

export default function RoomPage({ room, currentUser, share_links, encrypted_room_id }: PageProps) {
    const { data, setData } = useForm({
        message: '',
        type: 'text',
    });

    // Multi-session management
    const {
        setActiveRoom,
        getSessionByRoomId,
        getActiveSession,
        updateSession,
        sessions,
        error: sessionError
    } = useMultiSession();

    // Set this room as active
    useEffect(() => {
        if (currentUser) {
            setActiveRoom(room.id, currentUser.role);

            // Update session info with latest data
            const existingSession = getSessionByRoomId(room.id);
            if (existingSession) {
                updateSession(room.id, {
                    roomNumber: room.room_number,
                    userName: currentUser.name,
                    role: currentUser.role,
                    isOnline: true,
                    lastSeen: new Date().toISOString()
                });
            }
        }
    }, [room.id, currentUser]);
    const [processing, setProcessing] = useState(false);

    // Initialize Transaction WebSocket Service
    useEffect(() => {
        if (room.id && currentUser.role) {
            transactionWebSocket.setContext(room.id, currentUser.role);
            transactionWebSocket.start();
        }

        return () => {
            transactionWebSocket.stop();
        };
    }, [room.id, currentUser.role]);

    const [messages, setMessages] = useState(room.messages || []);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionState>('connecting');
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [recentActivities, setRecentActivities] = useState<any[]>([]);

    // Transaction state
    const [currentRoomStatus, setCurrentRoomStatus] = useState(room.status);
    const [transactionData, setTransactionData] = useState<any>(null);
    const [loadingTransaction, setLoadingTransaction] = useState(true);

    // Load transaction data on component mount
    useEffect(() => {
        const loadTransactionData = async () => {
            try {
                setLoadingTransaction(true);
                const response = await transactionAPI.getTransactionByRoomId(room.id);
                if (response.success && response.data) {
                    setTransactionData(response.data);
                    setCurrentRoomStatus(response.data.status);
                }
            } catch (error) {
                console.error('Failed to load transaction data:', error);
                // Keep using room status as fallback
            } finally {
                setLoadingTransaction(false);
            }
        };

        if (room.id) {
            loadTransactionData();
        }
    }, [room.id]);

    useEffect(() => {
        setCurrentRoomStatus(room.status);
    }, [room.status]);
    const [lastTransactionUpdate, setLastTransactionUpdate] = useState<Date | null>(null);
    const [isTransactionConnected, setIsTransactionConnected] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sseRef = useRef<EventSource | null>(null);
    const [shareLinks, setShareLinks] = useState<ShareLinks>(share_links);
    const [copiedRole, setCopiedRole] = useState<'buyer' | 'seller' | null>(null);
    const [shareLoading, setShareLoading] = useState(false);
    const [pinEnabled, setPinEnabled] = useState(false);
    const [pinCode, setPinCode] = useState('');
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState<'buyer' | 'seller'>('buyer');
    const [startTour, setStartTour] = useState(false);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem('has_seen_room_tour');
        if (!hasSeenTour) {
            setStartTour(true);
            localStorage.setItem('has_seen_room_tour', 'true');
        }
    }, []);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);

    const { days, hours, minutes, isExpired } = useCountdown(room.expires_at);
    const isRoomExpired = room.is_expired || isExpired;

    // SSE fallback for message stream (works alongside Pusher and direct WS)
    useEffect(() => {
        const lastKnownId = room.messages && room.messages.length
            ? room.messages[room.messages.length - 1].id
            : 0;
        const url = new URL(`/api/rooms/${encrypted_room_id || room.id}/sse`, window.location.origin);
        if (lastKnownId) {
            url.searchParams.set('last_id', String(lastKnownId));
        }

        const source = new EventSource(url.toString());
        sseRef.current = source;

        source.addEventListener('open', () => {
            console.info('[SSE] connected to room stream');
            setConnectionStatus((status) => status === 'connected' ? status : 'connected');
        });

        const handleMessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (!data?.id) return;

                setMessages((prev) => {
                    if (prev.some((msg) => msg.id === data.id)) {
                        return prev;
                    }
                    return [...prev, data];
                });
                scrollToBottom();
            } catch (error) {
                console.error('[SSE] failed to parse message', error);
            }
        };

        source.addEventListener('room.message', handleMessage);

        source.onerror = (error) => {
            console.warn('[SSE] stream error, closing connection', error);
            source.close();
        };

        return () => {
            source.removeEventListener('room.message', handleMessage);
            source.close();
            sseRef.current = null;
        };
    }, [room.id]);

    // Sync pin state from initial links
    useEffect(() => {
        if (share_links?.pin) {
            setPinEnabled(true);
            setPinCode(share_links.pin ?? '');
        }
    }, [share_links]);

    // Transaction WebSocket integration
    useEffect(() => {
        // Listen to transaction updates for this room
        const unsubscribeTransaction = transactionWebSocket.onTransactionUpdate(
            (event: TransactionUpdateEvent) => {
                console.log('Transaction update received:', event);

                // Only process updates for this room
                if (event.room.id !== room.id) return;

                // Update room status and transaction data
                setCurrentRoomStatus(event.transaction.status);
                setTransactionData(event.transaction);
                setLastTransactionUpdate(new Date());
                setIsTransactionConnected(true);

                console.log('Transaction status updated to:', event.transaction.status);
            },
            room.id // Listen to updates for this specific room
        );

        // Listen to file verification updates for this room
        const unsubscribeFile = transactionWebSocket.onFileVerificationUpdate(
            (event: FileVerificationEvent) => {
                console.log('File verification update received:', event);

                // Only process updates for this room
                if (event.room.id !== room.id) return;

                // Update transaction data from file verification event
                if (event.transaction) {
                    setCurrentRoomStatus(event.transaction.status);
                    setTransactionData(event.transaction);
                }

                setLastTransactionUpdate(new Date());
                setIsTransactionConnected(true);

                console.log('File verification updated, transaction status:', event.transaction?.status);
            },
            room.id // Listen to updates for this specific room
        );

        // Set connection status checker
        const connectionChecker = setInterval(() => {
            setIsTransactionConnected(transactionWebSocket.getConnectionStatus());
        }, 5000);

        return () => {
            unsubscribeTransaction();
            unsubscribeFile();
            clearInterval(connectionChecker);
        };
    }, [room.id]);

    const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;

    const copyToClipboard = async (text: string) => {
        if (!text) return false;
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            } catch (fallbackError) {
                console.warn('Clipboard copy failed', fallbackError);
                return false;
            }
        }
    };

    const generatePin = () => {
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        setPinCode(pin);
        return pin;
    };

    const refreshShareLinks = async (pin?: string) => {
        setShareLoading(true);
        try {
            const response = await fetch('/api/room/generate-share-links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                },
                body: JSON.stringify({
                    room_id: room.id,
                    pin: pin || null,
                }),
            });

            if (response.ok) {
                const json = await response.json();
                if (json?.data?.links) {
                    setShareLinks(json.data.links);
                }
                if (json?.data?.pin) {
                    setPinCode(json.data.pin);
                }
                return json?.data?.links as ShareLinks | undefined;
            }
            return undefined;
        } catch (error) {
            console.error('Failed to refresh share links', error);
            return undefined;
        } finally {
            setShareLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Refresh share links when toggling PIN protection
    useEffect(() => {
        if (pinEnabled) {
            const nextPin = pinCode || generatePin();
            refreshShareLinks(nextPin);
        } else {
            setPinCode('');
            refreshShareLinks();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pinEnabled]);

    // WebSocket setup
    useEffect(() => {
        // Set initial connection status
        setConnectionStatus('connecting');

        // Connection listeners
        const unsubscribeConnected = onConnectionEstablished(() => {
            console.info('[Pusher] connection established');
            setConnectionStatus('connected');
        });

        const unsubscribeError = onConnectionError((error) => {
            console.error('WebSocket connection error:', error);
            setConnectionStatus('disconnected');
            console.info('[Pusher] connection error state_change -> disconnected');
        });

        const unsubscribeDisconnected = onConnectionDisconnected(() => {
            setConnectionStatus('disconnected');
            console.info('[Pusher] connection disconnected');
        });

        // Listen to new messages
        const unsubscribeMessages = listenToMessages(room.id, (newMessage) => {
            setMessages(prev => {
                // Avoid duplicates
                if (prev.some(msg => msg.id === newMessage.id)) {
                    return prev;
                }
                return [...prev, newMessage];
            });
            scrollToBottom();
        });

        // Listen to user status changes
        const unsubscribeUserStatus = listenToUserStatus(room.id, (statusChange) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                if (statusChange.is_online) {
                    newSet.add(`${statusChange.user_role}-${statusChange.user_name}`);
                } else {
                    newSet.delete(`${statusChange.user_role}-${statusChange.user_name}`);
                }
                return newSet;
            });
        });

        // Listen to activities
        const unsubscribeActivities = listenToActivities(room.id, (activity) => {
            setRecentActivities(prev => [activity, ...prev].slice(0, 5));
        });

        // Listen to file uploads
        const unsubscribeFileUploads = listenToFileUploads(room.id, (fileData) => {
            setMessages(prev => {
                // Avoid duplicates
                if (prev.some(msg => msg.id === fileData.id)) {
                    return prev;
                }
                return [...prev, fileData];
            });
            scrollToBottom();
        });

        // Check current connection status
        const currentStatus = getConnectionStatus();
        if (currentStatus === 'connected') {
            setConnectionStatus('connected');
        }

        // Cleanup
        return () => {
            unsubscribeConnected();
            unsubscribeError();
            unsubscribeDisconnected();
            unsubscribeMessages();
            unsubscribeUserStatus();
            unsubscribeActivities();
            unsubscribeFileUploads();
            unsubscribeFromRoom(room.id);
        };
    }, [room.id]);

    const sendMessage = async (messageText: string, type: string = 'text') => {
        if (!messageText.trim() && type === 'text') return;

        console.log('📤 Sending message:', { text: messageText.trim(), type, wsConnected: connectionStatus === 'connected' });
        setProcessing(true);

        // Fallback to Inertia route (DB + broadcast)
        try {
            await new Promise((resolve, reject) => {
                router.post(`/rooms/${encrypted_room_id || room.id}/message`, {
                    message: messageText.trim(),
                    type,
                }, {
                    preserveScroll: true,
                    onSuccess: () => {
                        setData("message", "");
                        resolve(null);
                    },
                    onError: (errors) => {
                        console.error("Message errors:", errors);
                        reject(new Error("Failed to send message"));
                    },
                });
            });
            console.log("✅ Sent via Inertia route (DB + broadcast)");
        } catch (error) {
            console.error("WebSocket/Inertia send error:", error);
        } finally {
            setProcessing(false);
        }
    };


    const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
        message: '',
        type: 'info',
        isVisible: false,
    });

    const showToast = (message: string, type: ToastType = 'info') => {
        setToast({ message, type, isVisible: true });
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // If buyer, show modal instead of direct upload
        if (currentUser.role === 'buyer') {
            // Reset file input so change event can fire again if needed
            if (fileInputRef.current) fileInputRef.current.value = '';
            // We don't use the file from this event for buyer, we let them pick in the modal
            setShowPaymentModal(true);
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('file_type', 'shipping_receipt');

        setProcessing(true);

        router.post(`/rooms/${encrypted_room_id || room.id}/upload`, formData, {
            onSuccess: (page) => {
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                showToast('File berhasil diunggah!', 'success');
                router.reload({ only: ['room'] });
            },
            onError: (errors) => {
                console.error('Upload errors:', errors);
                showToast('Gagal mengunggah file. Silakan coba lagi.', 'error');
            },
            onFinish: () => setProcessing(false),
        });
    };

    const handlePaymentSubmit = (amount: number, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('file_type', 'payment_proof');
        formData.append('amount', amount.toString());

        setProcessing(true);

        router.post(`/rooms/${encrypted_room_id || room.id}/upload`, formData, {
            onSuccess: (page) => {
                setShowPaymentModal(false);
                showToast('Bukti pembayaran berhasil dikirim!', 'success');
                router.reload({ only: ['room'] });
            },
            onError: (errors) => {
                console.error('Upload errors:', errors);
                showToast('Gagal mengirim bukti pembayaran. Silakan coba lagi.', 'error');
            },
            onFinish: () => setProcessing(false),
        });
    };

    const handleLeaveRoom = () => {
        Swal.fire({
            title: 'Keluar Room?',
            text: "Anda yakin ingin meninggalkan room ini?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Ya, Keluar',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(`/rooms/${encrypted_room_id || room.id}/leave`, {}, {
                    onSuccess: () => {
                        router.visit('/rooms');
                    }
                });
            }
        });
    };

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const isCurrentUser = (senderRole: string, senderName: string) => {
        return senderRole === currentUser.role && senderName === currentUser.name;
    };

    const hasBuyer = !!room.buyer;
    const hasSeller = !!room.seller;

    const transactionSteps = [
        { key: 'payment_proof_uploaded', label: 'Bukti diunggah', hint: 'Buyer upload bukti', role: 'buyer' },
        { key: 'payment_verified', label: 'Verifikasi GM', hint: 'Validasi dana & bukti', role: 'gm' },
        { key: 'shipping_receipt_uploaded', label: 'Kirim barang', hint: 'Seller upload resi', role: 'seller' },
        { key: 'goods_received', label: 'Konfirmasi buyer', hint: 'Barang diterima', role: 'buyer' },
        { key: 'transaction_completed', label: 'Dana dirilis', hint: 'GM lepaskan dana', role: 'gm' },
    ] as const;

    const statusToStepIndex: Record<string, number> = {
        free: 0,
        in_use: hasBuyer ? 1 : 0,
        payment_pending: 1,
        pending_payment: 1,
        awaiting_payment_verification: 2,
        payment_verified: 3,
        payment_rejected: 1,
        paid: 3,
        awaiting_shipping_verification: 4,
        shipped: 4,
        goods_received: 5,
        delivered: 5,
        completed: 5,
    };

    const statusMeta: Record<string, { label: string; tone: 'slate' | 'amber' | 'blue' | 'violet' | 'emerald' | 'red' }> = {
        free: { label: 'Menunggu peserta', tone: 'slate' },
        in_use: { label: 'Sedang berjalan', tone: 'blue' },
        payment_pending: { label: 'Menunggu verifikasi pembayaran', tone: 'amber' },
        pending_payment: { label: 'Menunggu verifikasi pembayaran', tone: 'amber' },
        awaiting_payment_verification: { label: 'Menunggu verifikasi pembayaran', tone: 'amber' },
        payment_rejected: { label: 'Bukti pembayaran ditolak', tone: 'red' },
        payment_verified: { label: 'Menunggu pengiriman seller', tone: 'blue' },
        paid: { label: 'Menunggu pengiriman seller', tone: 'blue' },
        awaiting_shipping_verification: { label: 'Verifikasi resi pengiriman', tone: 'blue' },
        shipped: { label: 'Menunggu konfirmasi buyer', tone: 'violet' },
        goods_received: { label: 'Barang Diterima - Menunggu rilis dana', tone: 'violet' },
        delivered: { label: 'Menunggu rilis dana', tone: 'violet' },
        completed: { label: 'Dana dirilis', tone: 'emerald' },
    };

    const currentStepIndex = Math.min(
        transactionSteps.length,
        statusToStepIndex[currentRoomStatus] ?? (hasBuyer ? 1 : 0)
    );
    const visibleStepIndex = Math.max(1, currentStepIndex || 1);

    const progressState = transactionSteps.map((step, idx) => {
        const stepNumber = idx + 1;
        let state: 'done' | 'current' | 'pending' | 'error' = 'pending';

        if (currentRoomStatus === 'payment_rejected' && step.key === 'payment_verified') {
            state = 'error';
        } else if (stepNumber < currentStepIndex) {
            state = 'done';
        } else if (stepNumber === currentStepIndex) {
            state = currentRoomStatus === 'payment_rejected' ? 'error' : 'current';
        }

        return { ...step, state, stepNumber };
    });
    const toneClasses: Record<typeof statusMeta[keyof typeof statusMeta]['tone'], string> = {
        slate: 'bg-slate-100 text-slate-700 ring-slate-200',
        amber: 'bg-amber-100 text-amber-800 ring-amber-200',
        blue: 'bg-blue-100 text-blue-700 ring-blue-200',
        violet: 'bg-violet-100 text-violet-700 ring-violet-200',
        emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
        red: 'bg-red-100 text-red-700 ring-red-200',
    };
    const heroToneClasses: Record<typeof statusMeta[keyof typeof statusMeta]['tone'], string> = {
        slate: 'bg-white/10 text-white ring-white/20',
        amber: 'bg-amber-400/25 text-white ring-amber-200/50',
        blue: 'bg-blue-400/25 text-white ring-blue-200/50',
        violet: 'bg-violet-400/25 text-white ring-violet-200/50',
        emerald: 'bg-emerald-400/20 text-white ring-emerald-200/60',
        red: 'bg-red-500/25 text-white ring-red-200/50',
    };
    const connectionToneClasses: Record<ConnectionState, string> = {
        connected: 'bg-emerald-500/20 text-emerald-50 ring-emerald-300/40',
        connecting: 'bg-amber-400/20 text-amber-50 ring-amber-200/40',
        disconnected: 'bg-red-500/25 text-red-50 ring-red-300/40',
    };
    const connectionDotTone: Record<ConnectionState, string> = {
        connected: 'bg-emerald-300',
        connecting: 'bg-amber-300',
        disconnected: 'bg-red-300',
    };
    const statusInfo = statusMeta[currentRoomStatus] ?? statusMeta.in_use;

    return (
        <>
            <Head title={`Room #${room.room_number} - Rekber System`} />
            <div className="min-h-screen bg-slate-100">
                <RoomsNavbar
                    roomNumber={room.room_number}
                    roomStatus={room.status}
                    connectionStatus={connectionStatus}
                    onLeaveRoom={handleLeaveRoom}
                    currentUser={currentUser}
                    encryptedRoomId={encrypted_room_id}
                />

                <RoomTour startTour={startTour} onTourEnd={() => setStartTour(false)} />
                <PaymentUploadModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    onSubmit={handlePaymentSubmit}
                    isProcessing={processing}
                />
                <ImagePreviewModal
                    isOpen={showImageModal}
                    onClose={() => setShowImageModal(false)}
                    imageUrl={selectedImage?.url || ''}
                    fileName={selectedImage?.name || ''}
                />

                <div className="mx-auto max-w-[1400px] px-4 lg:px-6 py-2 space-y-5">
                    <div id="room-header" className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 text-white shadow-xl border border-blue-500/20">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_35%)]" />
                        <div className="absolute inset-y-0 right-0 w-1/3 bg-white/10 blur-3xl" />
                        <div className="relative p-6 lg:p-8">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-inner ring-1 ring-white/30">
                                        <Shield className="h-6 w-6 text-blue-100" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold tracking-tight text-white">
                                            Room #{room.room_number}
                                        </h1>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            if (confirm('Extend room duration by 24 hours?')) {
                                                router.post(`/rooms/${encrypted_room_id || room.id}/extend`, {}, {
                                                    onSuccess: () => showToast('Room extended successfully!', 'success'),
                                                    onError: () => showToast('Failed to extend room.', 'error')
                                                });
                                            }
                                        }}
                                        className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition backdrop-blur-sm"
                                    >
                                        <Clock className="w-4 h-4" />
                                        Extend Duration
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                                <div className="space-y-3">
                                    <p className="text-[11px] uppercase tracking-wide text-white/70">Visual Process Hub</p>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h1 className="text-3xl font-bold leading-tight">Room #{room.room_number}</h1>
                                        <div className="flex items-center gap-2 text-blue-100">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset backdrop-blur-md",
                                                heroToneClasses[statusInfo.tone]
                                            )}>
                                                <span className="relative flex h-2 w-2">
                                                    <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", statusInfo.tone === 'slate' ? 'bg-slate-400' : 'bg-current')}></span>
                                                    <span className={cn("relative inline-flex rounded-full h-2 w-2", statusInfo.tone === 'slate' ? 'bg-slate-500' : 'bg-current')}></span>
                                                </span>
                                                {statusInfo.label}
                                            </span>
                                            {room.expires_at && (
                                                <span className={cn(
                                                    "text-xs px-2 py-0.5 rounded-full flex items-center gap-1",
                                                    isRoomExpired ? "bg-red-500/20 text-red-100 ring-1 ring-red-500/50" : "bg-white/10"
                                                )}>
                                                    <Clock className="w-3 h-3" />
                                                    {isRoomExpired ? 'Expired' : `${days}d ${hours}h ${minutes}m left`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-2 px-3 py-1 rounded-full font-semibold ring-1',
                                                connectionToneClasses[connectionStatus]
                                            )}
                                        >
                                            <span className={cn('h-2 w-2 rounded-full', connectionDotTone[connectionStatus])} />
                                            {connectionStatus === 'connected'
                                                ? 'Online'
                                                : connectionStatus === 'connecting'
                                                    ? 'Menyambung'
                                                    : 'Terputus'}
                                        </span>
                                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white ring-1 ring-white/20 font-semibold">
                                            <User className="w-4 h-4" />
                                            {currentUser.role.toUpperCase()}
                                        </span>
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-2 px-3 py-1 rounded-full ring-1 ring-white/20 font-semibold',
                                                currentUser.is_online ? 'bg-emerald-400/20 text-white' : 'bg-white/10 text-white/70'
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'h-2 w-2 rounded-full',
                                                    currentUser.is_online ? 'bg-emerald-300' : 'bg-white/50'
                                                )}
                                            />
                                            {currentUser.is_online ? 'Aktif' : 'Idle'}
                                        </span>
                                    </div>
                                </div>

                                <div id="participants-section" className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl bg-white/10 border border-white/15 p-3 shadow-sm">
                                        <p className="text-[11px] text-white/80 uppercase tracking-wide">Buyer</p>
                                        <div className="mt-1 flex items-center justify-between gap-2">
                                            <span className="font-semibold leading-tight">{room.buyer?.name ?? 'Belum bergabung'}</span>
                                            <span
                                                className={cn('w-2 h-2 rounded-full', room.buyer?.is_online ? 'bg-emerald-300' : 'bg-white/50')}
                                            />
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-white/10 border border-white/15 p-3 shadow-sm">
                                        <p className="text-[11px] text-white/80 uppercase tracking-wide">Seller</p>
                                        <div className="mt-1 flex items-center justify-between gap-2">
                                            <span className="font-semibold leading-tight">{room.seller?.name ?? 'Belum bergabung'}</span>
                                            <span
                                                className={cn('w-2 h-2 rounded-full', room.seller?.is_online ? 'bg-emerald-300' : 'bg-white/50')}
                                            />
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-white/10 border border-white/15 p-3 shadow-sm">
                                        <p className="text-[11px] text-white/80 uppercase tracking-wide">Pesan</p>
                                        <div className="mt-1 flex items-center justify-between gap-2">
                                            <span className="text-lg font-bold">{messages.length}</span>
                                            <MessageCircle className="w-4 h-4 text-white/80" />
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-white/10 border border-white/15 p-3 shadow-sm">
                                        <p className="text-[11px] text-white/80 uppercase tracking-wide">Status Room</p>
                                        <div className="mt-1 flex items-center justify-between gap-2">
                                            <span className="font-semibold capitalize">{room.status === 'free' ? 'Free' : 'In Use'}</span>
                                            <Shield className="w-4 h-4 text-white/80" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between rounded-2xl bg-white/10 border border-white/15 px-4 py-3 shadow-sm">
                                        <div className="text-sm font-semibold text-white">Aktivitas Peserta</div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">
                                                <span className="h-2 w-2 rounded-full bg-blue-200" />
                                                {hasBuyer ? 'Buyer aktif' : 'Buyer belum join'}
                                            </span>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">
                                                <span className="h-2 w-2 rounded-full bg-purple-200" />
                                                {hasSeller ? 'Seller aktif' : 'Seller belum join'}
                                            </span>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">
                                                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                                                Multi-session aman
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl shadow-md p-2 lg:p-6">
                    <div className="flex flex-wrap items-center gap-3 ">
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ring-1',
                                toneClasses[statusInfo.tone]
                            )}>
                                <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                                {statusInfo.label}
                            </span>
                            <span className="text-xs text-slate-500">
                                Tahap {visibleStepIndex} dari {transactionSteps.length}
                            </span>
                        </div>
                        <div className="ml-auto flex flex-wrap gap-2 text-xs font-semibold">
                            <span className={cn(
                                'inline-flex items-center gap-2 px-3 py-1 rounded-full ring-1 ring-slate-200',
                                hasBuyer ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                            )}>
                                {hasBuyer ? 'Buyer aktif' : 'Buyer belum join'}
                            </span>
                            <span className={cn(
                                'inline-flex items-center gap-2 px-3 py-1 rounded-full ring-1 ring-slate-200',
                                hasSeller ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'
                            )}>
                                {hasSeller ? 'Seller aktif' : 'Seller belum join'}
                            </span>
                        </div>
                    </div>

                </div>

                <div className="grid mt-4 p-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" id="transaction-progress">
                    {progressState.map((step) => (
                        <div
                            key={step.key}
                            className={cn(
                                'rounded-xl border px-3 py-3 text-sm shadow-sm transition',
                                step.state === 'done' && 'border-emerald-100 bg-emerald-50 text-emerald-800',
                                step.state === 'current' && 'border-blue-100 bg-blue-50 text-blue-800',
                                step.state === 'pending' && 'border-slate-200 bg-white text-slate-700',
                                step.state === 'error' && 'border-red-100 bg-red-50 text-red-700'
                            )}
                        >
                            <div className="flex items-start gap-2">
                                <span className={cn(
                                    'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ring-1',
                                    step.state === 'done' && 'bg-emerald-100 text-emerald-700 ring-emerald-200',
                                    step.state === 'current' && 'bg-blue-100 text-blue-700 ring-blue-200',
                                    step.state === 'pending' && 'bg-slate-100 text-slate-500 ring-slate-200',
                                    step.state === 'error' && 'bg-red-100 text-red-700 ring-red-200'
                                )}>
                                    {step.state === 'done' ? '✓' : step.stepNumber}
                                </span>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-semibold leading-tight">{step.label}</p>
                                        <span className="text-[10px] uppercase tracking-wide text-slate-400">{step.role}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">{step.hint}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {lastTransactionUpdate && (
                    <div className="mt-4  p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-sm font-medium text-emerald-800">
                                    Real-time updates enabled
                                </span>
                            </div>
                            <span className="text-xs text-emerald-600">
                                Last update: {lastTransactionUpdate.toLocaleTimeString()}
                            </span>
                        </div>
                    </div>
                )}


                <div className="grid grid-cols-12 gap-5 items-start mt-6 lg:mt-8">
                    <div className="col-span-12 xl:col-span-8 flex flex-col gap-5">
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col h-[72vh] min-h-[560px] overflow-hidden" id="chat-section">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80">
                                <div className="flex items-center gap-2">
                                    <MessageCircle className="w-5 h-5 text-slate-600" />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Chat Room</p>
                                        <p className="text-xs text-slate-500">Semua percakapan tercatat</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <Activity className="w-4 h-4" />
                                    {messages.length} pesan
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
                                {isRoomExpired && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/80 backdrop-blur-[1px]">
                                        <div className="text-center p-6 bg-white rounded-2xl shadow-xl border border-red-100 max-w-sm mx-4">
                                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <Clock className="w-6 h-6 text-red-600" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-1">Room Expired</h3>
                                            <p className="text-sm text-slate-500 mb-4">
                                                This room has expired. Extend the duration to continue chatting and transacting.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            'flex',
                                            isCurrentUser(message.sender_role, message.sender_name) ? 'justify-end' : 'justify-start'
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'max-w-xs lg:max-w-md rounded-2xl px-4 py-3',
                                                isCurrentUser(message.sender_role, message.sender_name)
                                                    ? 'bg-blue-600 text-white'
                                                    : message.sender_role === 'gm'
                                                        ? 'bg-amber-100 border-amber-200 text-amber-900 shadow-sm'
                                                        : message.type === 'system'
                                                            ? 'bg-gray-100 text-gray-700 text-center'
                                                            : 'bg-white border border-slate-200 text-slate-900'
                                            )}
                                        >
                                            {!isCurrentUser(message.sender_role, message.sender_name) && message.type !== 'system' && (
                                                <p className="text-xs font-semibold mb-1 opacity-70">
                                                    {message.sender_name} ({message.sender_role})
                                                </p>
                                            )}

                                            {message.type === 'image' ? (
                                                <div className="mt-2">
                                                    {(() => {
                                                        const file = room.files?.find(f => f.file_path === message.message);
                                                        if (file) {
                                                            const imageUrl = `/rooms/${encrypted_room_id || room.id}/files/${file.id}`;
                                                            return (
                                                                <div className="space-y-2">
                                                                    <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 max-w-[200px]">
                                                                        <img
                                                                            src={imageUrl}
                                                                            alt={file.file_name}
                                                                            className="h-32 w-full object-cover transition duration-300 group-hover:scale-105"
                                                                        />
                                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition duration-300 group-hover:bg-black/30">
                                                                            <button
                                                                                onClick={() => {
                                                                                    setSelectedImage({ url: imageUrl, name: file.file_name });
                                                                                    setShowImageModal(true);
                                                                                }}
                                                                                className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 bg-white/90 text-slate-900 text-xs font-bold px-4 py-2 rounded-full shadow-lg hover:bg-white transition duration-300"
                                                                            >
                                                                                Lihat
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-500 truncate max-w-[200px] flex items-center gap-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                                                        {file.file_name}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }
                                                        return <p className="text-sm italic text-slate-500 break-all">{message.message}</p>;
                                                    })()}
                                                </div>
                                            ) : (
                                                <p className="text-sm whitespace-pre-line">{message.message}</p>
                                            )}
                                            <p className={cn(
                                                'text-xs mt-1',
                                                isCurrentUser(message.sender_role, message.sender_name)
                                                    ? 'text-blue-100'
                                                    : message.type === 'system'
                                                        ? 'text-gray-500'
                                                        : 'text-slate-500'
                                            )}>
                                                {formatTime(message.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="border-t border-slate-200 bg-white p-4">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        sendMessage(data.message);
                                    }}
                                    className="flex gap-2"
                                >
                                    <input
                                        type="text"
                                        value={data.message}
                                        onChange={(e) => setData('message', e.target.value)}
                                        placeholder={isRoomExpired ? "Room expired" : "Tulis pesan..."}
                                        className="flex-1 rounded-xl border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={processing || isRoomExpired}
                                    />
                                    <button
                                        type="submit"
                                        disabled={processing || !data.message.trim() || isRoomExpired}
                                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-12 xl:col-span-4 space-y-4">
                        <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl shadow-lg p-5 border border-slate-800">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-[11px] text-slate-300 uppercase tracking-wide">Ringkasan</p>
                                    <h3 className="text-base font-bold">Status peserta & escrow</h3>
                                </div>
                                <Shield className="w-4 h-4 text-slate-200" />
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
                                    <span className="text-slate-200">Status Room</span>
                                    <span className="font-semibold capitalize text-emerald-300">
                                        {room.status === 'free' ? 'Free' : 'In Use'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-blue-200" />
                                        <span className="text-slate-100">Buyer</span>
                                    </div>
                                    <span className="font-semibold text-blue-100">
                                        {room.buyer?.name ?? 'Belum bergabung'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart className="w-4 h-4 text-purple-200" />
                                        <span className="text-slate-100">Seller</span>
                                    </div>
                                    <span className="font-semibold text-purple-100">
                                        {room.seller?.name ?? 'Belum bergabung'}
                                    </span>
                                </div>
                            </div>

                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs" id="action-buttons">
                            {currentUser.role === 'buyer' && (!transactionData || transactionData.status === 'pending_payment') && (
                                <button
                                    onClick={() => setShowPaymentModal(true)}
                                    disabled={processing}
                                    className="rounded-lg bg-blue-500 text-white font-semibold py-2 hover:bg-blue-400 transition disabled:opacity-50 shadow-lg shadow-blue-500/25"
                                >
                                    Upload bukti bayar
                                </button>
                            )}
                            {currentUser.role === 'buyer' && (currentRoomStatus === 'shipped' || currentRoomStatus === 'awaiting_shipping_verification') && (
                                <button
                                    onClick={() => {
                                        if (confirm('Apakah Anda yakin barang sudah diterima dan sesuai? Dana akan diteruskan ke seller.')) {
                                            setProcessing(true);
                                            router.post(`/rooms/${encrypted_room_id || room.id}/confirm-receipt`, {}, {
                                                onSuccess: () => {
                                                    showToast('Barang berhasil dikonfirmasi!', 'success');
                                                    router.reload({ only: ['room'] });
                                                },
                                                onError: () => {
                                                    showToast('Gagal mengkonfirmasi barang.', 'error');
                                                },
                                                onFinish: () => setProcessing(false),
                                            });
                                        }
                                    }}
                                    disabled={processing}
                                    className="rounded-lg bg-blue-500 text-white font-semibold py-2 hover:bg-blue-400 transition disabled:opacity-50 shadow-lg shadow-blue-500/25"
                                >
                                    Konfirmasi Barang Diterima
                                </button>
                            )}
                            {currentUser.role === 'seller' && room.buyer && currentRoomStatus === 'paid' && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={processing}
                                    className="rounded-lg border border-purple-300/40 bg-purple-500/20 text-purple-50 font-semibold py-2 hover:bg-purple-500/30 transition disabled:opacity-50"
                                >
                                    Upload resi
                                </button>
                            )}
                            {currentUser.role === 'gm' && currentRoomStatus === 'goods_received' && (
                                <button
                                    onClick={() => {
                                        if (confirm('Apakah Anda yakin ingin merilis dana ke seller? Transaksi akan dianggap selesai.')) {
                                            setProcessing(true);
                                            router.post(`/rooms/${encrypted_room_id || room.id}/complete-transaction`, {}, {
                                                onSuccess: () => {
                                                    showToast('Dana berhasil dirilis!', 'success');
                                                    router.reload({ only: ['room'] });
                                                },
                                                onError: () => {
                                                    showToast('Gagal merilis dana.', 'error');
                                                },
                                                onFinish: () => setProcessing(false),
                                            });
                                        }
                                    }}
                                    disabled={processing}
                                    className="rounded-lg bg-emerald-500 text-white font-semibold py-2 hover:bg-emerald-400 transition disabled:opacity-50 shadow-lg shadow-emerald-500/25"
                                >
                                    Rilis Dana
                                </button>
                            )}
                            {currentUser.role === 'gm' && (
                                <button
                                    onClick={() => {
                                        if (confirm('Are you sure you want to reset this room? This will clear all sessions and messages.')) {
                                            router.post(`/gm/rooms/${room.id}/reset`);
                                        }
                                    }}
                                    className="rounded-lg border border-red-300/40 bg-red-500/20 text-red-700 font-semibold py-2 hover:bg-red-500/30 transition disabled:opacity-50"
                                >
                                    Reset Room
                                </button>
                            )}
                        </div>




                        <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-4" id="share-section">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Tautan Room</p>
                                    <h3 className="text-sm font-semibold text-slate-900">Bagikan & join</h3>
                                </div>
                                <button
                                    onClick={() => setShowJoinModal(true)}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                                >
                                    Buka modal join
                                </button>
                            </div>

                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs text-slate-600 font-medium">Aktifkan PIN</label>
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={pinEnabled}
                                        onChange={(e) => !share_links.pin_enabled && setPinEnabled(e.target.checked)}
                                        disabled={share_links.pin_enabled}
                                    />
                                    <div className={cn(
                                        'w-11 h-6 rounded-full transition-all',
                                        pinEnabled ? 'bg-blue-600' : 'bg-slate-300',
                                        share_links.pin_enabled && 'opacity-50 cursor-not-allowed'
                                    )}>
                                        <div className={cn(
                                            'w-5 h-5 bg-white rounded-full shadow transform transition-all',
                                            pinEnabled ? 'translate-x-5' : 'translate-x-1'
                                        )} />
                                    </div>
                                </label>
                            </div>
                            {pinEnabled && (
                                <div className="mb-3 flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={pinCode}
                                        onChange={(e) => setPinCode(e.target.value)}
                                        placeholder="PIN 6 digit"
                                        readOnly={!!share_links.pin_enabled}
                                        className={cn(
                                            "flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                                            share_links.pin_enabled && "bg-slate-100 text-slate-500"
                                        )}
                                    />
                                    {!share_links.pin_enabled && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const pin = generatePin();
                                                refreshShareLinks(pin);
                                                setPinEnabled(true);
                                            }}
                                            disabled={shareLoading}
                                            className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
                                        >
                                            {shareLoading ? 'Memuat...' : 'Generate'}
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="space-y-2 text-xs">
                                {(['buyer', 'seller'] as const).map((roleKey) => (
                                    <div key={roleKey} className="rounded-lg border border-slate-200 px-3 py-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-slate-700 capitalize">{roleKey}</span>
                                            <button
                                                onClick={async () => {
                                                    const existing = shareLinks?.[roleKey]?.join;
                                                    let linkToCopy = existing;
                                                    if (!linkToCopy) {
                                                        const updated = await refreshShareLinks(pinEnabled ? pinCode : undefined);
                                                        linkToCopy = updated?.[roleKey]?.join;
                                                    }
                                                    const success = await copyToClipboard(linkToCopy || '');
                                                    if (success) {
                                                        setCopiedRole(roleKey);
                                                        setTimeout(() => setCopiedRole(null), 1200);
                                                    }
                                                }}
                                                className="text-blue-600 hover:text-blue-700 font-semibold"
                                            >
                                                {copiedRole === roleKey ? 'Disalin' : 'Salin'}
                                            </button>
                                        </div>
                                        <p className="text-slate-500 break-all">
                                            {shareLinks?.[roleKey]?.join ?? '-'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            {pinEnabled && pinCode && (
                                <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
                                    PIN di dalam tautan ini wajib dimasukkan agar bisa join lewat link.
                                </div>
                            )}
                        </div>



                        <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-slate-900">Panduan Room</h3>
                                <button
                                    onClick={() => setStartTour(true)}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                                >
                                    Mulai Tour
                                </button>
                            </div>
                            <p className="text-sm text-slate-600">
                                Bingung cara menggunakan room ini? Ikuti tour interaktif kami.
                            </p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-4">
                            <h3 className="text-sm font-semibold text-slate-900 mb-2">Aktivitas Terbaru</h3>
                            {recentActivities.length > 0 ? (
                                <div className="space-y-2">
                                    {recentActivities.map((activity, index) => (
                                        <div key={index} className="rounded-lg border border-slate-200 px-3 py-2">
                                            <p className="text-sm font-semibold text-slate-800">{activity.description}</p>
                                            <p className="text-xs text-slate-500">{formatTime(activity.timestamp)}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">Belum ada aktivitas terbaru.</p>
                            )}
                        </div>


                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>
                </div>
            </div>

            {showJoinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-[11px] uppercase text-slate-500 font-semibold">Join Room</p>
                                <h3 className="text-lg font-bold text-slate-900">Kirim tautan aman</h3>
                            </div>
                            <button
                                onClick={() => setShowJoinModal(false)}
                                className="text-sm text-slate-500 hover:text-slate-700"
                            >
                                Tutup
                            </button>
                        </div>

                        <div className="mb-3 flex items-center gap-2 text-xs">
                            <span className="font-semibold text-slate-600">Role</span>
                            {(['buyer', 'seller'] as const).map((role) => (
                                <button
                                    key={role}
                                    onClick={() => setSelectedRole(role)}
                                    className={cn(
                                        'px-3 py-1 rounded-full border text-xs font-semibold transition',
                                        selectedRole === role
                                            ? 'border-slate-900 bg-slate-900 text-white'
                                            : 'border-slate-200 bg-slate-50 text-slate-600'
                                    )}
                                >
                                    {role === 'buyer' ? 'Buyer' : 'Seller'}
                                </button>
                            ))}
                        </div>

                        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                            <p className="text-xs text-slate-500 mb-1">Link join</p>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 text-sm text-slate-700 break-all">
                                    {shareLinks?.[selectedRole]?.join ?? '-'}
                                </div>
                                <button
                                    onClick={async () => {
                                        const existing = shareLinks?.[selectedRole]?.join;
                                        let linkToCopy = existing;
                                        if (!linkToCopy) {
                                            const updated = await refreshShareLinks(pinEnabled ? pinCode : undefined);
                                            linkToCopy = updated?.[selectedRole]?.join;
                                        }
                                        await copyToClipboard(linkToCopy || '');
                                    }}
                                    className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
                                >
                                    Salin
                                </button>
                            </div>
                            {pinEnabled && pinCode && (
                                <div className="mt-2 text-xs text-slate-600">
                                    PIN: <span className="font-semibold text-slate-900">{pinCode}</span> (wajib dimasukkan ketika membuka link)
                                </div>
                            )}
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                            Untuk keamanan, user harus masuk lewat tautan ini (disertai PIN jika diaktifkan).
                            Login langsung dari halaman room tidak diperbolehkan.
                        </p>
                    </div>
                </div>
            )
            }
            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
            />
        </>
    );
}
