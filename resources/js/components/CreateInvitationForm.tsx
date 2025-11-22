import React, { useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Copy, Send, Clock, Shield, User, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';

interface Invitation {
    id: string;
    email: string;
    role: 'buyer' | 'seller';
    url: string;
    pin: string;
    room_name: string;
    expires_at: string;
    inviter: string;
}

interface CreateInvitationFormProps {
    roomId: number;
    roomName: string;
    availableRoles: ('buyer' | 'seller')[];
    onInvitationCreated?: (invitation: Invitation) => void;
}

export default function CreateInvitationForm({
    roomId,
    roomName,
    availableRoles,
    onInvitationCreated
}: CreateInvitationFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        role: '' as 'buyer' | 'seller',
        hours_valid: 24
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        post(`/api/rooms/${roomId}/invitations`, {
            onSuccess: (response: any) => {
                const invitation = response.props.invitation;
                setCreatedInvitation(invitation);
                onInvitationCreated?.(invitation);
                toast.success('Invitation created successfully');
                reset();
                setIsSubmitting(false);
            },
            onError: (errors: any) => {
                toast.error('Failed to create invitation');
                setIsSubmitting(false);
            }
        });
    };

    const copyToClipboard = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${type} copied to clipboard`);
    };

    const sendInvitation = () => {
        if (!createdInvitation) return;

        const emailBody = `
You have been invited to join room "${createdInvitation.room_name}" as a ${createdInvitation.role}.

Join URL: ${createdInvitation.url}
PIN: ${createdInvitation.pin}

This invitation expires on: ${new Date(createdInvitation.expires_at).toLocaleString()}

Invited by: ${createdInvitation.inviter}
        `.trim();

        const mailtoLink = `mailto:${createdInvitation.email}?subject=Invitation to join ${createdInvitation.room_name}&body=${encodeURIComponent(emailBody)}`;
        window.open(mailtoLink);
    };

    if (createdInvitation) {
        return (
            <Card className="w-full max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-green-600" />
                        Invitation Created Successfully
                    </CardTitle>
                    <CardDescription>
                        Share this secure invitation with {createdInvitation.email}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Invitation Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Email</Label>
                            <div className="flex items-center gap-2 p-2 bg-muted rounded">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{createdInvitation.email}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Role</Label>
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <Badge variant={createdInvitation.role === 'buyer' ? 'blue' : 'orange'}>
                                    {createdInvitation.role}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Security Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">PIN Code</Label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 p-3 bg-muted font-mono text-center rounded">
                                    {createdInvitation.pin}
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(createdInvitation.pin, 'PIN')}
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Expires In</Label>
                            <div className="flex items-center gap-2 p-3 bg-muted rounded">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">
                                    {Math.ceil((new Date(createdInvitation.expires_at).getTime() - Date.now()) / (1000 * 60 * 60))} hours
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Invitation URL */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Invitation URL</Label>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 p-3 bg-muted font-mono text-xs rounded truncate">
                                {createdInvitation.url}
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(createdInvitation.url, 'URL')}
                            >
                                <Copy className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Security Notice */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                            <div className="text-sm text-blue-800">
                                <strong>Security Notice:</strong> This invitation requires both the encrypted URL
                                and the 6-digit PIN for access. The invitation expires automatically for security.
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button onClick={sendInvitation} className="flex-1">
                        <Send className="w-4 h-4 mr-2" />
                        Send via Email
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setCreatedInvitation(null);
                            reset();
                        }}
                    >
                        Create Another
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Create Room Invitation</CardTitle>
                <CardDescription>
                    Invite someone to join "{roomName}" with enhanced security
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="user@example.com"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            required
                        />
                        {errors.email && (
                            <p className="text-sm text-destructive">{errors.email}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={data.role} onValueChange={(value: 'buyer' | 'seller') => setData('role', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableRoles.includes('buyer') && (
                                    <SelectItem value="buyer">Buyer</SelectItem>
                                )}
                                {availableRoles.includes('seller') && (
                                    <SelectItem value="seller">Seller</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        {errors.role && (
                            <p className="text-sm text-destructive">{errors.role}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="hours_valid">Expiry Time</Label>
                        <Select
                            value={data.hours_valid.toString()}
                            onValueChange={(value) => setData('hours_valid', parseInt(value))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">1 Hour</SelectItem>
                                <SelectItem value="6">6 Hours</SelectItem>
                                <SelectItem value="24">24 Hours</SelectItem>
                                <SelectItem value="72">3 Days</SelectItem>
                                <SelectItem value="168">7 Days</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-amber-600 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <strong>Security Features:</strong>
                                <ul className="mt-1 space-y-1">
                                    <li>• Encrypted URL with role-based access</li>
                                    <li>• 6-digit PIN verification required</li>
                                    <li>• Session validation for extra security</li>
                                    <li>• Automatic expiry after selected time</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={processing || isSubmitting}>
                        {processing || isSubmitting ? 'Creating...' : 'Create Secure Invitation'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}