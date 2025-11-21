import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { Menu, X, ShieldCheck, Sparkles } from 'lucide-react';

import { cn, isSameUrl } from '@/lib/utils';
import type { SharedData } from '@/types';
import { useDynamicNavigation } from '@/hooks/use-dynamic-navigation';

type MarketingLayoutProps = PropsWithChildren<{
    title?: string;
    description?: string;
    className?: string;
}>;


export default function MarketingLayout({
    children,
    title = 'RoomEscrow',
    description = 'Escrow rooms that keep buyers, sellers, and moderators aligned.',
    className,
}: MarketingLayoutProps) {
    const { url, props } = usePage<SharedData>();
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const auth = (props as SharedData).auth;
    const { topNav, authCTA } = useDynamicNavigation();

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 12);
        handler();
        window.addEventListener('scroll', handler);
        return () => window.removeEventListener('scroll', handler);
    }, []);

    useEffect(() => {
        setOpen(false);
    }, [url]);

    const loginCta = useMemo(() => {
        // Use the first auth CTA item from the dynamic navigation
        const primaryAuthItem = authCTA.find(item =>
            item.title === 'Dashboard' || item.title === 'Log In'
        );

        if (primaryAuthItem) {
            const isDashboard = primaryAuthItem.title === 'Dashboard';
            return (
                <Link
                    href={primaryAuthItem.href}
                    className={cn(
                        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl',
                        isDashboard
                            ? 'bg-slate-900 shadow-slate-300'
                            : 'bg-[#2a4bff] shadow-blue-300'
                    )}
                >
                    {primaryAuthItem.icon && <primaryAuthItem.icon className="size-4" />}
                    {primaryAuthItem.title}
                </Link>
            );
        }

        // Fallback
        return auth?.user ? (
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
                Dashboard
            </Link>
        ) : (
            <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[#2a4bff] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-300 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
                Login
            </Link>
        );
    }, [auth, authCTA]);

    return (
        <>
            <Head title={title}>
                <meta name="description" content={description} />
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=sora:400,500,600,700|plus-jakarta-sans:400,500,600"
                    rel="stylesheet"
                />
            </Head>
            <div className="min-h-screen bg-gradient-to-b from-[#eef2ff] via-white to-[#eef7ff] text-slate-900">
                <header
                    className={cn(
                        'sticky top-0 z-50 border-b border-transparent transition-all duration-300',
                        scrolled ? 'bg-white/80 backdrop-blur shadow-[0_10px_40px_-18px_rgba(26,46,96,0.25)] border-white/60' : 'bg-transparent',
                    )}
                >
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 lg:px-6">
                        <div className="flex items-center gap-3">
                            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2a4bff] via-[#2f6fff] to-[#58b4ff] shadow-lg shadow-blue-200">
                                <ShieldCheck className="size-5 text-white" />
                            </div>
                            <div className="leading-tight">
                                <p className="text-sm font-semibold text-slate-500">
                                    RoomEscrow
                                </p>
                                <p className="text-base font-bold text-slate-900">
                                    Escrow Rooms
                                </p>
                            </div>
                        </div>

                        <nav className="hidden items-center gap-3 md:flex">
                            {topNav.map((item) => {
                                const isActive =
                                    isSameUrl(url, item.href) ||
                                    url.startsWith(`${item.href}/`);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
                                            isActive
                                                ? 'bg-slate-900/90 text-white shadow-lg shadow-slate-200'
                                                : 'text-slate-600 hover:bg-white hover:text-slate-900',
                                        )}
                                    >
                                        {item.icon && <item.icon className="size-4" />}
                                        {item.title}
                                        {item.badge && (
                                            <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="hidden items-center gap-3 md:flex">
                            {!auth?.user && (
                                <Link
                                    href="/register"
                                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg"
                                >
                                    <Sparkles className="size-4 text-[#ff8a3d]" />
                                    Create Account
                                </Link>
                            )}
                            {loginCta}
                        </div>

                        <button
                            type="button"
                            onClick={() => setOpen((prev) => !prev)}
                            className={cn(
                                'flex size-11 items-center justify-center rounded-2xl border text-slate-700 transition md:hidden',
                                scrolled
                                    ? 'border-white/60 bg-white/90 shadow'
                                    : 'border-slate-200 bg-white/70',
                            )}
                            aria-label="Toggle navigation"
                        >
                            {open ? <X className="size-5" /> : <Menu className="size-5" />}
                        </button>
                    </div>

                    {open && (
                        <div className="md:hidden">
                            <div className="mx-4 mb-4 space-y-2 rounded-3xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50">
                                {topNav.map((item) => {
                                    const isActive =
                                        isSameUrl(url, item.href) ||
                                        url.startsWith(`${item.href}/`);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                'flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold transition',
                                                isActive
                                                    ? 'bg-slate-900 text-white shadow-md shadow-slate-300'
                                                    : 'text-slate-700 hover:bg-slate-50',
                                            )}
                                        >
                                            {item.icon && <item.icon className="size-5" />}
                                            <span>{item.title}</span>
                                            {item.badge && (
                                                <span className="ml-auto rounded-full bg-red-500 px-2 py-1 text-xs text-white">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                                {!auth?.user && (
                                    <Link
                                        href="/register"
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                                    >
                                        <Sparkles className="size-4 text-[#ff8a3d]" />
                                        Create Account
                                    </Link>
                                )}
                                {loginCta}
                            </div>
                        </div>
                    )}
                </header>

                <main className={cn('pb-16', className)}>{children}</main>

                <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-sm text-slate-600 lg:px-6">
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
                            <Link href="/terms" className="hover:text-slate-900">
                                Terms
                            </Link>
                            <Link href="/privacy" className="hover:text-slate-900">
                                Privacy
                            </Link>
                            <Link href="/contact" className="hover:text-slate-900">
                                Contact
                            </Link>
                            <p className="text-slate-400">© 2024 RoomEscrow</p>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
