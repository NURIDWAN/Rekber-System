import { LucideIcon, Home, MessageSquare, ShoppingBag, Users, FileText, Settings, HelpCircle, Shield, Activity, CreditCard, Package, Truck, AlertTriangle, UserCheck, LogOut, User } from 'lucide-react';
import { NavItem } from '@/types';

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

export interface NavigationItem extends Partial<NavItem> {
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

// Main navigation configuration
export const navigationConfig: NavigationSection[] = [
  {
    title: 'Main Navigation',
    items: [
      {
        title: 'Home',
        href: '/',
        icon: Home,
        pageContexts: ['home', 'rooms', 'marketplace', 'how_it_works'],
        requiredAuth: 'public'
      },
      {
        title: 'Rooms',
        href: '/rooms',
        icon: MessageSquare,
        pageContexts: ['home', 'rooms', 'marketplace', 'how_it_works'],
        requiredAuth: 'public'
      },
      {
        title: 'How It Works',
        href: '/how-it-works',
        icon: HelpCircle,
        pageContexts: ['home', 'rooms', 'marketplace', 'how_it_works'],
        requiredAuth: 'public'
      }
    ]
  },
  {
    title: 'Dashboard',
    items: [
      {
        title: 'GM Dashboard',
        href: '/dashboard',
        icon: Shield,
        requiredAuth: 'authenticated',
        allowedRoles: ['gm'],
        pageContexts: ['gm_dashboard', 'dashboard']
      },
      {
        title: 'Room Management',
        href: '/gm/rooms',
        icon: Users,
        requiredAuth: 'authenticated',
        allowedRoles: ['gm'],
        pageContexts: ['gm_dashboard']
      },
      {
        title: 'Transactions',
        href: '/transactions',
        icon: CreditCard,
        requiredAuth: 'authenticated',
        allowedRoles: ['gm'],
        pageContexts: ['gm_dashboard']
      }
    ]
  },
  {
    title: 'Support',
    items: [
      {
        title: 'Documentation',
        href: '/docs',
        icon: FileText,
        requiredAuth: 'public',
        isExternal: true
      },
      {
        title: 'Help Center',
        href: '/help',
        icon: HelpCircle,
        requiredAuth: 'public'
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: Settings,
        requiredAuth: 'authenticated'
      }
    ]
  }
];

// Context-specific navigation items
export const roomNavigationItems: NavigationItem[] = [
  {
    title: 'Room Chat',
    href: '#',
    icon: MessageSquare,
    badge: 'Chat',
    pageContexts: ['room_detail']
  },
  {
    title: 'Upload Payment Proof',
    href: '#',
    icon: CreditCard,
    allowedRoles: ['buyer'],
    pageContexts: ['room_detail'],
    transactionStates: ['pending_payment']
  },
  {
    title: 'Upload Shipping Receipt',
    href: '#',
    icon: Package,
    allowedRoles: ['seller'],
    pageContexts: ['room_detail'],
    transactionStates: ['paid']
  },
  {
    title: 'Raise Dispute',
    href: '#',
    icon: AlertTriangle,
    allowedRoles: ['buyer', 'seller'],
    pageContexts: ['room_detail'],
    transactionStates: ['paid', 'shipped']
  },
  {
    title: 'Complete Transaction',
    href: '#',
    icon: UserCheck,
    allowedRoles: ['buyer'],
    pageContexts: ['room_detail'],
    transactionStates: ['delivered']
  }
];

// Quick action items for dropdown menus
export const quickActionItems: NavigationItem[] = [
  {
    title: 'Create New Room',
    href: '/rooms/create',
    icon: Users,
    requiredAuth: 'authenticated',
    allowedRoles: ['seller']
  },
  {
    title: 'Join Room',
    href: '/rooms/join',
    icon: MessageSquare,
    requiredAuth: 'authenticated',
    allowedRoles: ['buyer']
  },
  {
    title: 'Browse Rooms',
    href: '/rooms',
    icon: Users,
    requiredAuth: 'public'
  },
  {
    title: 'Profile Settings',
    href: '/profile',
    icon: Settings,
    requiredAuth: 'authenticated'
  },
  {
    divider: true
  },
  {
    title: 'Log Out',
    href: '/logout',
    icon: LogOut,
    requiredAuth: 'authenticated',
    isExternal: true
  }
];

// Marketing navigation (public pages)
export const marketingNavItems: NavigationItem[] = [
  {
    title: 'Home',
    href: '/',
    icon: Home,
    requiredAuth: 'public'
  },
  {
    title: 'Rooms',
    href: '/rooms',
    icon: Users,
    requiredAuth: 'public'
  },
  {
    title: 'How It Works',
    href: '/how-it-works',
    icon: HelpCircle,
    requiredAuth: 'public'
  }
];

// Auth CTAs for marketing layout
export const authCTAItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: Activity,
    requiredAuth: 'authenticated'
  }
];

// Default export for backward compatibility
export default navigationConfig;
