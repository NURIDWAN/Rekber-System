import { InertiaLinkProps } from '@inertiajs/react';
import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
}

// Enhanced navigation types for dynamic navigation
export type UserRole = 'buyer' | 'seller' | 'gm' | 'regular';
export type PageContext = 'home' | 'rooms' | 'room_detail' | 'dashboard' | 'gm_dashboard' | 'marketplace' | 'how_it_works';
export type AuthenticationState = 'public' | 'authenticated' | 'partial';

export interface NavigationContext {
    isAuthenticated: boolean;
    userRole?: UserRole;
    currentPage?: PageContext;
    roomStatus?: string;
    transactionState?: string;
    isOnline?: boolean;
    hasUnreadMessages?: boolean;
}

export interface NavigationItem extends NavItem {
    requiredAuth?: AuthenticationState;
    allowedRoles?: UserRole[];
    pageContexts?: PageContext[];
    roomStatuses?: string[];
    transactionStates?: string[];
    badge?: string | number;
    badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
    isExternal?: boolean;
    divider?: boolean;
}

export interface NavigationSection {
    title?: string;
    items: NavigationItem[];
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    sidebarOpen: boolean;
    flash?: {
        success?: string;
        error?: string;
        warning?: string;
    };
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
