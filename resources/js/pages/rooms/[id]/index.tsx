import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

import RoomsNavbar from '@/components/RoomsNavbar';
import {
    listenToMessages,
    listenToUserStatus,
    listenToActivities,
    listenToFileUploads,
    getConnectionStatus,
    onConnectionEstablished,
    onConnectionError,
    onConnectionDisconnected,
    unsubscribeFromRoom,
} from '@/lib/websocket';
import {
    Send,
    User,
    Users,
    ShoppingCart,
    Shield,
    MessageCircle,
    Activity,
} from 'lucide-react';

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
        role: string;
        name: string;
        is_online: boolean;
    };
    share_links: ShareLinks;
    encrypted_room_id?: string;
}

export default function RoomPage({ room, currentUser, share_links, encrypted_room_id }: PageProps) {
    const { data, setData } = useForm({
        message: '',
        type: 'text',
    });
    const [processing, setProcessing] = useState(false);

    const [messages, setMessages] = useState(room.messages || []);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
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

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('file_type', currentUser.role === 'buyer' ? 'payment_proof' : 'shipping_receipt');

        router.post(`/rooms/${encrypted_room_id || room.id}/upload`, formData, {
            onSuccess: (page) => {
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                // Reload messages to show the uploaded file
                router.reload({ only: ['room'] });
            },
            onError: (errors) => {
                console.error('Upload errors:', errors);
            }
        });
    };

    const handleLeaveRoom = () => {
        router.post(`/rooms/${encrypted_room_id || room.id}/leave`, {}, {
            onSuccess: () => {
                router.visit('/rooms');
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
        payment_rejected: 1,
        payment_verified: 2,
        shipped: 3,
        goods_received: 4,
        completed: 5,
    };

    const statusMeta: Record<string, { label: string; tone: 'slate' | 'amber' | 'blue' | 'violet' | 'emerald' | 'red' }> = {
        free: { label: 'Menunggu peserta', tone: 'slate' },
        in_use: { label: 'Sedang berjalan', tone: 'blue' },
        payment_pending: { label: 'Menunggu verifikasi pembayaran', tone: 'amber' },
        payment_rejected: { label: 'Bukti pembayaran ditolak', tone: 'red' },
        payment_verified: { label: 'Menunggu pengiriman seller', tone: 'blue' },
        shipped: { label: 'Menunggu konfirmasi buyer', tone: 'violet' },
        goods_received: { label: 'Menunggu rilis dana', tone: 'violet' },
        completed: { label: 'Dana dirilis', tone: 'emerald' },
    };

    const currentStepIndex = Math.min(
        transactionSteps.length,
        statusToStepIndex[room.status] ?? (hasBuyer ? 1 : 0)
    );

    const progressState = transactionSteps.map((step, idx) => {
        const stepNumber = idx + 1;
        let state: 'done' | 'current' | 'pending' | 'error' = 'pending';

        if (room.status === 'payment_rejected' && step.key === 'payment_verified') {
            state = 'error';
        } else if (stepNumber < currentStepIndex) {
            state = 'done';
        } else if (stepNumber === currentStepIndex) {
            state = room.status === 'payment_rejected' ? 'error' : 'current';
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
    const statusInfo = statusMeta[room.status] ?? statusMeta.in_use;

    return (
        <>
            <Head title={`Room #${room.room_number} - Rekber System`} />
            <div className="min-h-screen bg-slate-50">
                <RoomsNavbar
                    roomNumber={room.room_number}
                    roomStatus={room.status}
                    connectionStatus={connectionStatus}
                    onLeaveRoom={handleLeaveRoom}
                    currentUser={currentUser}
                    encryptedRoomId={encrypted_room_id}
                />

                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="mb-4">
                        <div className="flex items-center gap-3">
                            <div>
                                <p className="text-xs text-slate-500">Visual Process Hub</p>
                                <h1 className="text-xl font-bold text-slate-900">Room #{room.room_number}</h1>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-6">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <span className={cn(
                                'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ring-1',
                                toneClasses[statusInfo.tone]
                            )}>
                                <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                                {statusInfo.label}
                            </span>
                            <div className="ml-auto flex flex-wrap gap-2 text-xs font-semibold">
                                <span className={cn(
                                    'inline-flex items-center gap-1 px-2 py-1 rounded-full ring-1 ring-slate-200',
                                    hasBuyer ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                                )}>
                                    {hasBuyer ? 'Buyer aktif' : 'Buyer belum join'}
                                </span>
                                <span className={cn(
                                    'inline-flex items-center gap-1 px-2 py-1 rounded-full ring-1 ring-slate-200',
                                    hasSeller ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'
                                )}>
                                    {hasSeller ? 'Seller aktif' : 'Seller belum join'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
                            <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-2xl shadow-lg flex flex-col h-[70vh] min-h-[520px] overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
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

                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-white to-slate-50 max-h-full">
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
                                                <p className="text-sm whitespace-pre-line">{message.message}</p>
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

                                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
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
                                            placeholder="Tulis pesan..."
                                            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                            disabled={processing}
                                        />
                                        <button
                                            type="submit"
                                            disabled={processing || !data.message.trim()}
                                            className="flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {processing ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            ) : (
                                                <Send className="w-4 h-4" />
                                            )}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-12 lg:col-span-4 space-y-4">
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

                                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                    {currentUser.role === 'buyer' && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={processing}
                                            className="rounded-lg border border-blue-300/40 bg-blue-500/20 text-blue-50 font-semibold py-2 hover:bg-blue-500/30 transition disabled:opacity-50"
                                        >
                                            Upload bukti bayar
                                        </button>
                                    )}
                                    {currentUser.role === 'seller' && room.buyer && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={processing}
                                            className="rounded-lg border border-purple-300/40 bg-purple-500/20 text-purple-50 font-semibold py-2 hover:bg-purple-500/30 transition disabled:opacity-50"
                                        >
                                            Upload resi
                                        </button>
                                    )}
                                    <button
                                        onClick={handleLeaveRoom}
                                        className="rounded-lg border border-white/10 bg-white/5 text-slate-100 font-semibold py-2 hover:bg-white/10 transition"
                                    >
                                        Keluar room
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
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
                                            onChange={(e) => setPinEnabled(e.target.checked)}
                                        />
                                        <div className={cn(
                                            'w-11 h-6 rounded-full transition-all',
                                            pinEnabled ? 'bg-blue-600' : 'bg-slate-300'
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
                                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
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

                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                                <h3 className="text-sm font-semibold text-slate-900 mb-2">Tutorial Transaksi</h3>
                                <p className="text-sm text-slate-600 mb-3">Panduan singkat agar semua role memahami alur.</p>
                                <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
                                    <li><span className="font-semibold">Buyer join & unggah bukti.</span> Isi form join, upload bukti pembayaran agar GM mengecek dana.</li>
                                    <li><span className="font-semibold">GM konfirmasi pembayaran.</span> GM menerima notifikasi lalu mengubah status jadi siap kirim.</li>
                                    <li><span className="font-semibold">Seller kirim barang.</span> Setelah status menunggu resi, seller unggah bukti pengiriman.</li>
                                    <li><span className="font-semibold">GM rilis dana.</span> Jika resi valid, GM melepas dana dan room kembali FREE.</li>
                                </ol>
                                <div className="mt-3 rounded-lg bg-slate-50 border border-dashed border-slate-200 p-3 text-xs text-slate-600">
                                    Simpan tautan join baik-baik. Jika link tersebar, GM dapat reset room demi keamanan.
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
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

                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl shadow-sm p-4">
                                <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-600" />
                                    Kelola Undangan
                                </h3>
                                <p className="text-sm text-slate-600 mb-3">
                                    Buat undangan aman dengan PIN untuk buyer dan seller.
                                </p>
                                <Link
                                    href={`/rooms/${room.id}/invitations`}
                                    className="block w-full text-center bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition"
                                >
                                    Kelola Undangan
                                </Link>
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
            )}
        </>
    );
}
