import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronsLeft, 
  ChevronsRight, 
  Home, 
  Settings, 
  User,
  FileText,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useSignOut } from 'react-firebase-hooks/auth';
import { auth } from '../../config/firebase';

import { cn } from '../../lib/utils';
import { ISidebar } from './ISidebar';
import { sidebarStyles } from './Sidebar.styles';
import {
  selectSidebarIsOpen,
  toggleSidebar,
} from '../../store/slices/uiSlice';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  id: string;
  title: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  section: 'navigation' | 'account';
}

const navItems: NavItem[] = [
  { id: 'home', title: 'Dashboard', path: '/', icon: Home, section: 'navigation' },
  { id: 'documents', title: 'My Directories', path: '/documents', icon: FileText, section: 'navigation' },
  { id: 'rules-manager', title: 'Rules Manager', path: '/rules', icon: Sparkles, section: 'navigation' },
  { id: 'profile', title: 'Profile', path: '/profile', icon: User, section: 'account' },
  { id: 'settings', title: 'Settings', path: '/settings', icon: Settings, section: 'account' },
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
  const [signOut] = useSignOut(auth);
  
  const isOpen = useSelector(selectSidebarIsOpen);
  
  // Mobile detection
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const handleNavigateToItem = (path: string) => {
    navigate(path);
    if (isMobile) {
      dispatch(toggleSidebar());
    }
  };

  const handleSignOut = async () => {
    const success = await signOut();
    if (success) {
      navigate('/auth');
    }
  };

  const isItemActive = (path: string) => location.pathname === path;

  // Don't render sidebar on mobile when closed
  if (isMobile && !isOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[1199]"
          onClick={handleToggleSidebar}
          aria-hidden="true"
        />
      )}
      
      <aside
        className={cn(
          sidebarStyles.container,
          isOpen ? sidebarStyles.expanded : sidebarStyles.collapsed,
          // Mobile: full overlay when open
          isMobile && isOpen && "w-[280px]",
          className
        )}
      >
        {/* Header with toggle button */}
        <div className={cn(
          sidebarStyles.header,
          isOpen ? sidebarStyles.headerExpanded : sidebarStyles.headerCollapsed
        )}>
          <button
            type="button"
            onClick={handleToggleSidebar}
            className={sidebarStyles.toggleButton}
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isOpen ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
          </button>
          {isOpen && (
            <h2 className={sidebarStyles.headerTitle}>
              Code Insights AI
            </h2>
          )}
        </div>

        {/* Nav items grouped by section */}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hidden">
          {sectionOrder.map((section) => (
            <div key={section}>
              {isOpen && (
                <div className={sidebarStyles.navSectionLabel}>
                  {sectionLabels[section]}
                </div>
              )}
              <div className={sidebarStyles.itemsList}>
                {navItems
                  .filter((item) => item.section === section)
                  .map((item) => {
                    const ItemIcon = item.icon;
                    const itemIsActive = isItemActive(item.path);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          sidebarStyles.item,
                          itemIsActive && sidebarStyles.itemActive,
                          !isOpen && 'justify-center relative group'
                        )}
                        onClick={() => handleNavigateToItem(item.path)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleNavigateToItem(item.path);
                          }
                        }}
                      >
                        <ItemIcon className={sidebarStyles.itemIcon} size={16} />
                        {isOpen && (
                          <span className={sidebarStyles.itemText}>{item.title}</span>
                        )}
                        {!isOpen && (
                          <div className={sidebarStyles.collapsedTooltip}>{item.title}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* User profile footer */}
        {user && (
          <div className={cn(
            sidebarStyles.sidebarFooter,
            isOpen ? sidebarStyles.sidebarFooterExpanded : sidebarStyles.sidebarFooterCollapsed
          )}>
            <div className={sidebarStyles.userAvatar}>
              {user.email?.charAt(0).toUpperCase()}
            </div>
            {isOpen && (
              <>
                <div className={sidebarStyles.userInfo}>
                  <span className={sidebarStyles.userEmail}>{user.email}</span>
                  <span className={sidebarStyles.userLabel}>Free plan</span>
                </div>
                <button
                  className={sidebarStyles.signOutBtn}
                  onClick={handleSignOut}
                  aria-label="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </>
            )}
            {!isOpen && (
              <button
                className="relative group justify-center cursor-pointer bg-transparent border-none p-0"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                <LogOut size={16} className={sidebarStyles.itemIcon} />
                <div className={sidebarStyles.collapsedTooltip}>Sign out</div>
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
