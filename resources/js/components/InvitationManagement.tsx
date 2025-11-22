import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import CreateInvitationForm from './CreateInvitationForm';
import {
    Users,
    Mail,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    RotateCcw,
    Trash2,
    Plus,
    Shield,
    Key,
    ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

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

interface Room {
    id: number;
    name: string;
    room_number: string;
    status: string;
}

interface Props {
    room: Room;
    invitations: Invitation[];
    availableRoles: ('buyer' | 'seller')[];
    currentUserRole?: string;
}

export default function InvitationManagement({
    room,
    invitations,
    availableRoles,
    currentUserRole
}: Props) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [isRevoking, setIsRevoking] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleRevoke = async (invitationId: string) => {
        if (!confirm('Are you sure you want to revoke this invitation?')) return;

        setIsRevoking(invitationId);

        try {
            const response = await fetch(`/api/rooms/${room.id}/invitations/${invitationId}/revoke`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                }
            });

            if (response.ok) {
                toast.success('Invitation revoked successfully');
                window.location.reload();
            } else {
                throw new Error('Failed to revoke invitation');
            }
        } catch (error) {
            toast.error('Failed to revoke invitation');
        } finally {
            setIsRevoking(null);
        }
    };

    const handleDelete = async (invitationId: string) => {
        if (!confirm('Are you sure you want to permanently delete this invitation? This action cannot be undone.')) return;

        setIsDeleting(invitationId);

        try {
            const response = await fetch(`/api/rooms/${room.id}/invitations/${invitationId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                }
            });

            if (response.ok) {
                toast.success('Invitation deleted successfully');
                window.location.reload();
            } else {
                throw new Error('Failed to delete invitation');
            }
        } catch (error) {
            toast.error('Failed to delete invitation');
        } finally {
            setIsDeleting(null);
        }
    };

    const getStatusBadge = (invitation: Invitation) => {
        switch (invitation.status) {
            case 'accepted':
                return (
                    <Badge variant="green" className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Accepted
                    </Badge>
                );
            case 'expired':
                return (
                    <Badge variant="red" className="flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Expired
                    </Badge>
                );
            default:
                return (
                    <Badge variant="yellow" className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Pending
                    </Badge>
                );
        }
    };

    const getTimeRemaining = (expiresAt: string) => {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry.getTime() - now.getTime();

        if (diff <= 0) return 'Expired';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days} day${days > 1 ? 's' : ''}`;
        }

        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    };

    if (showCreateForm) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Create New Invitation</h2>
                    <Button
                        variant="outline"
                        onClick={() => setShowCreateForm(false)}
                    >
                        Back to Invitations
                    </Button>
                </div>
                <CreateInvitationForm
                    roomId={room.id}
                    roomName={room.name}
                    availableRoles={availableRoles}
                    onInvitationCreated={() => {
                        setShowCreateForm(false);
                        window.location.reload();
                    }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Invitations</h2>
                    <p className="text-muted-foreground">
                        Manage secure invitations for "{room.name}"
                    </p>
                </div>
                {availableRoles.length > 0 && (
                    <Button onClick={() => setShowCreateForm(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Invitation
                    </Button>
                )}
            </div>

            {/* Room Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Room Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold">{room.room_number}</div>
                            <div className="text-sm text-muted-foreground">Room Number</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold capitalize">{room.status}</div>
                            <div className="text-sm text-muted-foreground">Status</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold">{invitations.length}</div>
                            <div className="text-sm text-muted-foreground">Total Invitations</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold">
                                {invitations.filter(i => i.status === 'pending').length}
                            </div>
                            <div className="text-sm text-muted-foreground">Pending</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Available Roles Info */}
            {availableRoles.length === 0 ? (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        All roles are currently filled. No new invitations can be created.
                    </AlertDescription>
                </Alert>
            ) : (
                <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                        You can create invitations for: {availableRoles.join(' and ')} roles.
                        Each invitation includes a 6-digit PIN for enhanced security.
                    </AlertDescription>
                </Alert>
            )}

            {/* Invitations List */}
            <div className="space-y-4">
                {invitations.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium mb-2">No invitations yet</h3>
                            <p className="text-muted-foreground mb-4">
                                Create your first secure invitation to get started
                            </p>
                            {availableRoles.length > 0 && (
                                <Button onClick={() => setShowCreateForm(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create First Invitation
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    invitations.map((invitation) => (
                        <Card key={invitation.id}>
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div>
                                                <div className="font-medium">{invitation.email}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    Invited by {invitation.inviter}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(invitation)}
                                                <Badge variant={invitation.role === 'buyer' ? 'blue' : 'orange'}>
                                                    {invitation.role}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {getTimeRemaining(invitation.expires_at)}
                                            </div>

                                            {invitation.pin_attempts > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <Key className="w-3 h-3" />
                                                    {invitation.pin_attempts} attempts
                                                </div>
                                            )}

                                            {invitation.is_pin_locked && (
                                                <Badge variant="red" className="text-xs">
                                                    PIN Locked
                                                </Badge>
                                            )}

                                            {invitation.accepted_at && (
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Accepted {new Date(invitation.accepted_at).toLocaleDateString()}
                                                </div>
                                            )}

                                            {invitation.joined_at && (
                                                <div className="flex items-center gap-1">
                                                    <Users className="w-3 h-3" />
                                                    Joined {new Date(invitation.joined_at).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>

                                        {invitation.invitee && (
                                            <div className="mt-2 text-sm">
                                                Accepted by: <span className="font-medium">{invitation.invitee}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        {invitation.status === 'pending' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleRevoke(invitation.id)}
                                                disabled={isRevoking === invitation.id}
                                            >
                                                {isRevoking === invitation.id ? (
                                                    <RotateCcw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="w-4 h-4" />
                                                )}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleDelete(invitation.id)}
                                            disabled={isDeleting === invitation.id}
                                        >
                                            {isDeleting === invitation.id ? (
                                                <RotateCcw className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Help Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Security Features</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-blue-600" />
                                <strong>Encrypted URLs:</strong> All invitation links are encrypted
                            </div>
                            <div className="flex items-center gap-2">
                                <Key className="w-4 h-4 text-blue-600" />
                                <strong>PIN Verification:</strong> 6-digit PIN required for access
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-600" />
                                <strong>Auto Expiry:</strong> Invitations expire automatically
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-600" />
                                <strong>Role-Based:</strong> Each invitation specifies buyer/seller role
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}