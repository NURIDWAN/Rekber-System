import { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    Clock4,
    Link2,
    Search,
    ShieldCheck,
    Users,
    Zap,
} from 'lucide-react';

import RoomsNavbar from '@/components/RoomsNavbar';
import ShareRoomModal from '@/components/ShareRoomModal';
import JoinRoomModal from '@/components/JoinRoomModal';
import { useRealtimeRooms } from '@/hooks/useRealtimeRooms';
import { cn } from '@/lib/utils';
import { getRoomUrl, getJoinUrl } from '@/lib/roomUrlUtils';

type RoomStatus = 'free' | 'in-use';

type Room = {
    id: number;
    status: RoomStatus;
    lastActivity?: string;
    participants?: string[];
    has_buyer?: boolean;
    has_seller?: boolean;
    available_for_buyer?: boolean;
    available_for_seller?: boolean;
    room_number?: number;
    links?: {
        buyer: { join: string; enter: string };
        seller: { join: string; enter: string };
    };
    encrypted_urls?: {
        show: string;
        join: string;
        join_seller: string;
        pin?: string;
        pin_enabled?: boolean;
    };
};

type RoomsPageProps = {
    rooms: Room[];
};

const filters: { label: string; value: RoomStatus | 'all' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Free', value: 'free' },
    { label: 'In Use', value: 'in-use' },
];

export default function RoomsIndex({ rooms }: RoomsPageProps) {
    const [active, setActive] = useState<(typeof filters)[number]['value']>('all');
    const [search, setSearch] = useState('');
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [joinModalOpen, setJoinModalOpen] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

    const { rooms: realtimeRooms, isConnected, connectionError, isRoomAvailableForSharing } = useRealtimeRooms(rooms);

    const filtered = useMemo(
        () =>
            realtimeRooms.filter((room) => {
                const matchFilter = active === 'all' ? true : room.status === active;
                const matchSearch = room.id
                    .toString()
                    .toLowerCase()
                    .includes(search.toLowerCase());
                return matchFilter && matchSearch;
            }),
        [active, search, realtimeRooms],
    );

    const handleShareClick = (room: Room) => {
        setSelectedRoom(room);
        setShareModalOpen(true);
    };

    const handleCloseShareModal = () => {
        setShareModalOpen(false);
        setSelectedRoom(null);
    };

    const handleJoinClick = (room: Room) => {
        setSelectedRoom(room);
        setJoinModalOpen(true);
    };

    const handleCloseJoinModal = () => {
        setJoinModalOpen(false);
        setSelectedRoom(null);
    };

    return (
        <>
            <Head title="Rooms – RoomEscrow" />
            <div className="min-h-screen bg-gradient-to-b from-[#eef2ff] via-white to-[#eef7ff]">
                <RoomsNavbar />

                <main className="font-['Sora','Plus_Jakarta_Sans',sans-serif]">
            <section className="mx-auto max-w-6xl px-4 pt-12 lg:px-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2a4bff]">
                            Escrow Rooms
                        </p>
                        <h1 className="mt-2 text-4xl font-bold text-slate-900">
                            Pilih room yang siap digunakan.
                        </h1>
                        <p className="mt-2 text-slate-600">
                            Setiap room memiliki buyer, seller, dan GM dengan status real-time.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/gm/login"
                            className="flex items-center gap-2 rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-purple-700 hover:-translate-y-0.5"
                        >
                            <ShieldCheck className="size-4" />
                            GM Portal
                        </Link>
                        <div
                        className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm ring-1 cursor-pointer transition-all ${
                            isConnected
                                ? 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                                : connectionError
                                    ? 'bg-orange-50 text-orange-700 ring-orange-200 hover:bg-orange-100'
                                    : 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100'
                        }`}
                        title={connectionError || (isConnected ? 'WebSocket connected' : 'WebSocket disconnected')}
                    >
                            <Zap className={`size-4 ${isConnected ? 'text-amber-500' : connectionError ? 'text-orange-500' : 'text-red-500'}`} />
                            {isConnected ? 'Live synced' : connectionError ? 'Connection issue' : 'Connection lost'}
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/80 p-4 shadow-[0_20px_60px_-28px_rgba(26,46,96,0.35)] ring-1 ring-slate-100 backdrop-blur lg:flex-row lg:items-center lg:gap-6">
                    <div className="flex flex-wrap items-center gap-2">
                        {filters.map((filter) => (
                            <button
                                key={filter.value}
                                type="button"
                                onClick={() => setActive(filter.value)}
                                className={cn(
                                    'rounded-full px-4 py-2 text-sm font-semibold transition',
                                    active === filter.value
                                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
                                )}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex w-full flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                        <Search className="size-4 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search room number..."
                            className="w-full border-none bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 pb-16 pt-6 lg:px-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((room) => {
                        // Use helper functions to get proper encrypted URLs
                        const joinAction = getJoinUrl(room);
                        const joinLink = joinAction?.url;
                        const joinLabel = joinAction?.label || 'Join Room';
                        const joinDisabled = !joinLink;

                        // Prepare share links for modal
                        const shareLinks = {
                            buyer: {
                                join: room.encrypted_urls?.join || '',
                                enter: room.links?.buyer?.enter || ''
                            },
                            seller: {
                                join: room.encrypted_urls?.join_seller || '',
                                enter: room.links?.seller?.enter || ''
                            },
                            pin: room.encrypted_urls?.pin,
                            pin_enabled: room.encrypted_urls?.pin_enabled
                        };

                        return (
                            <div
                                key={room.id}
                                className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_20px_60px_-28px_rgba(26,46,96,0.35)] ring-1 ring-slate-100 backdrop-blur transition hover:-translate-y-1 hover:shadow-2xl"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-500">
                                            Room #{room.id.toString().padStart(2, '0')}
                                        </p>
                                        <p className="text-base font-semibold text-slate-900">
                                            Participants
                                        </p>
                                    </div>
                                    <span
                                        className={cn(
                                            'rounded-full px-3 py-1 text-xs font-bold',
                                            room.status === 'free'
                                                ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
                                                : 'bg-rose-50 text-rose-600 ring-1 ring-rose-100',
                                        )}
                                    >
                                        {room.status === 'free' ? 'Free' : 'In Use'}
                                    </span>
                                </div>
                                <div className="mt-3 flex items-center gap-2 text-slate-600">
                                    <Users className="size-4 text-slate-500" />
                                    {room.participants?.join('  •  ') ?? 'Buyer  •  Seller  •  GM'}
                                </div>
                                <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                                    <Clock4 className="size-4" />
                                    Last activity: {room.lastActivity || 'Just now'}
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    {joinLink ? (
                                        <button
                                            type="button"
                                            onClick={() => handleJoinClick(room)}
                                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2a4bff] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-300 transition hover:-translate-y-0.5"
                                        >
                                            {joinLabel}
                                        </button>
                                    ) : (
                                        <div className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-400 ring-1 ring-gray-200 cursor-not-allowed">
                                            {joinLabel}
                                        </div>
                                    )}
                                    {isRoomAvailableForSharing(room) ? (
                                        <button
                                            type="button"
                                            onClick={() => handleShareClick(room)}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                                            title="Share room link"
                                        >
                                            <Link2 className="size-4" />
                                        </button>
                                    ) : (
                                        <div className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-400 ring-1 ring-gray-200 cursor-not-allowed">
                                            <Link2 className="size-4" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 pb-16 lg:px-6">
                <div className="grid gap-4 rounded-3xl border border-white/70 bg-slate-900 p-6 text-white shadow-[0_20px_60px_-28px_rgba(26,46,96,0.35)]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-200">
                                Built for trust
                            </p>
                            <h2 className="text-2xl font-bold">
                                Audit log, escrow vaults, and identity verification.
                            </h2>
                        </div>
                        <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
                            <ShieldCheck className="size-4" />
                            Security-first
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-100">
                                <BadgeCheck className="size-4" />
                                Verified roles
                            </div>
                            <p className="mt-2 text-sm text-indigo-100/80">
                                Buyer, seller, dan GM memiliki izin dan batasan yang jelas.
                            </p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-100">
                                <Clock4 className="size-4" />
                                Activity log
                            </div>
                            <p className="mt-2 text-sm text-indigo-100/80">
                                Semua aksi dicatat: kunci escrow, unggah file, tanda terima.
                            </p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-100">
                                <Link2 className="size-4" />
                                Integrasi cepat
                            </div>
                            <p className="mt-2 text-sm text-indigo-100/80">
                                API dan webhook untuk sinkronisasi invoice atau marketplace.
                            </p>
                        </div>
                    </div>
                    <Link
                        href={rooms.length > 0 ? getRoomUrl(rooms[0]) : "/rooms/3"}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-800/10 transition hover:-translate-y-0.5"
                    >
                        Lihat contoh room detail
                        <ArrowRight className="size-4" />
                    </Link>
                </div>
            </section>

            {/* Share Room Modal */}
            {selectedRoom && (
                <ShareRoomModal
                    isOpen={shareModalOpen}
                    onClose={handleCloseShareModal}
                    roomId={selectedRoom.id}
                    roomNumber={selectedRoom.room_number?.toString() || selectedRoom.id.toString()}
                    roomStatus={selectedRoom.status}
                    needsBuyer={selectedRoom.available_for_buyer || false}
                    needsSeller={selectedRoom.available_for_seller || false}
                    tokenExpiryMinutes={5}
                />
            )}

            {/* Join Room Modal */}
            {selectedRoom && (
                <JoinRoomModal
                    isOpen={joinModalOpen}
                    onClose={handleCloseJoinModal}
                    roomId={selectedRoom.id}
                    roomNumber={selectedRoom.room_number?.toString() || selectedRoom.id.toString()}
                    roomStatus={selectedRoom.status as 'free' | 'in_use'}
                    shareLinks={{
                        buyer: {
                            join: selectedRoom.encrypted_urls?.join || '',
                            enter: selectedRoom.links?.buyer?.enter || ''
                        },
                        seller: {
                            join: selectedRoom.encrypted_urls?.join_seller || '',
                            enter: selectedRoom.links?.seller?.enter || ''
                        },
                        pin: selectedRoom.encrypted_urls?.pin,
                        pin_enabled: selectedRoom.encrypted_urls?.pin_enabled
                    }}
                />
            )}

                {/* Footer */}
                </main>

                <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-sm text-slate-600 lg:px-6 mt-16">
                    <div className="flex flex-col gap-4 border-t border-slate-200/70 pt-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                                <ShieldCheck className="size-5" />
                            </div>
                            <div>
                                <p className="text-base font-semibold text-slate-900">
                                    RoomEscrow
                                </p>
                                <p>Secure trades, transparent collaboration.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <a href="/terms" className="hover:text-slate-900">Terms</a>
                            <a href="/privacy" className="hover:text-slate-900">Privacy</a>
                            <a href="/contact" className="hover:text-slate-900">Contact</a>
                            <p className="text-slate-400">© 2024 RoomEscrow</p>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
