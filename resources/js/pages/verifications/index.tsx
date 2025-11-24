import React, { useState } from 'react'
import { Head, Link } from '@inertiajs/react'
import AppLayout from '@/layouts/app-layout'
import { UserVerificationManagement } from '@/components/UserVerificationManagement'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Users,
  Package,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  FileText,
  CreditCard,
  Truck
} from 'lucide-react'
import { type BreadcrumbItem } from '@/types'

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Verifications',
        href: '/verifications',
    },
];

function UserVerificationsPage() {
    const [activeTab, setActiveTab] = useState('users')

    return (
        <>
            <Head title="Verifications - Rekber System" />

            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">Verifikasi Management</h1>
                        <p className="text-gray-600 mt-2">Kelola verifikasi pengguna dan transaksi dalam satu tempat</p>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Verifikasi User</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">
                                    <Link href="/verifications/users" className="hover:underline">
                                        Management User
                                    </Link>
                                </div>
                                <p className="text-xs text-muted-foreground">Verifikasi identitas pengguna</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Verifikasi Transaksi</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    <Link href="/transactions" className="hover:underline">
                                        Management Transaksi
                                    </Link>
                                </div>
                                <p className="text-xs text-muted-foreground">Verifikasi pembayaran & pengiriman</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="users" className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Verifikasi User
                            </TabsTrigger>
                            <TabsTrigger value="transactions" className="flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                Verifikasi Transaksi
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="users" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="w-5 h-5" />
                                        Verifikasi Identitas Pengguna
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <UserVerificationManagement />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="transactions" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <Package className="w-5 h-5" />
                                            Verifikasi Transaksi
                                        </span>
                                        <Button asChild className="flex items-center gap-2">
                                            <Link href="/transactions">
                                                Buka Halaman Transaksi
                                                <ArrowRight className="w-4 h-4" />
                                            </Link>
                                        </Button>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                                            <div className="flex items-center gap-3 mb-3">
                                                <CreditCard className="w-6 h-6 text-blue-600" />
                                                <h3 className="font-semibold text-blue-900">Verifikasi Pembayaran</h3>
                                            </div>
                                            <p className="text-blue-700 mb-4">
                                                Verifikasi bukti pembayaran dari pembeli untuk melanjutkan transaksi ke tahap pengiriman.
                                            </p>
                                            <Button asChild variant="outline" className="w-full">
                                                <Link href="/transactions">
                                                    Kelola Pembayaran
                                                </Link>
                                            </Button>
                                        </div>

                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Truck className="w-6 h-6 text-orange-600" />
                                                <h3 className="font-semibold text-orange-900">Verifikasi Pengiriman</h3>
                                            </div>
                                            <p className="text-orange-700 mb-4">
                                                Verifikasi bukti pengiriman dari penjual untuk mempersiapkan proses rilis dana.
                                            </p>
                                            <Button asChild variant="outline" className="w-full">
                                                <Link href="/transactions">
                                                    Kelola Pengiriman
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                                        <div className="flex items-center gap-3 mb-3">
                                            <TrendingUp className="w-6 h-6 text-green-600" />
                                            <h3 className="font-semibold text-green-900">Rilis Dana</h3>
                                        </div>
                                        <p className="text-green-700 mb-4">
                                            Setelah barang diterima pembeli dan diverifikasi, lakukan rilis dana ke penjual untuk menyelesaikan transaksi.
                                        </p>
                                        <Button asChild variant="outline" className="w-full">
                                            <Link href="/transactions">
                                                Kelola Rilis Dana
                                            </Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </>
    )
}

UserVerificationsPage.layout = (page: React.ReactNode) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
)

export default UserVerificationsPage