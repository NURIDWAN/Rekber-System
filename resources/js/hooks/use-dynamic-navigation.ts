import { useMemo } from 'react';
import { usePage } from '@inertiajs/react';
import {
  navigationConfig,
  roomNavigationItems,
  marketingNavItems,
  authCTAItems,
  quickActionItems,
  NavigationContext,
  NavigationItem,
  NavigationSection,
  UserRole,
  PageContext,
  AuthenticationState
} from '@/lib/navigation-config';

interface UseDynamicNavigationReturn {
  mainNav: NavigationItem[];
  sidebarNav: NavigationSection[];
  topNav: NavigationItem[];
  authCTA: NavigationItem[];
  quickActions: NavigationItem[];
  roomActions: NavigationItem[];
  context: NavigationContext;
}

export function useDynamicNavigation(): UseDynamicNavigationReturn {
  const page = usePage();

  const context = useMemo((): NavigationContext => {
    const url = page.url as string;
    const auth = page.props.auth as any;

    // Determine current page context
    let currentPage: PageContext = 'home';
    if (url.includes('/rooms/') && url.split('/').length > 2) {
      currentPage = 'room_detail';
    } else if (url.includes('/rooms')) {
      currentPage = 'rooms';
    } else if (url.includes('/gm/')) {
      currentPage = 'gm_dashboard';
    } else if (url.includes('/dashboard')) {
      currentPage = 'dashboard';
    } else if (url.includes('/marketplace')) {
      currentPage = 'marketplace';
    } else if (url.includes('/how-it-works')) {
      currentPage = 'how_it_works';
    }

    // Determine authentication state and user role
    const isAuthenticated = !!auth?.user;
    const userRole = getUserRole(auth?.user);

    return {
      isAuthenticated,
      userRole,
      currentPage,
      isOnline: auth?.user?.is_online || false,
      hasUnreadMessages: auth?.user?.unread_messages > 0,
    };
  }, [page]);

  // Filter items based on context
  const filterNavigationItems = (items: NavigationItem[]): NavigationItem[] => {
    return items.filter(item => {
      // Skip dividers for filtering logic
      if (item.divider) return true;

      // Check authentication requirements
      if (item.requiredAuth) {
        if (item.requiredAuth === 'public' && context.isAuthenticated && !item.allowedRoles) {
          // Public items that should be hidden for authenticated users unless they have specific roles
          return false;
        }
        if (item.requiredAuth === 'authenticated' && !context.isAuthenticated) {
          return false;
        }
      }

      // Check role requirements
      if (item.allowedRoles && context.userRole && !item.allowedRoles.includes(context.userRole)) {
        return false;
      }

      // Check page context requirements
      if (item.pageContexts && context.currentPage && !item.pageContexts.includes(context.currentPage)) {
        return false;
      }

      // Check room status requirements (would come from page props in real implementation)
      if (item.roomStatuses && context.roomStatus && !item.roomStatuses.includes(context.roomStatus)) {
        return false;
      }

      // Check transaction state requirements
      if (item.transactionStates && context.transactionState && !item.transactionStates.includes(context.transactionState)) {
        return false;
      }

      return true;
    });
  };

  // Filter navigation sections
  const filterNavigationSections = (sections: NavigationSection[]): NavigationSection[] => {
    return sections
      .map(section => ({
        ...section,
        items: filterNavigationItems(section.items)
      }))
      .filter(section => section.items.length > 0);
  };

  const mainNav = useMemo(() => {
    return filterNavigationItems(
      navigationConfig.flatMap(section => section.items)
    );
  }, [context]);

  const sidebarNav = useMemo(() => {
    return filterNavigationSections(navigationConfig);
  }, [context]);

  const topNav = useMemo(() => {
    if (context.isAuthenticated) {
      return filterNavigationItems(
        navigationConfig
          .flatMap(section => section.items)
          .filter(item => item.allowedRoles?.includes(context.userRole!) || !item.allowedRoles)
      );
    }
    return filterNavigationItems(marketingNavItems);
  }, [context]);

  const authCTA = useMemo(() => {
    return filterNavigationItems(authCTAItems);
  }, [context]);

  const quickActions = useMemo(() => {
    return filterNavigationItems(quickActionItems);
  }, [context]);

  const roomActions = useMemo(() => {
    if (context.currentPage === 'room_detail') {
      return filterNavigationItems(roomNavigationItems);
    }
    return [];
  }, [context]);

  return {
    mainNav,
    sidebarNav,
    topNav,
    authCTA,
    quickActions,
    roomActions,
    context
  };
}

// Helper function to determine user role
function getUserRole(user: any): UserRole | undefined {
  if (!user) return undefined;

  // Check if user has specific role properties
  if (user.role) {
    switch (user.role.toLowerCase()) {
      case 'gm':
      case 'admin':
        return 'gm';
      case 'seller':
        return 'seller';
      case 'buyer':
        return 'buyer';
      default:
        return 'regular';
    }
  }

  // Check user properties to infer role
  if (user.is_gm || user.is_admin) return 'gm';
  if (user.is_seller) return 'seller';
  if (user.is_buyer) return 'buyer';

  return 'regular';
}

// Additional hook for specific use cases
export function useNavigationContext(): NavigationContext {
  const { context } = useDynamicNavigation();
  return context;
}

// Hook for room-specific navigation
export function useRoomNavigation() {
  const { roomActions, context } = useDynamicNavigation();

  return {
    roomActions,
    canUploadPayment: context.userRole === 'buyer' && ['pending_payment'].includes(context.transactionState || ''),
    canUploadShipping: context.userRole === 'seller' && ['paid'].includes(context.transactionState || ''),
    canRaiseDispute: ['buyer', 'seller'].includes(context.userRole!) &&
                     ['paid', 'shipped'].includes(context.transactionState || ''),
    canCompleteTransaction: context.userRole === 'buyer' && ['delivered'].includes(context.transactionState || ''),
  };
}