import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import InvitationManagement from '@/components/InvitationManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Shield, History, BarChart3, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface Room {
    id: number;
    name: string;
    room_number: string;
    status: string;
}

interface Invitation {
    id: string;
    email: string;
    role: 'buyer' | 'seller';
    status: 'pending' | 'accepted' | 'expired';
    expires_at: string;
    accepted_at?: string;
    joined_at?: string;
    pin_attempts: number;
    is_pin_locked: boolean;
    inviter: string;
    invitee?: string;
}

interface Props {
    room: Room;
    invitations: Invitation[];
    availableRoles: ('buyer' | 'seller')[];
    currentUserRole?: string;
}

export default function Invitations({ room, invitations, availableRoles, currentUserRole }: Props) {
    const [activeTab, setActiveTab] = useState('invitations');

    // Calculate statistics
    const stats = {
        total: invitations.length,
        pending: invitations.filter(i => i.status === 'pending').length,
        accepted: invitations.filter(i => i.status === 'accepted').length,
        expired: invitations.filter(i => i.status === 'expired').length,
        locked: invitations.filter(i => i.is_pin_locked).length
    };

    return (
        <>
            <Head title={`Invitations - ${room.name}`} />

            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Invitation Management</h1>
                                <p className="text-gray-600 mt-2">
                                    Manage secure invitations for "{room.name}" (Room #{room.room_number})
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center">
                                    <Users className="h-8 w-8 text-blue-600" />
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Total</p>
                                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center">
                                    <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                                        <Clock className="h-4 w-4 text-yellow-600" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Pending</p>
                                        <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center">
                                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Accepted</p>
                                        <p className="text-2xl font-bold text-gray-900">{stats.accepted}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center">
                                    <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                                        <XCircle className="h-4 w-4 text-red-600" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Expired</p>
                                        <p className="text-2xl font-bold text-gray-900">{stats.expired}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center">
                                    <Shield className="h-8 w-8 text-orange-600" />
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Locked</p>
                                        <p className="text-2xl font-bold text-gray-900">{stats.locked}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Content */}
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="mb-6">
                            <TabsTrigger value="invitations" className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Invitations
                            </TabsTrigger>
                            <TabsTrigger value="analytics" className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Analytics
                            </TabsTrigger>
                            <TabsTrigger value="security" className="flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                Security Info
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="invitations">
                            <InvitationManagement
                                room={room}
                                invitations={invitations}
                                availableRoles={availableRoles}
                                currentUserRole={currentUserRole}
                            />
                        </TabsContent>

                        <TabsContent value="analytics">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5" />
                                        Invitation Analytics
                                    </CardTitle>
                                    <CardDescription>
                                        Detailed statistics and insights about your room invitations
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Acceptance Rate */}
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-medium">Acceptance Rate</h3>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Accepted</span>
                                                    <span>{stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-green-600 h-2 rounded-full"
                                                        style={{ width: `${stats.total > 0 ? (stats.accepted / stats.total) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Role Distribution */}
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-medium">Role Distribution</h3>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Buyer</span>
                                                    <span>{invitations.filter(i => i.role === 'buyer').length}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span>Seller</span>
                                                    <span>{invitations.filter(i => i.role === 'seller').length}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recent Activity */}
                                        <div className="space-y-4 md:col-span-2">
                                            <h3 className="text-lg font-medium">Recent Activity</h3>
                                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                                {invitations.slice(0, 10).map((invitation) => (
                                                    <div key={invitation.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                        <div className="text-sm">
                                                            <span className="font-medium">{invitation.email}</span>
                                                            <span className="text-gray-500 ml-2">({invitation.role})</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {invitation.status === 'pending' && 'Waiting...'}
                                                            {invitation.status === 'accepted' && `Accepted ${new Date(invitation.accepted_at || '').toLocaleDateString()}`}
                                                            {invitation.status === 'expired' && 'Expired'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="security">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Shield className="w-5 h-5" />
                                            Security Features
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex items-start gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                                                <div>
                                                    <strong>Encrypted URLs:</strong> All invitation links use military-grade encryption
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                                                <div>
                                                    <strong>6-Digit PINs:</strong> Secure PIN verification for every invitation
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                                                <div>
                                                    <strong>Session Validation:</strong> Prevents session hijacking and replay attacks
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                                                <div>
                                                    <strong>Rate Limiting:</strong> Automatic lockout after 5 failed PIN attempts
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                                                <div>
                                                    <strong>Auto Expiry:</strong> Invitations automatically expire after 24 hours
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <History className="w-5 h-5" />
                                            Security Status
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                                    <span className="text-sm font-medium text-green-800">
                                                        Room Security: Active
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <h4 className="font-medium">Current Status:</h4>
                                                <ul className="text-sm space-y-1">
                                                    <li>• {stats.pending} pending invitations</li>
                                                    <li>• {stats.locked} locked PIN attempts</li>
                                                    <li>• {stats.accepted} successfully joined</li>
                                                    <li>• Rate limiting: Enabled</li>
                                                    <li>• Session validation: Active</li>
                                                </ul>
                                            </div>

                                            {stats.locked > 0 && (
                                                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                                                        <span className="text-sm text-orange-800">
                                                            {stats.locked} invitation(s) have locked PINs
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </>
    );
}

