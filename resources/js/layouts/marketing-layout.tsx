import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';

import { cn, isSameUrl } from '@/lib/utils';
import type { SharedData } from '@/types';
import MainNavbar from '@/components/MainNavbar';

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
    const auth = (props as SharedData).auth;

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
                <MainNavbar />

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
