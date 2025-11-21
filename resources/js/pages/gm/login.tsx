import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Shield, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

interface PageProps {
    errors?: Record<string, string>;
}

function GMLoginPage({ errors: serverErrors = {} }: PageProps) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/gm/login', {
            onSuccess: () => {
                // Navigation will be handled by server redirect
            }
        });
    };

    return (
        <>
            <Head title="GM Login - Rekber System" />
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 flex items-center justify-center">
                <div className="absolute inset-0 -z-10">
                    <div className="absolute left-[10%] top-20 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
                    <div className="absolute right-[8%] bottom-20 h-80 w-80 rounded-full bg-purple-600/20 blur-[110px]" />
                </div>

                <div className="w-full max-w-md px-4">
                    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl shadow-2xl">
                        <div className="p-8">
                            <div className="text-center mb-8">
                                <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mx-auto mb-4">
                                    <Shield className="w-8 h-8 text-white" />
                                </div>
                                <h1 className="text-3xl font-bold text-white mb-2">GM Portal</h1>
                                <p className="text-blue-100">
                                    Game Master Login Area
                                </p>
                            </div>

                            {errors.general && (
                                <div className="mb-6 rounded-2xl bg-red-500/20 border border-red-500/30 p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                                        <p className="text-sm text-red-200">{errors.general}</p>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-blue-100 mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className={cn(
                                            'w-full rounded-xl border bg-white/10 border-white/20 px-4 py-3 text-white placeholder-blue-200/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur',
                                            errors.email
                                                ? 'border-red-500/50 bg-red-500/10'
                                                : ''
                                        )}
                                        placeholder="gm@rekber.com"
                                        required
                                    />
                                    {errors.email && (
                                        <p className="mt-1 text-xs text-red-400">{errors.email}</p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-blue-100 mb-2">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            id="password"
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            className={cn(
                                                'w-full rounded-xl border bg-white/10 border-white/20 px-4 py-3 pr-12 text-white placeholder-blue-200/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur',
                                                errors.password
                                                    ? 'border-red-500/50 bg-red-500/10'
                                                    : ''
                                            )}
                                            placeholder="Enter your password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200/60 hover:text-blue-200 transition"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.password && (
                                        <p className="mt-1 text-xs text-red-400">{errors.password}</p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing || !data.email || !data.password}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {processing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Signing in...
                                        </>
                                    ) : (
                                        <>
                                            <LogIn className="w-4 h-4" />
                                            Sign in as GM
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 pt-6 border-t border-white/10">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-blue-100/80">
                                        <Lock className="w-4 h-4" />
                                        <span>Secure admin access</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-blue-100/80">
                                        <Shield className="w-4 h-4" />
                                        <span>Full system control</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 text-center">
                                <a
                                    href="/rooms"
                                    className="text-xs text-blue-200/60 hover:text-blue-200 transition"
                                >
                                    ← Back to Public Rooms
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mt-6">
                        <p className="text-xs text-blue-100/60">
                            Protected by military-grade encryption
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}

export default GMLoginPage;