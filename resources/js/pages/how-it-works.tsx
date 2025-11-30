import React, { useEffect, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { Shield, MessageSquare, CreditCard, CheckCircle, ArrowRight, Users, Lock, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MainNavbar from '@/components/MainNavbar';

export default function HowItWorks() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const steps = [
        {
            icon: Users,
            title: "1. Buat atau Gabung Room",
            description: "Penjual membuat room aman dan membagikan link atau PIN ke pembeli. Kedua pihak masuk ke ruang diskusi privat.",
            color: "bg-blue-100 text-blue-600",
            delay: "delay-100"
        },
        {
            icon: MessageSquare,
            title: "2. Diskusi & Sepakat",
            description: "Gunakan fitur chat untuk mematangkan detail transaksi. Semua kesepakatan terekam demi keamanan dan transparansi.",
            color: "bg-indigo-100 text-indigo-600",
            delay: "delay-200"
        },
        {
            icon: CreditCard,
            title: "3. Pembeli Deposit Dana",
            description: "Pembeli mentransfer dana ke rekening bersama (Escrow). Penjual mendapat notifikasi setelah dana terverifikasi.",
            color: "bg-purple-100 text-purple-600",
            delay: "delay-300"
        },
        {
            icon: Lock,
            title: "4. Penjual Mengirim Barang",
            description: "Penjual mengirim barang atau jasa. Bukti pengiriman diunggah ke dalam room untuk diverifikasi oleh sistem.",
            color: "bg-pink-100 text-pink-600",
            delay: "delay-400"
        },
        {
            icon: CheckCircle,
            title: "5. Dana Dicairkan",
            description: "Setelah pembeli mengonfirmasi penerimaan barang, dana diteruskan ke penjual. Transaksi selesai dengan aman.",
            color: "bg-green-100 text-green-600",
            delay: "delay-500"
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <Head title="Cara Kerja" />

            <MainNavbar />

            <style>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.8s ease-out forwards;
                    opacity: 0;
                }
                .delay-100 { animation-delay: 0.1s; }
                .delay-200 { animation-delay: 0.2s; }
                .delay-300 { animation-delay: 0.3s; }
                .delay-400 { animation-delay: 0.4s; }
                .delay-500 { animation-delay: 0.5s; }
                .delay-600 { animation-delay: 0.6s; }
            `}</style>

            {/* Hero Section */}
            <div className="bg-white border-b border-slate-200 overflow-hidden">
                <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-6 animate-pulse">
                        <Shield className="w-4 h-4" />
                        Layanan Rekber Terpercaya
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight mb-6">
                        Transaksi aman dalam <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">5 langkah mudah</span>
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Sistem room berbasis peran kami memastikan uang dan barang Anda aman hingga kedua belah pihak puas. Tanpa penipuan, tanpa rasa khawatir.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button asChild size="lg" className="rounded-full px-8 bg-blue-600 hover:bg-blue-700 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-blue-200">
                            <Link href="/rooms">
                                Lihat Room
                                <ArrowRight className="ml-2 w-4 h-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Steps Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
                    {steps.map((step, index) => (
                        <div
                            key={index}
                            className={`relative flex flex-col items-center text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fade-in-up ${step.delay}`}
                        >
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${step.color} shadow-sm`}>
                                <step.icon className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                            <p className="text-slate-600 leading-relaxed">
                                {step.description}
                            </p>

                            {/* Connector Line (Desktop only) */}
                            {index < steps.length - 1 && (index + 1) % 3 !== 0 && (
                                <div className="hidden lg:block absolute top-1/2 -right-6 w-12 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Features / Trust Section */}
            <div className="bg-slate-900 text-white py-24 relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
                    <div className="absolute top-1/2 right-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl"></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <h2 className="text-3xl md:text-4xl font-bold mb-16 animate-fade-in-up delay-500">Mengapa memilih kami?</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors duration-300 animate-fade-in-up delay-100">
                            <Shield className="w-12 h-12 text-blue-400 mx-auto mb-6" />
                            <h3 className="text-xl font-semibold mb-3">Keamanan Tingkat Bank</h3>
                            <p className="text-slate-400 leading-relaxed">Dana Anda disimpan di rekening terpisah yang aman dan teregulasi.</p>
                        </div>
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors duration-300 animate-fade-in-up delay-200">
                            <Users className="w-12 h-12 text-indigo-400 mx-auto mb-6" />
                            <h3 className="text-xl font-semibold mb-3">Mediasi Netral</h3>
                            <p className="text-slate-400 leading-relaxed">Tim kami siap membantu menyelesaikan sengketa secara adil dan cepat.</p>
                        </div>
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors duration-300 animate-fade-in-up delay-300">
                            <Zap className="w-12 h-12 text-yellow-400 mx-auto mb-6" />
                            <h3 className="text-xl font-semibold mb-3">Proses Cepat</h3>
                            <p className="text-slate-400 leading-relaxed">Verifikasi otomatis dan pencairan dana instan setelah persetujuan.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
