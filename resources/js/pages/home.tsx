import MarketingLayout from '@/layouts/marketing-layout';
import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { getRoomUrl } from '@/lib/roomUrlUtils';
import {
    ArrowRight,
    Check,
    Clock3,
    Globe2,
    Lock,
    Shield,
    Sparkles,
    Users2,
} from 'lucide-react';

const stats = [
    { label: 'Active Rooms', value: '21', hint: 'live sessions today' },
    { label: 'Successful Deals', value: '1,240+', hint: 'cleared with escrow' },
    { label: 'Escrow Support', value: '24/7', hint: 'real humans on standby' },
];

const steps = [
    {
        title: 'Choose a Room',
        description:
            'Invite buyer, seller, and moderator into a private room with role-aware controls.',
        icon: Shield,
    },
    {
        title: 'Buyer Sends Funds',
        description:
            'Payment is held securely in escrow with instant status updates for every participant.',
        icon: Lock,
    },
    {
        title: 'Seller Ships Item',
        description:
            'Track shipment, milestones, and files together. Everyone stays aligned on progress.',
        icon: Globe2,
    },
    {
        title: 'GM Releases Payment',
        description:
            'Moderator verifies delivery and releases funds. Activity logs keep the room auditable.',
        icon: Check,
    },
];

const highlightRooms = [
    { id: '03', status: 'Waiting Payment', last: '9 min ago' },
    { id: '06', status: 'Free', last: '23 min ago' },
    { id: '11', status: 'In Use', last: '30 min ago' },
];

export default function HomePage() {
    return (
        <MarketingLayout
            title="RoomEscrow – Escrow rooms for modern trades"
            description="Create transparent escrow rooms with buyers, sellers, and moderators. Keep funds and files synced until everyone is satisfied."
            className="font-['Sora','Plus_Jakarta_Sans',sans-serif]"
        >
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 -z-10">
                    <div className="absolute left-[10%] top-10 h-64 w-64 rounded-full bg-[#7da1ff]/20 blur-[110px]" />
                    <div className="absolute right-[8%] top-16 h-72 w-72 rounded-full bg-[#ffd89b]/30 blur-[120px]" />
                </div>
                <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-6 lg:pt-14">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-lg shadow-blue-50 ring-1 ring-white/60 backdrop-blur">
                            <Sparkles className="size-4 text-[#ff8a3d]" />
                            Modern escrow, zero guesswork.
                        </div>
                        <div className="space-y-4">
                            <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
                                Secure your transactions with
                                <span className="block text-[#2a4bff]">
                                    role-based escrow rooms.
                                </span>
                            </h1>
                            <p className="max-w-2xl text-lg text-slate-600">
                                Every deal gets a private room for buyer, seller, and moderator.
                                Funds, files, and milestones stay in sync until both sides agree.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Link
                                href="/rooms"
                                className="inline-flex items-center gap-2 rounded-2xl bg-[#2a4bff] px-5 py-3 text-base font-semibold text-white shadow-lg shadow-blue-300 transition hover:-translate-y-0.5 hover:shadow-xl"
                            >
                                View Rooms
                                <ArrowRight className="size-4" />
                            </Link>
                            <Link
                                href="/rooms?view=marketplace"
                                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-base font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg"
                            >
                                Open Marketplace
                            </Link>
                            <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200">
                                <Users2 className="size-4 text-[#2a4bff]" />
                                Live moderators included
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                                <Shield className="size-4 text-[#2a4bff]" />
                                Escrow Guarantee
                            </div>
                            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                                <Clock3 className="size-4 text-[#ff8a3d]" />
                                Instant status alerts
                            </div>
                            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                                <Lock className="size-4 text-emerald-500" />
                                Bank-grade security
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute -left-10 -top-8 h-32 w-32 rounded-full bg-[#2a4bff]/15 blur-[90px]" />
                        <div className="absolute -right-6 bottom-10 h-28 w-28 rounded-full bg-[#ffd89b]/30 blur-[85px]" />
                        <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-gradient-to-br from-white via-slate-50 to-[#f2f5ff] p-6 shadow-2xl shadow-slate-200/60">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-500">
                                        Live escrow board
                                    </p>
                                    <p className="text-2xl font-bold text-slate-900">
                                        Rooms overview
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                                    Synced in real-time
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                                </div>
                            </div>
                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                {highlightRooms.map((room) => (
                                    <div
                                        key={room.id}
                                        className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold text-slate-500">
                                                Room #{room.id}
                                            </p>
                                            <span
                                                className={cn(
                                                    'rounded-full px-3 py-1 text-xs font-bold',
                                                    room.status === 'Free'
                                                        ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
                                                        : 'bg-amber-50 text-amber-600 ring-1 ring-amber-100',
                                                )}
                                            >
                                                {room.status}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-lg font-semibold text-slate-900">
                                            Participants ready
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            Last activity: {room.last}
                                        </p>
                                        <Link
                                            href={getRoomUrl(room)}
                                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
                                        >
                                            Enter room
                                            <ArrowRight className="size-4" />
                                        </Link>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 rounded-2xl bg-gradient-to-r from-[#2a4bff] to-[#647bff] p-4 text-white shadow-lg shadow-blue-300/50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-indigo-100">
                                            Audit trail
                                        </p>
                                        <p className="text-lg font-bold">Every step recorded</p>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                                        <Check className="size-4" />
                                        Verified
                                    </div>
                                </div>
                                <p className="mt-2 text-sm text-indigo-50">
                                    Status updates, receipts, and files stay synchronized until
                                    funds are released.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 pb-16 lg:px-6">
                <div className="grid gap-4 sm:grid-cols-3">
                    {stats.map((item) => (
                        <div
                            key={item.label}
                            className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_20px_60px_-28px_rgba(26,46,96,0.35)] ring-1 ring-slate-100 backdrop-blur"
                        >
                            <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                            <p className="mt-3 text-3xl font-bold text-slate-900">
                                {item.value}
                            </p>
                            <p className="text-sm text-slate-500">{item.hint}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section
                id="how-it-works"
                className="mx-auto max-w-6xl space-y-6 px-4 pb-20 lg:px-6"
            >
                <div className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#2a4bff]">
                        How it works
                    </p>
                    <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                        A transparent, guided escrow flow.
                    </h2>
                    <p className="mt-3 text-slate-600">
                        Every step is timestamped, verified, and visible to all participants.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {steps.map(({ title, description, icon: Icon }, index) => (
                        <div
                            key={title}
                            className="group relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_20px_60px_-28px_rgba(26,46,96,0.35)] ring-1 ring-slate-100 backdrop-blur"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-[#2a4bff]/5 via-transparent to-[#ff8a3d]/5 opacity-0 transition duration-300 group-hover:opacity-100" />
                            <div className="relative flex items-center justify-between">
                                <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-300">
                                    <Icon className="size-6" />
                                </div>
                                <span className="text-sm font-semibold text-slate-400">
                                    Step {index + 1}
                                </span>
                            </div>
                            <h3 className="relative mt-4 text-xl font-semibold text-slate-900">
                                {title}
                            </h3>
                            <p className="relative mt-2 text-sm text-slate-600">{description}</p>
                        </div>
                    ))}
                </div>
            </section>
        </MarketingLayout>
    );
}
