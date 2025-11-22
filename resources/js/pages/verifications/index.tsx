import React from 'react'
import { Head } from '@inertiajs/react'
import AppLayout from '@/layouts/app-layout'
import { UserVerificationManagement } from '@/components/UserVerificationManagement'
import { type BreadcrumbItem } from '@/types'

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'User Verifications',
        href: '/verifications',
    },
];

function UserVerificationsPage() {
    return (
        <>
            <Head title="User Verifications - Rekber System" />
            <UserVerificationManagement />
        </>
    )
}

UserVerificationsPage.layout = (page: React.ReactNode) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
)

export default UserVerificationsPage