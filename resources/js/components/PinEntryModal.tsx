import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Shield, Key, Lock, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface PinEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (pin: string) => void;
    roomNumber: number | string;
    isLoading?: boolean;
    error?: string | null;
}

export default function PinEntryModal({
    isOpen,
    onClose,
    onSubmit,
    roomNumber,
    isLoading = false,
    error = null
}: PinEntryModalProps) {
    const [pin, setPin] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPin('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length === 6) {
            onSubmit(pin);
        }
    };

    const handlePinChange = (value: string) => {
        // Only allow numbers
        const numericValue = value.replace(/\D/g, '');
        if (numericValue.length <= 6) {
            setPin(numericValue);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <Card className="w-full max-w-md shadow-2xl border-white/20">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <Lock className="w-6 h-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl">Room Locked</CardTitle>
                    <CardDescription>
                        Enter the 6-digit PIN to join Room #{roomNumber}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-center">
                                <div className="flex gap-2">
                                    {[0, 1, 2, 3, 4, 5].map((index) => (
                                        <div
                                            key={index}
                                            className={`w-10 h-12 sm:w-12 sm:h-14 border-2 rounded-lg flex items-center justify-center text-xl font-mono font-bold transition-all duration-200 ${pin[index]
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm scale-105'
                                                : 'border-slate-200 bg-slate-50 text-slate-400'
                                                }`}
                                        >
                                            {pin[index] || ''}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="relative">
                                <Input
                                    id="pin-input"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    value={pin}
                                    onChange={(e) => handlePinChange(e.target.value)}
                                    className="sr-only"
                                    autoComplete="one-time-code"
                                    autoFocus
                                    disabled={isLoading}
                                />
                                {/* Invisible overlay to capture clicks and focus the hidden input */}
                                <div
                                    className="absolute inset-0 cursor-text"
                                    onClick={() => document.getElementById('pin-input')?.focus()}
                                />
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <p className="text-center text-xs text-slate-500">
                                Please ask the room owner for the PIN code if you don't have it.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                className="flex-1"
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={pin.length !== 6 || isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Joining...
                                    </>
                                ) : (
                                    <>
                                        <Key className="w-4 h-4 mr-2" />
                                        Join Room
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
