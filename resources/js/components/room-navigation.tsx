import { useRoomNavigation } from '@/hooks/use-dynamic-navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link, usePage } from '@inertiajs/react';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare,
  CreditCard,
  Package,
  AlertTriangle,
  UserCheck,
  Upload,
  FileText,
  Shield,
  Activity
} from 'lucide-react';

interface RoomNavigationProps {
  className?: string;
  roomStatus?: string;
  transactionState?: string;
  compact?: boolean;
}

export function RoomNavigation({
  className,
  roomStatus,
  transactionState,
  compact = false
}: RoomNavigationProps) {
  const page = usePage();
  const { roomActions, canUploadPayment, canUploadShipping, canRaiseDispute, canCompleteTransaction } = useRoomNavigation();

  const getActionIcon = (title: string) => {
    switch (title) {
      case 'Room Chat':
        return MessageSquare;
      case 'Upload Payment Proof':
        return CreditCard;
      case 'Upload Shipping Receipt':
        return Package;
      case 'Raise Dispute':
        return AlertTriangle;
      case 'Complete Transaction':
        return UserCheck;
      default:
        return Activity;
    }
  };

  const getActionButtonVariant = (title: string) => {
    switch (title) {
      case 'Upload Payment Proof':
        return 'default';
      case 'Upload Shipping Receipt':
        return 'secondary';
      case 'Raise Dispute':
        return 'destructive';
      case 'Complete Transaction':
        return 'default';
      default:
        return 'outline';
    }
  };

  if (compact) {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {roomActions.map((action) => {
          const Icon = getActionIcon(action.title);
          return (
            <Button
              key={action.href}
              variant={getActionButtonVariant(action.title) as any}
              size="sm"
              className="flex items-center gap-2"
              asChild
            >
              <Link href={action.href}>
                <Icon className="h-4 w-4" />
                <span>{action.title}</span>
              </Link>
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Room Status and Transaction State */}
      {(roomStatus || transactionState) && (
        <div className="flex flex-wrap items-center gap-2">
          {roomStatus && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Status: {roomStatus}
            </Badge>
          )}
          {transactionState && (
            <Badge variant="outline" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {transactionState}
            </Badge>
          )}
        </div>
      )}

      {/* Available Actions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Available Actions</h3>

        {roomActions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/25 p-4 text-center text-sm text-muted-foreground">
            No actions available at this time
          </div>
        ) : (
          <div className="grid gap-2">
            {roomActions.map((action) => {
              const Icon = getActionIcon(action.title);
              const isDisabled = (
                (action.title === 'Upload Payment Proof' && !canUploadPayment) ||
                (action.title === 'Upload Shipping Receipt' && !canUploadShipping) ||
                (action.title === 'Raise Dispute' && !canRaiseDispute) ||
                (action.title === 'Complete Transaction' && !canCompleteTransaction)
              );

              return (
                <Button
                  key={action.href}
                  variant={getActionButtonVariant(action.title) as any}
                  className={cn(
                    'w-full justify-start gap-3',
                    isDisabled && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={isDisabled}
                  asChild={!isDisabled}
                >
                  {isDisabled ? (
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span>{action.title}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Not Available
                      </Badge>
                    </div>
                  ) : (
                    <Link href={action.href} className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{action.title}</span>
                      {action.badge && (
                        <Badge variant="secondary" className="ml-auto">
                          {action.badge}
                        </Badge>
                      )}
                    </Link>
                  )}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Role-specific help text */}
      <div className="rounded-lg border border-muted bg-muted/50 p-3">
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Your Role Actions:</p>
            <ul className="space-y-1">
              {canUploadPayment && (
                <li>• Upload payment proof when required</li>
              )}
              {canUploadShipping && (
                <li>• Upload shipping receipt after payment</li>
              )}
              {canRaiseDispute && (
                <li>• Raise disputes if issues arise</li>
              )}
              {canCompleteTransaction && (
                <li>• Complete transaction when goods are received</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Quick action buttons for inline use
export function RoomQuickActions({ className }: { className?: string }) {
  const { roomActions } = useRoomNavigation();

  const primaryActions = roomActions.filter(action =>
    ['Upload Payment Proof', 'Upload Shipping Receipt', 'Complete Transaction'].includes(action.title)
  );

  if (primaryActions.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {primaryActions.map((action) => {
        const Icon = action.icon || Activity;
        return (
          <Button
            key={action.href}
            variant="default"
            size="sm"
            className="flex items-center gap-2"
            asChild
          >
            <Link href={action.href}>
              <Icon className="h-4 w-4" />
              <span>{action.title}</span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

// Room navigation sidebar component
export function RoomSidebar({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <RoomNavigation compact={false} />
      </div>

      <Separator />

      {/* Additional room-specific info can go here */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Room Information</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Use the available actions above to interact with this room.</p>
          <p>All actions are logged and visible to all participants.</p>
        </div>
      </div>
    </div>
  );
}