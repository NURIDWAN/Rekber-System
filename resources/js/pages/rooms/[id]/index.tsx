import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
    ArrowLeft,
    Send,
    Upload,
    User,
    ShoppingCart,
    Wifi,
    WifiOff,
    CheckCircle,
    Clock,
    Image as ImageIcon,
    Download,
    Eye,
    EyeOff,
    Lock,
    Shield,
    MessageCircle,
    Activity,
    Camera,
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

interface PageProps {
    room: RoomData;
    currentUser: {
        role: string;
        name: string;
        is_online: boolean;
    };
}

export default function RoomPage({ room, currentUser }: PageProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        message: '',
        type: 'text',
    });

    const [messages, setMessages] = useState(room.messages || []);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        // Simulate connection status
        setConnectionStatus('connected');
    }, []);

    const sendMessage = (messageText: string, type: string = 'text') => {
        if (!messageText.trim() && type === 'text') return;

        setData('message', messageText);
        setData('type', type);

        post(`/rooms/${room.id}/message`, {
            onSuccess: () => {
                setData('message', '');
                // Messages will be reloaded from server
                router.reload({ only: ['room'] });
            },
            onError: (errors) => {
                console.error('Message errors:', errors);
            }
        });
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('file_type', currentUser.role === 'buyer' ? 'payment_proof' : 'shipping_receipt');

        router.post(`/rooms/${room.id}/upload`, formData, {
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
        router.post(`/rooms/${room.id}/leave`, {}, {
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

    return (
        <>
            <Head title={`Room #${room.room_number} - Rekber System`} />
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
                <div className="absolute inset-0 -z-10">
                    <div className="absolute left-[10%] top-20 h-64 w-64 rounded-full bg-[#7da1ff]/20 blur-[110px]" />
                    <div className="absolute right-[8%] top-32 h-72 w-72 rounded-full bg-[#ffd89b]/30 blur-[120px]" />
                </div>

                <div className="flex h-screen">
                    {/* Sidebar */}
                    <div className="w-80 bg-white/90 border-r border-slate-200 flex flex-col">
                        <div className="p-4 border-b border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                                <Link
                                    href="/rooms"
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </Link>
                                <button
                                    onClick={handleLeaveRoom}
                                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                                >
                                    Leave Room
                                </button>
                            </div>
                            <div className="text-center">
                                <h1 className="text-xl font-bold text-slate-900">Room #{room.room_number}</h1>
                                <div className="flex items-center justify-center gap-2 mt-1">
                                    <div className={cn(
                                        'w-2 h-2 rounded-full',
                                        connectionStatus === 'connected' ? 'bg-green-500' :
                                        connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                                    )}></div>
                                    <span className="text-xs text-slate-500 capitalize">
                                        {connectionStatus}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div className="space-y-3">
                                {room.buyer && (
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-blue-600" />
                                                <span className="font-medium text-blue-900">Buyer</span>
                                            </div>
                                            {room.buyer.is_online ? (
                                                <Wifi className="w-3 h-3 text-green-500" />
                                            ) : (
                                                <WifiOff className="w-3 h-3 text-gray-400" />
                                            )}
                                        </div>
                                        <p className="text-sm text-blue-800">{room.buyer.name}</p>
                                        <p className="text-xs text-blue-600">Joined {formatTime(room.buyer.joined_at)}</p>
                                    </div>
                                )}

                                {room.seller && (
                                    <div className="rounded-xl border border-purple-200 bg-purple-50 p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <ShoppingCart className="w-4 h-4 text-purple-600" />
                                                <span className="font-medium text-purple-900">Seller</span>
                                            </div>
                                            {room.seller.is_online ? (
                                                <Wifi className="w-3 h-3 text-green-500" />
                                            ) : (
                                                <WifiOff className="w-3 h-3 text-gray-400" />
                                            )}
                                        </div>
                                        <p className="text-sm text-purple-800">{room.seller.name}</p>
                                        <p className="text-xs text-purple-600">Joined {formatTime(room.seller.joined_at)}</p>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-slate-200 pt-4">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">Transaction Status</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        <span className="text-sm text-slate-600">Room Created</span>
                                    </div>
                                    {room.buyer && (
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span className="text-sm text-slate-600">Buyer Joined</span>
                                        </div>
                                    )}
                                    {room.seller && (
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span className="text-sm text-slate-600">Seller Joined</span>
                                        </div>
                                    )}
                                    {!room.buyer && (
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-yellow-500" />
                                            <span className="text-sm text-slate-600">Waiting for Buyer</span>
                                        </div>
                                    )}
                                    {room.buyer && !room.seller && (
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-yellow-500" />
                                            <span className="text-sm text-slate-600">Waiting for Seller</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-slate-200 pt-4">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">Actions</h3>
                                <div className="space-y-2">
                                    {currentUser.role === 'buyer' && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={processing}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                                        >
                                            <Upload className="w-3 h-3" />
                                            {processing ? 'Uploading...' : 'Upload Payment Proof'}
                                        </button>
                                    )}
                                    {currentUser.role === 'seller' && room.buyer && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={processing}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition disabled:opacity-50"
                                        >
                                            <Camera className="w-3 h-3" />
                                            {processing ? 'Uploading...' : 'Upload Shipping Receipt'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>

                        <div className="p-4 border-t border-slate-200">
                            <div className="rounded-xl bg-slate-100 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Shield className="w-4 h-4 text-slate-600" />
                                    <span className="text-xs font-semibold text-slate-700">Security</span>
                                </div>
                                <p className="text-xs text-slate-600">
                                    This room is protected by escrow system. Your information is encrypted and secure.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col">
                        <div className="bg-white/90 border-b border-slate-200 p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <MessageCircle className="w-5 h-5 text-slate-600" />
                                        <span className="font-semibold text-slate-900">Chat Room</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <Activity className="w-3 h-3" />
                                        {messages.length} messages
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        'px-2 py-1 rounded-full text-xs font-semibold',
                                        currentUser.role === 'buyer'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-purple-100 text-purple-700'
                                    )}>
                                        {currentUser.role === 'buyer' ? 'Buyer' : 'Seller'}
                                    </span>
                                    <span className="text-sm font-medium text-slate-700">
                                        {currentUser.name}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                                        <p className="text-sm">{message.message}</p>
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

                        <div className="bg-white/90 border-t border-slate-200 p-4">
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
                                    placeholder="Type your message..."
                                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            </div>
        </>
    );
}