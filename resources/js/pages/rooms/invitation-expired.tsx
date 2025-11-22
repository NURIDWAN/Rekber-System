import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, AlertTriangle, ArrowLeft, Home } from 'lucide-react';

interface Props {
    token: string;
}

export default function InvitationExpired({ token }: Props) {
    return (
        <>
            <Head title="Invitation Expired" />

            <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 py-12 px-4">
                <div className="max-w-md mx-auto">
                    <div className="text-center mb-8">
                        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <Clock className="w-8 h-8 text-red-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Invitation Expired
                        </h1>
                        <p className="text-lg text-gray-600">
                            This invitation is no longer valid
                        </p>
                    </div>

                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-600">
                                <AlertTriangle className="w-5 h-5" />
                                What Happened?
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                    This invitation has expired and is no longer valid.
                                    Invitations are automatically cancelled after 24 hours for security reasons.
                                </AlertDescription>
                            </Alert>

                            <div className="text-sm text-gray-600 space-y-2">
                                <p><strong>Possible reasons:</strong></p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>The invitation has expired (24-hour limit)</li>
                                    <li>The invitation was revoked by the sender</li>
                                    <li>The maximum number of PIN attempts was reached</li>
                                    <li>The invitation has already been used</li>
                                </ul>
                            </div>

                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                                    <div className="text-sm text-amber-800">
                                        <strong>Next Steps:</strong>
                                        <p className="mt-1">
                                            Please contact the person who sent you this invitation and ask for a new one.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex gap-4">
                        <Link href="/rooms" className="flex-1">
                            <Button className="w-full">
                                <Home className="w-4 h-4 mr-2" />
                                Browse Rooms
                            </Button>
                        </Link>
                        <Button variant="outline" onClick={() => window.history.back()}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Go Back
                        </Button>
                    </div>

                    <div className="text-center mt-6 text-sm text-gray-500">
                        <p>
                            Need help? Contact support for assistance with room invitations.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}