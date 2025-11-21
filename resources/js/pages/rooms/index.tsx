import { useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
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

import MarketingLayout from '@/layouts/marketing-layout';
import { cn } from '@/lib/utils';

type RoomStatus = 'free' | 'in-use';

type Room = {
    id: number;
    status: RoomStatus;
    lastActivity: string;
    participants: string[];
};

const rooms: Room[] = [
    { id: 1, status: 'free', lastActivity: '3 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 2, status: 'in-use', lastActivity: '5 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 3, status: 'in-use', lastActivity: '9 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 4, status: 'free', lastActivity: '14 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 5, status: 'in-use', lastActivity: '58 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 6, status: 'free', lastActivity: '23 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 7, status: 'in-use', lastActivity: '22 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 8, status: 'free', lastActivity: '33 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 9, status: 'free', lastActivity: '47 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 10, status: 'in-use', lastActivity: '18 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 11, status: 'free', lastActivity: '30 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 12, status: 'in-use', lastActivity: '33 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 13, status: 'in-use', lastActivity: '48 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 14, status: 'free', lastActivity: '26 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 15, status: 'in-use', lastActivity: '30 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 16, status: 'free', lastActivity: '35 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 17, status: 'free', lastActivity: '38 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 18, status: 'free', lastActivity: '44 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 19, status: 'free', lastActivity: '50 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 20, status: 'in-use', lastActivity: '57 min ago', participants: ['Buyer', 'Seller', 'GM'] },
    { id: 21, status: 'free', lastActivity: '61 min ago', participants: ['Buyer', 'Seller', 'GM'] },
];

const filters: { label: string; value: RoomStatus | 'all' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Free', value: 'free' },
    { label: 'In Use', value: 'in-use' },
];

export default function RoomsIndex() {
    const [active, setActive] = useState<(typeof filters)[number]['value']>('all');
    const [search, setSearch] = useState('');

    const filtered = useMemo(
        () =>
            rooms.filter((room) => {
                const matchFilter = active === 'all' ? true : room.status === active;
                const matchSearch = room.id
                    .toString()
                    .toLowerCase()
                    .includes(search.toLowerCase());
                return matchFilter && matchSearch;
            }),
        [active, search],
    );

    return (
        <MarketingLayout
            title="Rooms – RoomEscrow"
            description="Pilih room escrow yang siap dipakai atau cek aktivitas terbaru."
            className="font-['Sora','Plus_Jakarta_Sans',sans-serif]"
        >
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
                        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                            <Zap className="size-4 text-amber-500" />
                            Live synced
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
                    {filtered.map((room) => (
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
                                {room.participants.join('  •  ')}
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                                <Clock4 className="size-4" />
                                Last activity: {room.lastActivity}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Link
                                    href={`/rooms/${room.id}`}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2a4bff] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-300 transition hover:-translate-y-0.5"
                                >
                                    {room.status === 'free' ? 'Join Room' : 'Enter Room'}
                                </Link>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                                >
                                    <Link2 className="size-4" />
                                </button>
                            </div>
                        </div>
                    ))}
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
                        href="/rooms/3"
                        className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-800/10 transition hover:-translate-y-0.5"
                    >
                        Lihat contoh room detail
                        <ArrowRight className="size-4" />
                    </Link>
                </div>
            </section>
        </MarketingLayout>
    );
}
