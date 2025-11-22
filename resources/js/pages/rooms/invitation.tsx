import React, { useState, useEffect } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PinVerificationModal from '@/components/PinVerificationModal';
import { Shield, Mail, Clock, User, ArrowRight, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Invitation {
    id: string;
    email: string;
    role: 'buyer' | 'seller';
    room_name: string;
    expires_at: string;
    inviter: string;
}

interface Room {
    id: number;
    name: string;
    room_number: string;
    owner: {
        name: string;
    };
}

interface Props {
    invitation: Invitation;
    room: Room;
    token: string;
    auth?: {
        user: {
            id: number;
            email: string;
            name: string;
        };
    };
}

export default function Invitation({ invitation, room, token, auth }: Props) {
    const [showPinModal, setShowPinModal] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(!!auth);
    const [needsPin, setNeedsPin] = useState(true);
    const [joining, setJoining] = useState(false);

    const { post, processing } = useForm({});

    useEffect(() => {
        // Check if PIN was already verified in this session
        const pinVerifiedKey = `invitation_pin_verified_${invitation.id}`;
        const isPinVerified = sessionStorage.getItem(pinVerifiedKey);

        if (isPinVerified) {
            setNeedsPin(false);
        }
    }, [invitation.id]);

    const handleJoinRoom = () => {
        if (!isAuthenticated) {
            // Redirect to login with intended URL
            const loginUrl = `/login?intended=${encodeURIComponent(window.location.href)}`;
            window.location.href = loginUrl;
            return;
        }

        if (needsPin) {
            setShowPinModal(true);
            return;
        }

        // Direct join if authenticated and PIN verified
        setJoining(true);
        post(`/rooms/invite/${token}`, {
            onSuccess: () => {
                setJoining(false);
                // Clear PIN verification from session
                const pinVerifiedKey = `invitation_pin_verified_${invitation.id}`;
                sessionStorage.removeItem(pinVerifiedKey);
            },
            onError: (errors: any) => {
                setJoining(false);
                if (errors.requires_reverification) {
                    setNeedsPin(true);
                    setShowPinModal(true);
                } else {
                    toast.error(errors.error || 'Failed to join room');
                }
            }
        });
    };

    const handlePinVerified = () => {
        setNeedsPin(false);
        setShowPinModal(false);

        // Store PIN verification in session
        const pinVerifiedKey = `invitation_pin_verified_${invitation.id}`;
        sessionStorage.setItem(pinVerifiedKey, 'true');

        toast.success('PIN verified successfully');

        // Auto-join after PIN verification if authenticated
        if (isAuthenticated) {
            setTimeout(() => handleJoinRoom(), 500);
        }
    };

    const isExpired = new Date(invitation.expires_at) < new Date();
    const timeRemaining = Math.max(0, Math.ceil((new Date(invitation.expires_at).getTime() - Date.now()) / (1000 * 60 * 60)));

    return (
        <>
            <Head title={`Invitation to ${room.name}`} />

            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="mx-auto w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center mb-4">
                            <Shield className="w-8 h-8 text-blue-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            You're Invited!
                        </h1>
                        <p className="text-lg text-gray-600">
                            Join "{room.name}" as a {invitation.role}
                        </p>
                    </div>

                    {/* Invitation Card */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Room Invitation</span>
                                <Badge variant={invitation.role === 'buyer' ? 'blue' : 'orange'}>
                                    {invitation.role}
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                Sent by {invitation.inviter} for {invitation.email}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Room Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="text-sm text-muted-foreground">Room Name</div>
                                    <div className="font-medium">{room.name}</div>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-sm text-muted-foreground">Room Number</div>
                                    <div className="font-medium">#{room.room_number}</div>
                                </div>
                            </div>

                            {/* Email verification */}
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <Mail className="w-4 h-4 text-amber-600" />
                                <div className="text-sm text-amber-800">
                                    This invitation is specifically for <strong>{invitation.email}</strong>
                                </div>
                            </div>

                            {/* Expiry info */}
                            {isExpired ? (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                        This invitation has expired. Please contact {invitation.inviter} for a new invitation.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert>
                                    <Clock className="h-4 w-4" />
                                    <AlertDescription>
                                        This invitation expires in {timeRemaining} hours
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Security features */}
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                                    <div className="text-sm text-blue-800">
                                        <strong>Enhanced Security:</strong>
                                        <ul className="mt-1 space-y-1">
                                            <li>• Encrypted invitation URL</li>
                                            <li>• 6-digit PIN verification required</li>
                                            <li>• Session validation enabled</li>
                                            <li>• Automatic expiry for safety</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Authentication status */}
                            {isAuthenticated ? (
                                <Alert>
                                    <CheckCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        Logged in as {auth.user.name} ({auth.user.email})
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                        You must be logged in to join. Clicking "Join Room" will redirect you to login.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* PIN verification status */}
                            {needsPin && !isExpired && (
                                <Alert>
                                    <Shield className="h-4 w-4" />
                                    <AlertDescription>
                                        PIN verification will be required when you join the room.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        <Button
                            onClick={handleJoinRoom}
                            disabled={isExpired || joining}
                            className="flex-1"
                        >
                            {joining ? (
                                'Joining...'
                            ) : (
                                <>
                                    Join Room
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>

                        <Link href="/rooms">
                            <Button variant="outline">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Browse Rooms
                            </Button>
                        </Link>
                    </div>

                    {/* Help text */}
                    <div className="text-center mt-6 text-sm text-gray-500">
                        <p>
                            Need help? Contact the room owner: {room.owner.name}
                        </p>
                    </div>
                </div>
            </div>

            {/* PIN Verification Modal */}
            <PinVerificationModal
                isOpen={showPinModal}
                onClose={() => setShowPinModal(false)}
                onVerified={handlePinVerified}
                invitation={invitation}
                token={token}
            />
        </>
    );
}