import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Settings,
  User,
  FileText,
  Sparkles,
  LogOut,
  BarChart3,
  Gauge,
  CircleHelp,
} from 'lucide-react';
import { useSecureSignOut } from '../../hooks/useSecureSignOut';
import {
  Sidebar as SharedSidebar,
  SidebarNav,
  SidebarNavItem,
  SidebarProfileFooter,
  SidebarSection,
  sidebarClassNames,
} from '@study-forge/ui';
import { cn } from '../../lib/utils';
import { ISidebar } from './ISidebar';
import {
  selectSidebarIsOpen,
  setSidebarOpen,
  toggleSidebar,
} from '../../store/slices/uiSlice';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useGetUsageSummaryQuery } from '../../store/api/Usage/usageApi';
import { formatUsagePlanLabel } from '../../utils/usagePlanLabel';
import { useSupportAppEntryUrl } from '../../hooks/useSupportAppEntryUrl';

interface NavItem {
  id: string;
  title: string;
  path?: string;
  href?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  section: 'navigation' | 'account';
}

const staticNavItems: NavItem[] = [
  {
    id: 'home',
    title: 'Dashboard',
    path: '/',
    icon: Home,
    section: 'navigation',
  },
  {
    id: 'documents',
    title: 'My Directories',
    path: '/documents',
    icon: FileText,
    section: 'navigation',
  },
  {
    id: 'statistics',
    title: 'Statistics',
    path: '/statistics',
    icon: BarChart3,
    section: 'navigation',
  },
  {
    id: 'rules-manager',
    title: 'Rules Manager',
    path: '/rules',
    icon: Sparkles,
    section: 'navigation',
  },
  {
    id: 'profile',
    title: 'Profile',
    path: '/profile',
    icon: User,
    section: 'account',
  },
  {
    id: 'usage',
    title: 'Usage',
    path: '/usage',
    icon: Gauge,
    section: 'account',
  },
  {
    id: 'settings',
    title: 'Settings',
    path: '/settings',
    icon: Settings,
    section: 'account',
  },
];

const sectionLabels: Record<string, string> = {
  navigation: 'Navigation',
  account: 'Account',
};

const sectionOrder = ['navigation', 'account'];

export const Sidebar = ({ className }: ISidebar) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { signOut } = useSecureSignOut();
  const supportAppUrl = useSupportAppEntryUrl();

  const navItems = React.useMemo(() => {
    const settingsIndex = staticNavItems.findIndex(
      (item) => item.id === 'settings',
    );
    if (!supportAppUrl || settingsIndex < 0) {
      return staticNavItems;
    }

    const helpItem: NavItem = {
      id: 'help',
      title: 'Help',
      href: supportAppUrl,
      icon: CircleHelp,
      section: 'account',
    };

    return [
      ...staticNavItems.slice(0, settingsIndex),
      helpItem,
      ...staticNavItems.slice(settingsIndex),
    ];
  }, [supportAppUrl]);

  const isOpen = useSelector(selectSidebarIsOpen);
  const isMobile = useIsMobile();
  const { data: usageSummary } = useGetUsageSummaryQuery(undefined, {
    skip: !user,
  });
  const planLabel = formatUsagePlanLabel(usageSummary?.usageLimitsSetupName);

  // Desktop default is open; on narrow viewports hide the drawer until toggled.
  React.useEffect(() => {
    if (isMobile) {
      dispatch(setSidebarOpen(false));
    }
  }, [isMobile, dispatch]);

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const handleNavigateToItem = (item: NavItem) => {
    if (item.href) {
      window.location.assign(item.href);
      return;
    }
    if (item.path) {
      navigate(item.path);
    }
    if (isMobile) {
      dispatch(setSidebarOpen(false));
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const isItemActive = (item: NavItem) =>
    Boolean(item.path) && location.pathname === item.path;

  if (isMobile && !isOpen) {
    return null;
  }

  const overlay =
    isMobile && isOpen ? (
      <div
        className="fixed inset-0 bg-black/50 z-[1199]"
        onClick={handleToggleSidebar}
        aria-hidden="true"
      />
    ) : null;

  const footer = user ? (
    <SidebarProfileFooter
      avatarLabel={user.email?.charAt(0).toUpperCase()}
      primaryText={user.email}
      secondaryText={planLabel}
      isOpen={isOpen}
      action={
        <button
          className={cn(
            sidebarClassNames.footerAction,
            !isOpen && 'relative group justify-center p-0',
          )}
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          <LogOut
            size={isOpen ? 14 : 16}
            className={sidebarClassNames.navItemIcon}
          />
          {!isOpen ? (
            <div className={sidebarClassNames.collapsedTooltip}>Sign out</div>
          ) : null}
        </button>
      }
    />
  ) : null;

  return (
    <SharedSidebar
      className={cn(
        sidebarClassNames.container,
        isOpen ? sidebarClassNames.expanded : sidebarClassNames.collapsed,
        isMobile && isOpen && 'w-[280px]',
        className,
      )}
      overlay={overlay}
      footer={footer}
      aria-label="Main navigation"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scrollbar-hidden">
        {sectionOrder.map((section) => (
          <SidebarSection
            key={section}
            label={sectionLabels[section]}
            isOpen={isOpen}
          >
            <SidebarNav
              className={sidebarClassNames.navList}
              aria-label={sectionLabels[section]}
            >
              {navItems
                .filter((item) => item.section === section)
                .map((item) => {
                  const ItemIcon = item.icon;
                  const itemIsActive = isItemActive(item);

                  return (
                    <SidebarNavItem
                      key={item.id}
                      isActive={itemIsActive}
                      icon={
                        <ItemIcon
                          className={sidebarClassNames.navItemIcon}
                          size={16}
                        />
                      }
                      label={
                        isOpen ? (
                          <span className={sidebarClassNames.navItemText}>
                            {item.title}
                          </span>
                        ) : (
                          <div className={sidebarClassNames.collapsedTooltip}>
                            {item.title}
                          </div>
                        )
                      }
                      className={cn(
                        !isOpen && 'justify-center relative group',
                        itemIsActive && sidebarClassNames.navItemActive,
                      )}
                      onClick={() => handleNavigateToItem(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleNavigateToItem(item);
                        }
                      }}
                    />
                  );
                })}
            </SidebarNav>
          </SidebarSection>
        ))}
      </div>
    </SharedSidebar>
  );
};
