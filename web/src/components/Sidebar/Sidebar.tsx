import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, CircleHelp, LogOut, X } from 'lucide-react';
import {
  Sidebar as SharedSidebar,
  SidebarNav,
  SidebarNavItem,
  SidebarSection,
  sidebarClassNames,
} from '@study-forge/ui';
import { useSecureSignOut } from '../../hooks/useSecureSignOut';
import { cn } from '../../lib/utils';
import type { ISidebar, ISidebarNavigationItem } from './ISidebar';
import { sidebarStyles } from './Sidebar.styles';
import {
  accountNavigationItems,
  isSidebarItemActive,
  settingsNavigationItem,
  studyNavigationItems,
  toolNavigationItems,
  usageNavigationItem,
} from './sidebarNavigation';
import {
  selectSidebarIsOpen,
  setSidebarOpen,
} from '../../store/slices/uiSlice';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useGetUsageSummaryQuery } from '../../store/api/Usage/usageApi';
import { formatUsagePlanLabel } from '../../utils/usagePlanLabel';
import { useSupportAppEntryUrl } from '../../hooks/useSupportAppEntryUrl';
import { Button } from '../ui/Button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '../ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/Tooltip';

export const Sidebar = ({ className }: ISidebar) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { signOut } = useSecureSignOut();
  const supportAppUrl = useSupportAppEntryUrl();
  const isOpen = useSelector(selectSidebarIsOpen);
  const isMobile = useIsMobile();
  const accountTriggerRef = React.useRef<HTMLButtonElement>(null);
  const firstAccountItemRef = React.useRef<HTMLButtonElement>(null);
  const { data: usageSummary } = useGetUsageSummaryQuery(undefined, {
    skip: !user,
  });
  const planLabel = formatUsagePlanLabel(usageSummary?.usageLimitsSetupName);
  const utilityItems: ISidebarNavigationItem[] = [usageNavigationItem];

  if (supportAppUrl) {
    utilityItems.push({
      id: 'help',
      title: 'Help & support',
      path: supportAppUrl,
      icon: CircleHelp,
    });
  }
  utilityItems.push(settingsNavigationItem);

  React.useEffect(() => {
    if (isMobile) {
      dispatch(setSidebarOpen(false));
    }
  }, [isMobile, dispatch]);

  const handleSidebarOpenChange = (open: boolean) => {
    dispatch(setSidebarOpen(open));
  };

  const handleNavigate = () => {
    if (isMobile) {
      dispatch(setSidebarOpen(false));
    }
  };

  const handleAccountNavigate = (path: string) => {
    navigate(path);
    handleNavigate();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const renderNavigationItem = (
    item: ISidebarNavigationItem,
    isUtility = false,
  ) => {
    const ItemIcon = item.icon;
    const isActive = isSidebarItemActive(item, location.pathname);

    return (
      <Tooltip key={item.id}>
        <SidebarNavItem
          asChild
          isActive={isActive}
          className={cn(
            sidebarStyles.navItem,
            isUtility && sidebarStyles.utilityItem,
            !isOpen && 'justify-center',
            isActive && sidebarStyles.navItemActive,
          )}
        >
          <TooltipTrigger asChild>
            <Link
              to={item.path}
              onClick={handleNavigate}
              aria-label={item.title}
              aria-current={isActive ? 'page' : undefined}
            >
              <ItemIcon
                className={sidebarClassNames.navItemIcon}
                aria-hidden="true"
              />
              <span
                className={isOpen ? sidebarClassNames.navItemText : 'sr-only'}
              >
                {item.title}
              </span>
            </Link>
          </TooltipTrigger>
        </SidebarNavItem>
        {!isOpen && (
          <TooltipContent side="right" className={sidebarStyles.tooltip}>
            {item.title}
          </TooltipContent>
        )}
      </Tooltip>
    );
  };

  const accountMenu = user ? (
    <div className="mx-2 border-t border-border/60">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={accountTriggerRef}
            variant="ghost"
            aria-label="Account options"
            className={cn(
              sidebarStyles.accountTrigger,
              !isOpen && sidebarStyles.accountTriggerCollapsed,
              location.pathname === '/profile' &&
                sidebarStyles.accountTriggerActive,
            )}
          >
            <span className={sidebarClassNames.avatar} aria-hidden="true">
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </span>
            {isOpen && (
              <>
                <span className={sidebarClassNames.profileInfo}>
                  <span className={sidebarClassNames.profilePrimary}>
                    {user.displayName || user.email}
                  </span>
                  {planLabel && (
                    <span className={sidebarClassNames.profileSecondary}>
                      {planLabel}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={14}
                  className="shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isOpen ? 'top' : 'right'}
          align={isOpen ? 'start' : 'end'}
          className={sidebarStyles.accountMenu}
          aria-label="Account options"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            firstAccountItemRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            accountTriggerRef.current?.focus();
          }}
        >
          <div className="px-2 py-2 text-xs text-muted-foreground">
            <div className="truncate">{user.email}</div>
            {planLabel && <div className="mt-1">{planLabel}</div>}
          </div>
          {accountNavigationItems.map((item, index) => {
            const ItemIcon = item.icon;
            const isActive = isSidebarItemActive(item, location.pathname);
            return (
              <DropdownMenuItem
                key={item.id}
                ref={index === 0 ? firstAccountItemRef : undefined}
                onClick={() => handleAccountNavigate(item.path)}
                className={cn(
                  'gap-2',
                  isActive && 'bg-primary/10 text-primary',
                )}
              >
                <ItemIcon size={16} aria-hidden="true" />
                {item.title}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="gap-2">
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null;

  const sidebar = (
    <SharedSidebar
      className={cn(
        sidebarClassNames.container,
        isOpen ? sidebarClassNames.expanded : sidebarClassNames.collapsed,
        sidebarStyles.container,
        isMobile && sidebarStyles.mobileSidebar,
        className,
      )}
      header={
        isMobile ? (
          <div className="flex justify-end px-3 pt-2">
            <DialogClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close navigation">
                <X size={16} aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
        ) : undefined
      }
      footer={
        <div>
          <SidebarNav
            className={cn(
              sidebarClassNames.navList,
              sidebarStyles.navList,
              sidebarStyles.utilities,
            )}
            aria-label="Utilities"
          >
            {utilityItems.map((item) => renderNavigationItem(item, true))}
          </SidebarNav>
          {accountMenu}
        </div>
      }
      aria-label="Main navigation"
    >
      <div className={sidebarStyles.scrollArea}>
        <SidebarSection
          label="Study"
          isOpen={isOpen}
          className={sidebarStyles.section}
        >
          <SidebarNav
            className={cn(sidebarClassNames.navList, sidebarStyles.navList)}
            aria-label="Study"
          >
            {studyNavigationItems.map((item) => renderNavigationItem(item))}
          </SidebarNav>
        </SidebarSection>
        <SidebarSection
          label="Tools"
          isOpen={isOpen}
          className={sidebarStyles.section}
        >
          <SidebarNav
            className={cn(
              sidebarClassNames.navList,
              sidebarStyles.navList,
              !isOpen && 'mt-4',
            )}
            aria-label="Tools"
          >
            {toolNavigationItems.map((item) => renderNavigationItem(item))}
          </SidebarNav>
        </SidebarSection>
      </div>
    </SharedSidebar>
  );

  return (
    <TooltipProvider delayDuration={200}>
      {isMobile ? (
        <Dialog open={isOpen} onOpenChange={handleSidebarOpenChange}>
          <DialogPortal>
            <DialogOverlay className={sidebarStyles.mobileOverlay} />
            <DialogPrimitive.Content
              aria-modal="true"
              className={sidebarStyles.mobileContent}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                document.getElementById('sidebar-toggle')?.focus();
              }}
            >
              <DialogTitle className="sr-only">Main navigation</DialogTitle>
              <DialogDescription className="sr-only">
                Study destinations, tools, and account options.
              </DialogDescription>
              {sidebar}
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      ) : (
        sidebar
      )}
    </TooltipProvider>
  );
};
