import React, { useState, useEffect } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import {
    ArrowLeft,
    Users,
    ShieldCheck,
    Home,
    Settings,
    Menu,
    X,
    Zap,
    MessageCircle,
    Activity,
    LogOut,
    User
} from 'lucide-react';
import type { SharedData } from '@/types';

interface RoomsNavbarProps {
    roomNumber?: number;
    roomStatus?: string;
    connectionStatus?: 'connected' | 'connecting' | 'disconnected';
    onLeaveRoom?: () => void;
    currentUser?: {
        role: string;
        name: string;
    };
    encryptedRoomId?: string;
}

export default function RoomsNavbar({
    roomNumber,
    roomStatus,
    connectionStatus = 'connecting',
    onLeaveRoom,
    currentUser,
    encryptedRoomId
}: RoomsNavbarProps) {
    const { url } = usePage<SharedData>();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const getConnectionStatusColor = () => {
        switch (connectionStatus) {
            case 'connected':
                return 'bg-emerald-500';
            case 'connecting':
                return 'bg-amber-500';
            case 'disconnected':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getConnectionStatusText = () => {
        switch (connectionStatus) {
            case 'connected':
                return 'Online';
            case 'connecting':
                return 'Connecting...';
            case 'disconnected':
                return 'Offline';
            default:
                return 'Unknown';
        }
    };

    const getRoomStatusColor = () => {
        switch (roomStatus) {
            case 'free':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'in_use':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'waiting_payment':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            default:
                return 'bg-gray-50 text-gray-700 border-gray-200';
        }
    };

    const navItems = [
        {
            label: 'Beranda',
            href: '/',
            icon: Home,
            active: url === '/'
        },
        {
            label: 'Daftar Room',
            href: '/rooms',
            icon: Users,
            active: url === '/rooms'
        }
    ];

    if (roomNumber) {
        const roomUrl = encryptedRoomId ? `/rooms/${encryptedRoomId}` : `/rooms/${roomNumber}`;
        navItems.push({
            label: `Room #${roomNumber}`,
            href: roomUrl,
            icon: MessageCircle,
            active: url.includes(roomUrl) || url.includes(`/rooms/${roomNumber}`)
        });
    }

    return (
        <>
            {/* Desktop & Tablet Navbar */}
            <header className={cn(
                'sticky top-0 z-40 border-b transition-all duration-300 hidden md:block',
                scrolled
                    ? 'bg-white/95 backdrop-blur-md shadow-lg border-slate-200/60'
                    : 'bg-white border-slate-200'
            )}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Left Section - Brand & Navigation */}
                        <div className="flex items-center space-x-4">
                            {/* Logo */}
                            <Link href="/" className="flex items-center space-x-2">
                                <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 shadow-lg">
                                    <ShieldCheck className="size-5 text-white" />
                                </div>
                                <div className="leading-tight">
                                    <p className="text-sm font-semibold text-slate-500">RoomEscrow</p>
                                    <p className="text-sm font-bold text-slate-900">Escrow System</p>
                                </div>
                            </Link>

                            {/* Navigation */}
                            <nav className="hidden lg:flex items-center space-x-1">
                                {navItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                                            item.active
                                                ? 'bg-slate-900 text-white shadow-sm'
                                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        )}
                                    >
                                        <item.icon className="size-4" />
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                        </div>

                        {/* Right Section - Status & Actions */}
                        <div className="flex items-center space-x-3">
                            {/* Connection Status */}
                            {roomNumber && (
                                <div className="flex items-center space-x-2 rounded-full bg-slate-100 px-3 py-1.5">
                                    <div className={cn(
                                        'w-2 h-2 rounded-full',
                                        getConnectionStatusColor()
                                    )} />
                                    <span className="text-xs font-medium text-slate-700">
                                        {getConnectionStatusText()}
                                    </span>
                                </div>
                            )}

                            {/* Room Status Badge */}
                            {roomNumber && roomStatus && (
                                <span className={cn(
                                    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                                    getRoomStatusColor()
                                )}>
                                    {roomStatus === 'free' ? 'Available' :
                                     roomStatus === 'in_use' ? 'In Use' :
                                     roomStatus.replace('_', ' ')}
                                </span>
                            )}

                            {/* User Menu */}
                            {currentUser && (
                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-1 rounded-lg bg-slate-100 px-3 py-2">
                                        <User className="size-4 text-slate-600" />
                                        <span className="text-sm font-medium text-slate-900">
                                            {currentUser.name}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-500 uppercase">
                                            ({currentUser.role})
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            {roomNumber && onLeaveRoom && (
                                <button
                                    onClick={onLeaveRoom}
                                    className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 border border-red-200 hover:bg-red-100 transition"
                                >
                                    <LogOut className="size-4" />
                                    <span className="hidden sm:inline">Leave Room</span>
                                </button>
                            )}

                            {/* GM Portal Link */}
                            <Link
                                href="/gm/login"
                                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition"
                            >
                                <ShieldCheck className="size-4" />
                                <span className="hidden sm:inline">GM Portal</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Navbar */}
            <header className={cn(
                'sticky top-0 z-40 border-b transition-all duration-300 md:hidden',
                scrolled
                    ? 'bg-white/95 backdrop-blur-md shadow-lg border-slate-200/60'
                    : 'bg-white border-slate-200'
            )}>
                <div className="px-4 sm:px-6">
                    <div className="flex items-center justify-between h-14">
                        {/* Left Section */}
                        <div className="flex items-center space-x-3">
                            {/* Mobile Menu Toggle */}
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
                            >
                                {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
                            </button>

                            {/* Room Info (if in room) */}
                            {roomNumber ? (
                                <div className="flex items-center space-x-2">
                                    <Link href="/rooms" className="p-1">
                                        <ArrowLeft className="size-5 text-slate-600" />
                                    </Link>
                                    {encryptedRoomId && (
                                        <Link
                                            href={`/rooms/${roomNumber}/invitations`}
                                            className="p-1 hover:bg-slate-100 rounded"
                                            title="Manage Invitations"
                                        >
                                            <Users className="size-4 text-slate-600" />
                                        </Link>
                                    )}
                                    <div>
                                        <p className="text-xs text-slate-500">Room</p>
                                        <p className="text-sm font-bold text-slate-900">#{roomNumber}</p>
                                    </div>
                                </div>
                            ) : (
                                /* Logo */
                                <Link href="/" className="flex items-center space-x-2">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
                                        <ShieldCheck className="size-4 text-white" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-900">RoomEscrow</span>
                                </Link>
                            )}
                        </div>

                        {/* Right Section */}
                        <div className="flex items-center space-x-2">
                            {/* Connection Status */}
                            {roomNumber && (
                                <div className="flex items-center space-x-1 rounded-full bg-slate-100 px-2 py-1">
                                    <div className={cn(
                                        'w-1.5 h-1.5 rounded-full',
                                        getConnectionStatusColor()
                                    )} />
                                    <span className="text-xs font-medium text-slate-700 hidden sm:inline">
                                        {getConnectionStatusText()}
                                    </span>
                                </div>
                            )}

                            {/* Action Buttons */}
                            {roomNumber && onLeaveRoom && (
                                <button
                                    onClick={onLeaveRoom}
                                    className="p-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition"
                                >
                                    <LogOut className="size-4" />
                                </button>
                            )}

                            {/* GM Portal */}
                            <Link
                                href="/gm/login"
                                className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition"
                            >
                                <ShieldCheck className="size-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Mobile Navigation Menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden">
                            <div className="py-3 border-t border-slate-200">
                                <nav className="space-y-1">
                                    {navItems.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={cn(
                                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                                                item.active
                                                    ? 'bg-slate-900 text-white'
                                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                            )}
                                        >
                                            <item.icon className="size-4" />
                                            {item.label}
                                        </Link>
                                    ))}
                                </nav>

                                {/* User Info & Additional Actions */}
                                {currentUser && (
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                        <div className="rounded-lg bg-slate-50 p-3 mb-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <User className="size-4 text-slate-600" />
                                                <span className="font-medium text-slate-900">{currentUser.name}</span>
                                                <span className="text-xs font-semibold text-slate-500 uppercase">
                                                    ({currentUser.role})
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Mobile Bottom Navigation (when inside room) */}
            {roomNumber && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30">
                    <div className="grid grid-cols-4 gap-1 p-2">
                        <Link
                            href="/rooms"
                            className="flex flex-col items-center justify-center py-2 px-1 rounded-lg text-slate-600 hover:bg-slate-50 transition"
                        >
                            <Users className="size-4 mb-1" />
                            <span className="text-xs">Rooms</span>
                        </Link>
                        <button
                            onClick={() => {/* Scroll to chat */}}
                            className="flex flex-col items-center justify-center py-2 px-1 rounded-lg text-slate-600 hover:bg-slate-50 transition"
                        >
                            <MessageCircle className="size-4 mb-1" />
                            <span className="text-xs">Chat</span>
                        </button>
                        <button
                            onClick={() => {/* Scroll to activity */}}
                            className="flex flex-col items-center justify-center py-2 px-1 rounded-lg text-slate-600 hover:bg-slate-50 transition"
                        >
                            <Activity className="size-4 mb-1" />
                            <span className="text-xs">Activity</span>
                        </button>
                        {onLeaveRoom && (
                            <button
                                onClick={onLeaveRoom}
                                className="flex flex-col items-center justify-center py-2 px-1 rounded-lg text-red-600 hover:bg-red-50 transition"
                            >
                                <LogOut className="size-4 mb-1" />
                                <span className="text-xs">Leave</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Spacer for fixed navbar */}
            <div className="h-14 md:h-16" />
            {roomNumber && <div className="h-12 md:hidden" />} {/* Extra spacer for mobile bottom nav */}
        </>
    );
}