import { Head, Link, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
    ArrowRight,
    User,
    ShoppingCart,
    CheckCircle,
    XCircle,
    Wifi,
} from 'lucide-react';

interface Room {
    id: number;
    room_number: number;
    status: 'free' | 'in_use';
    has_buyer: boolean;
    has_seller: boolean;
    buyer_name?: string;
    seller_name?: string;
    buyer_online: boolean;
    seller_online: boolean;
    available_for_buyer: boolean;
    available_for_seller: boolean;
}

interface PageProps {
    rooms: Room[];
}

export default function RoomsPage({ rooms: initialRooms }: PageProps) {
    const [rooms, setRooms] = useState<Room[]>(initialRooms);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            // Refresh data setiap 30 detik
            setLoading(true);
            router.reload({ only: ['rooms'], onFinish: () => setLoading(false) });
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Update rooms when props change
    useEffect(() => {
        setRooms(initialRooms);
    }, [initialRooms]);

    if (loading && rooms.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Refreshing rooms...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <Head title="Rooms - Rekber System" />
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
                <div className="absolute inset-0 -z-10">
                    <div className="absolute left-[10%] top-20 h-64 w-64 rounded-full bg-[#7da1ff]/20 blur-[110px]" />
                    <div className="absolute right-[8%] top-32 h-72 w-72 rounded-full bg-[#ffd89b]/30 blur-[120px]" />
                </div>

                <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
                    <div className="text-center mb-10">
                        <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
                            Rekber Room System
                        </h1>
                        <p className="mt-4 text-lg text-slate-600">
                            Choose a room to start your secure transaction
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {rooms.map((room) => (
                            <div
                                key={room.id}
                                className={cn(
                                    'relative rounded-2xl border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
                                    room.status === 'free'
                                        ? 'border-green-200 bg-gradient-to-br from-green-50 to-white'
                                        : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'
                                )}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-lg font-bold text-slate-900">
                                        #{room.room_number}
                                    </span>
                                    <span
                                        className={cn(
                                            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
                                            room.status === 'free'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-amber-100 text-amber-700'
                                        )}
                                    >
                                        {room.status === 'free' ? (
                                            <>
                                                <CheckCircle className="w-3 h-3" />
                                                Free
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="w-3 h-3" />
                                                In Use
                                            </>
                                        )}
                                    </span>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Buyer:</span>
                                        {room.has_buyer ? (
                                            <div className="flex items-center gap-1">
                                                <User className="w-3 h-3 text-blue-500" />
                                                <span className="text-xs font-medium text-slate-700">
                                                    {room.buyer_name}
                                                </span>
                                                <Wifi className="w-3 h-3 text-green-500" />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <div className="w-3 h-3 border-2 border-dashed border-gray-300 rounded-full"></div>
                                                <span className="text-xs text-gray-400">Empty</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Seller:</span>
                                        {room.has_seller ? (
                                            <div className="flex items-center gap-1">
                                                <ShoppingCart className="w-3 h-3 text-purple-500" />
                                                <span className="text-xs font-medium text-slate-700">
                                                    {room.seller_name}
                                                </span>
                                                <Wifi className="w-3 h-3 text-green-500" />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <div className="w-3 h-3 border-2 border-dashed border-gray-300 rounded-full"></div>
                                                <span className="text-xs text-gray-400">Empty</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Link
                                        href={`/rooms/${room.id}/join?role=buyer`}
                                        className={cn(
                                            'w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition',
                                            room.available_for_buyer
                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        )}
                                        onClick={(e) => {
                                            if (!room.available_for_buyer) {
                                                e.preventDefault();
                                            }
                                        }}
                                    >
                                        <User className="w-3 h-3" />
                                        Join as Buyer
                                    </Link>

                                    <Link
                                        href={`/rooms/${room.id}/join?role=seller`}
                                        className={cn(
                                            'w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition',
                                            room.available_for_seller
                                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        )}
                                        onClick={(e) => {
                                            if (!room.available_for_seller) {
                                                e.preventDefault();
                                            }
                                        }}
                                    >
                                        <ShoppingCart className="w-3 h-3" />
                                        Join as Seller
                                    </Link>

                                    {room.has_buyer || room.has_seller ? (
                                        <Link
                                            href={`/rooms/${room.id}/enter`}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                                        >
                                            <ArrowRight className="w-3 h-3" />
                                            Enter Room
                                        </Link>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 text-center">
                        <div className="inline-flex items-center gap-6 rounded-2xl bg-white/80 px-6 py-4 shadow-sm ring-1 ring-slate-200">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-sm font-medium text-slate-700">Available Room</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                                <span className="text-sm font-medium text-slate-700">Room in Use</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-medium text-slate-700">Buyer Joined</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <ShoppingCart className="w-4 h-4 text-purple-500" />
                                <span className="text-sm font-medium text-slate-700">Seller Joined</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}