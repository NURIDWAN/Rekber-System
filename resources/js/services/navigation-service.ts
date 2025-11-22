import { NavigationItem, NavigationContext, UserRole, PageContext, AuthenticationState } from '@/lib/navigation-config';

/**
 * Navigation Service
 *
 * Centralized business logic for navigation permissions and visibility rules.
 * This service handles all the complex logic for determining what navigation
 * items should be visible to users based on their role, authentication state,
 * current page context, and other factors.
 */

export class NavigationService {
  /**
   * Check if a user has permission to see a navigation item
   */
  static canViewNavigationItem(
    item: NavigationItem,
    context: NavigationContext
  ): boolean {
    // Skip dividers - they're always visible if they're between visible items
    if (item.divider) {
      return true;
    }

    // Check authentication requirements
    if (!this.checkAuthenticationRequirement(item.requiredAuth, context.isAuthenticated)) {
      return false;
    }

    // Check role requirements
    if (!this.checkRoleRequirement(item.allowedRoles, context.userRole)) {
      return false;
    }

    // Check page context requirements
    if (!this.checkPageContextRequirement(item.pageContexts, context.currentPage)) {
      return false;
    }

    // Check room status requirements
    if (!this.checkRoomStatusRequirement(item.roomStatuses, context.roomStatus)) {
      return false;
    }

    // Check transaction state requirements
    if (!this.checkTransactionStateRequirement(item.transactionStates, context.transactionState)) {
      return false;
    }

    return true;
  }

  /**
   * Filter navigation items based on context
   */
  static filterNavigationItems(
    items: NavigationItem[],
    context: NavigationContext
  ): NavigationItem[] {
    return items.filter(item => this.canViewNavigationItem(item, context));
  }

  /**
   * Get navigation items grouped by permission level
   */
  static groupNavigationItemsByPermission(
    items: NavigationItem[],
    context: NavigationContext
  ) {
    return items.reduce((groups, item) => {
      if (item.divider) {
        return groups;
      }

      const permission = this.getItemPermissionLevel(item, context);
      if (!groups[permission]) {
        groups[permission] = [];
      }
      groups[permission].push(item);
      return groups;
    }, {} as Record<string, NavigationItem[]>);
  }

  /**
   * Get the permission level required for an item
   */
  static getItemPermissionLevel(
    item: NavigationItem,
    context: NavigationContext
  ): string {
    if (item.allowedRoles?.includes('gm')) return 'admin';
    if (item.allowedRoles?.includes('seller')) return 'seller';
    if (item.allowedRoles?.includes('buyer')) return 'buyer';
    if (item.requiredAuth === 'authenticated') return 'user';
    return 'public';
  }

  /**
   * Get primary navigation items for a specific context
   */
  static getPrimaryNavigationItems(
    items: NavigationItem[],
    context: NavigationContext,
    maxItems: number = 5
  ): NavigationItem[] {
    const filtered = this.filterNavigationItems(items, context);

    // Prioritize items based on importance
    const prioritized = filtered.sort((a, b) => {
      const aPriority = this.getItemPriority(a, context);
      const bPriority = this.getItemPriority(b, context);
      return bPriority - aPriority;
    });

    return prioritized.slice(0, maxItems);
  }

  /**
   * Get secondary/quick action navigation items
   */
  static getSecondaryNavigationItems(
    items: NavigationItem[],
    context: NavigationContext
  ): NavigationItem[] {
    const filtered = this.filterNavigationItems(items, context);

    // Return items that are typically quick actions or secondary navigation
    return filtered.filter(item =>
      item.title.includes('Settings') ||
      item.title.includes('Profile') ||
      item.title.includes('Help') ||
      item.title.includes('Documentation')
    );
  }

  /**
   * Check if user can perform specific room actions
   */
  static getRoomActionPermissions(
    context: NavigationContext
  ) {
    const { userRole, transactionState, roomStatus } = context;

    return {
      canUploadPayment: userRole === 'buyer' && (!transactionState || transactionState === 'pending_payment'),
      canUploadShipping: userRole === 'seller' && transactionState === 'paid',
      canRaiseDispute: ['buyer', 'seller'].includes(userRole!) &&
                       ['paid', 'shipped'].includes(transactionState || ''),
      canCompleteTransaction: userRole === 'buyer' && transactionState === 'delivered',
      canViewRoomDetails: !!context.isAuthenticated,
      canManageRoom: ['gm', 'seller'].includes(userRole!) || roomStatus === 'active',
      canSendMessage: !!context.isAuthenticated && roomStatus === 'active'
    };
  }

  /**
   * Get navigation suggestions based on user context
   */
  static getNavigationSuggestions(
    context: NavigationContext
  ): string[] {
    const suggestions: string[] = [];

    if (!context.isAuthenticated) {
      suggestions.push('Sign up to create rooms', 'Browse available rooms');
      return suggestions;
    }

    switch (context.userRole) {
      case 'buyer':
        if (context.currentPage === 'dashboard') {
          suggestions.push('Browse rooms', 'View your transactions');
        } else if (context.currentPage === 'rooms') {
          suggestions.push('Join a room', 'Check transaction status');
        }
        break;

      case 'seller':
        if (context.currentPage === 'dashboard') {
          suggestions.push('Create new room', 'Manage active rooms');
        } else if (context.currentPage === 'rooms') {
          suggestions.push('List your items', 'Track orders');
        }
        break;

      case 'gm':
        suggestions.push('Monitor rooms', 'Handle disputes', 'User management');
        break;

      default:
        suggestions.push('Complete profile', 'Explore features');
    }

    return suggestions;
  }

  /**
   * Get navigation breadcrumbs for current context
   */
  static getBreadcrumbs(
    context: NavigationContext,
    currentPageTitle?: string
  ): Array<{ title: string; href: string }> {
    const breadcrumbs: Array<{ title: string; href: string }> = [
      { title: 'Home', href: '/' }
    ];

    if (context.currentPage === 'rooms') {
      breadcrumbs.push({ title: 'Rooms', href: '/rooms' });
    } else if (context.currentPage === 'room_detail') {
      breadcrumbs.push({ title: 'Rooms', href: '/rooms' });
      if (currentPageTitle) {
        breadcrumbs.push({ title: currentPageTitle, href: '#' });
      }
    } else if (context.currentPage === 'dashboard') {
      breadcrumbs.push({ title: 'Dashboard', href: '/dashboard' });
    } else if (context.currentPage === 'gm_dashboard') {
      breadcrumbs.push({ title: 'Admin', href: '/gm/dashboard' });
    }

    return breadcrumbs;
  }

  // Private helper methods

  private static checkAuthenticationRequirement(
    requiredAuth: AuthenticationState | undefined,
    isAuthenticated: boolean
  ): boolean {
    if (!requiredAuth) return true;

    switch (requiredAuth) {
      case 'public':
        return true;
      case 'authenticated':
        return isAuthenticated;
      case 'partial':
        return true; // Partial auth would need more specific logic
      default:
        return true;
    }
  }

  private static checkRoleRequirement(
    allowedRoles: UserRole[] | undefined,
    userRole: UserRole | undefined
  ): boolean {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    if (!userRole) return false;

    return allowedRoles.includes(userRole);
  }

  private static checkPageContextRequirement(
    pageContexts: PageContext[] | undefined,
    currentPage: PageContext | undefined
  ): boolean {
    if (!pageContexts || pageContexts.length === 0) return true;
    if (!currentPage) return false;

    return pageContexts.includes(currentPage);
  }

  private static checkRoomStatusRequirement(
    roomStatuses: string[] | undefined,
    currentRoomStatus: string | undefined
  ): boolean {
    if (!roomStatuses || roomStatuses.length === 0) return true;
    if (!currentRoomStatus) return false;

    return roomStatuses.includes(currentRoomStatus);
  }

  private static checkTransactionStateRequirement(
    transactionStates: string[] | undefined,
    currentTransactionState: string | undefined
  ): boolean {
    if (!transactionStates || transactionStates.length === 0) return true;
    if (!currentTransactionState) return false;

    return transactionStates.includes(currentTransactionState);
  }

  private static getItemPriority(
    item: NavigationItem,
    context: NavigationContext
  ): number {
    let priority = 0;

    // Higher priority for items matching current page context
    if (item.pageContexts?.includes(context.currentPage!)) {
      priority += 10;
    }

    // Higher priority for role-appropriate items
    if (item.allowedRoles?.includes(context.userRole!)) {
      priority += 5;
    }

    // Higher priority for main navigation items
    if (!item.title.includes('Settings') &&
        !item.title.includes('Help') &&
        !item.title.includes('Documentation')) {
      priority += 3;
    }

    // Lower priority for external links
    if (item.isExternal) {
      priority -= 2;
    }

    return priority;
  }
}

// Export singleton instance for easy usage
export const navigationService = NavigationService;