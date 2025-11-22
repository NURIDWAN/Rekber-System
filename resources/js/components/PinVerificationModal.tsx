import React, { useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Shield, Key, Clock, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface PinVerificationModalProps {
    isOpen: boolean;
    onClose?: () => void;
    onVerified?: () => void;
    invitation: {
        id: string;
        email: string;
        role: 'buyer' | 'seller';
        room_name: string;
        expires_at: string;
    };
    token: string;
    attemptsRemaining?: number;
    isLocked?: boolean;
    lockedUntil?: string;
}

export default function PinVerificationModal({
    isOpen,
    onClose,
    onVerified,
    invitation,
    token,
    attemptsRemaining = 5,
    isLocked = false,
    lockedUntil
}: PinVerificationModalProps) {
    const [isVerifying, setIsVerifying] = useState(false);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const { post, processing } = useForm({
        pin: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length !== 6 || isLocked) return;

        setIsVerifying(true);
        setError('');

        post(`/rooms/invite/${token}/verify-pin`, {
            data: { pin },
            onSuccess: () => {
                setIsVerifying(false);
                onVerified?.();
            },
            onError: (errors: any) => {
                setError(errors.error || 'Invalid PIN');
                setIsVerifying(false);
                setPin('');
            }
        });
    };

    const handlePinChange = (value: string) => {
        // Only allow numbers
        const numericValue = value.replace(/\D/g, '');
        if (numericValue.length <= 6) {
            setPin(numericValue);
        }
    };

    const timeUntilUnlock = lockedUntil
        ? Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / (1000 * 60)))
        : 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl">Enter PIN Code</CardTitle>
                    <CardDescription>
                        Enter the 6-digit PIN to access "{invitation.room_name}"
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Invitation Info */}
                    <div className="bg-muted p-3 rounded-lg">
                        <div className="text-sm space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Email:</span>
                                <span className="font-medium">{invitation.email}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Role:</span>
                                <Badge variant={invitation.role === 'buyer' ? 'blue' : 'orange'}>
                                    {invitation.role}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Expires:</span>
                                <span className="text-xs">
                                    {new Date(invitation.expires_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* PIN Input */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="pin" className="text-center block">
                                6-Digit PIN Code
                            </Label>
                            <div className="flex justify-center">
                                <div className="flex gap-2">
                                    {[0, 1, 2, 3, 4, 5].map((index) => (
                                        <div
                                            key={index}
                                            className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center text-lg font-mono font-bold transition-colors ${
                                                pin[index]
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-gray-300 bg-gray-50'
                                            }`}
                                        >
                                            {pin[index] || ''}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Input
                                id="pin"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={pin}
                                onChange={(e) => handlePinChange(e.target.value)}
                                className="sr-only" // Hidden input for accessibility
                                autoComplete="one-time-code"
                                disabled={isLocked || isVerifying}
                            />
                        </div>

                        {/* Error Display */}
                        {error && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Lock Status */}
                        {isLocked && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                    Too many failed attempts. Please try again in {timeUntilUnlock} minutes.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Attempts Remaining */}
                        {!isLocked && attemptsRemaining < 5 && (
                            <Alert>
                                <Clock className="h-4 w-4" />
                                <AlertDescription>
                                    {attemptsRemaining} attempts remaining. PIN will be locked after 5 failed attempts.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Success State */}
                        {!isLocked && attemptsRemaining === 5 && !error && (
                            <div className="text-center text-green-600">
                                <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm">Enter the 6-digit PIN provided in your invitation</p>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <Button
                                type="submit"
                                className="flex-1"
                                disabled={pin.length !== 6 || isLocked || isVerifying}
                            >
                                {isVerifying ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    <>
                                        <Key className="w-4 h-4 mr-2" />
                                        Verify PIN
                                    </>
                                )}
                            </Button>
                            {onClose && (
                                <Button type="button" variant="outline" onClick={onClose}>
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </form>
                </CardContent>

                <CardFooter className="text-center text-xs text-muted-foreground">
                    <div className="w-full">
                        <p>This invitation requires both the encrypted URL and PIN for security.</p>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}