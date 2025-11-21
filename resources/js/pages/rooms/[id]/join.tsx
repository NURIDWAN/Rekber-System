import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft, User, ShoppingCart, Lock, Shield, CheckCircle, XCircle } from 'lucide-react';

interface PageProps {
    room: {
        id: number;
        room_number: number;
        status: string;
        has_buyer: boolean;
        has_seller: boolean;
        buyer_name?: string;
        seller_name?: string;
    };
    role: 'buyer' | 'seller';
    errors?: Record<string, string>;
}

export default function JoinRoomPage({ room, role, errors: serverErrors = {} }: PageProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        phone: '',
        role: role,
    });

    const isBuyer = role === 'buyer';
    const isAvailable = isBuyer ? room.status === 'free' : room.status === 'in_use' && room.has_buyer;

    useEffect(() => {
        if (!isAvailable) {
            router.visit('/rooms');
        }
    }, [isAvailable]);

    useEffect(() => {
        // Merge server errors with form errors
        if (serverErrors && Object.keys(serverErrors).length > 0) {
            // Server errors will be automatically handled by Inertia
        }
    }, [serverErrors]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/rooms/${room.id}/join?role=${role}`, {
            onSuccess: () => {
                // Navigation will be handled by server redirect
                reset();
            },
            onError: (errors) => {
                console.error('Form errors:', errors);
            }
        });
    };

    if (!isAvailable) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center">
                <div className="text-center">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Room Not Available</h1>
                    <p className="text-slate-600 mb-6">
                        This room is not available for {isBuyer ? 'buyers' : 'sellers'} at the moment.
                    </p>
                    <Link
                        href="/rooms"
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Rooms
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <Head title={`Join Room #${room.room_number} - Rekber System`} />
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
                <div className="absolute inset-0 -z-10">
                    <div className="absolute left-[10%] top-20 h-64 w-64 rounded-full bg-[#7da1ff]/20 blur-[110px]" />
                    <div className="absolute right-[8%] top-32 h-72 w-72 rounded-full bg-[#ffd89b]/30 blur-[120px]" />
                </div>

                <div className="mx-auto max-w-2xl px-4 py-8 lg:px-6">
                    <Link
                        href="/rooms"
                        className="inline-flex items-center gap-2 rounded-xl bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white transition mb-6"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Rooms
                    </Link>

                    <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-2xl shadow-slate-200/60">
                        <div className={cn(
                            'bg-gradient-to-r p-6 text-white',
                            isBuyer
                                ? 'from-blue-600 to-blue-700'
                                : 'from-purple-600 to-purple-700'
                        )}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold">Join Room #{room.room_number}</h1>
                                    <p className="text-blue-100 mt-1">
                                        Enter your details to join as {isBuyer ? 'Buyer' : 'Seller'}
                                    </p>
                                </div>
                                <div className={cn(
                                    'flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20',
                                    isBuyer ? 'text-blue-100' : 'text-purple-100'
                                )}>
                                    {isBuyer ? (
                                        <User className="w-8 h-8" />
                                    ) : (
                                        <ShoppingCart className="w-8 h-8" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className={cn(
                                    'rounded-xl border p-4 text-center',
                                    room.has_buyer
                                        ? 'border-blue-200 bg-blue-50'
                                        : 'border-gray-200 bg-gray-50'
                                )}>
                                    <div className="flex items-center justify-center mb-2">
                                        <User className={cn(
                                            'w-6 h-6',
                                            room.has_buyer ? 'text-blue-600' : 'text-gray-400'
                                        )} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-700">Buyer</p>
                                    <p className="text-xs text-slate-500">
                                        {room.has_buyer ? room.buyer_name || 'Joined' : 'Empty'}
                                    </p>
                                </div>

                                <div className={cn(
                                    'rounded-xl border p-4 text-center',
                                    room.has_seller
                                        ? 'border-purple-200 bg-purple-50'
                                        : 'border-gray-200 bg-gray-50'
                                )}>
                                    <div className="flex items-center justify-center mb-2">
                                        <ShoppingCart className={cn(
                                            'w-6 h-6',
                                            room.has_seller ? 'text-purple-600' : 'text-gray-400'
                                        )} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-700">Seller</p>
                                    <p className="text-xs text-slate-500">
                                        {room.has_seller ? room.seller_name || 'Joined' : 'Empty'}
                                    </p>
                                </div>
                            </div>

                            {errors.general && (
                                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4">
                                    <p className="text-sm text-red-600">{errors.general}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                                        Your Name
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className={cn(
                                            'w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                                            errors.name
                                                ? 'border-red-300 bg-red-50'
                                                : 'border-slate-300 focus:border-blue-500'
                                        )}
                                        placeholder="Enter your full name"
                                        required
                                    />
                                    {errors.name && (
                                        <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        id="phone"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        className={cn(
                                            'w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                                            errors.phone
                                                ? 'border-red-300 bg-red-50'
                                                : 'border-slate-300 focus:border-blue-500'
                                        )}
                                        placeholder="+62 812-3456-7890"
                                        required
                                    />
                                    {errors.phone && (
                                        <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
                                    )}
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-blue-900">
                                                Secure {isBuyer ? 'Buyer' : 'Seller'} Protection
                                            </p>
                                            <p className="text-xs text-blue-700 mt-1">
                                                {isBuyer
                                                    ? 'Your payment will be held in escrow until you confirm receipt of goods.'
                                                    : 'You will receive payment after the buyer confirms receipt of goods.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing || !data.name || !data.phone}
                                    className={cn(
                                        'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition',
                                        isBuyer
                                            ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'
                                            : 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300',
                                        'disabled:cursor-not-allowed'
                                    )}
                                >
                                    {processing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Joining Room...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Join as {isBuyer ? 'Buyer' : 'Seller'}
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <p className="text-xs text-slate-500">
                                    By joining this room, you agree to our terms of service and escrow policies.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}