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
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { ISidebar } from './ISidebar';
import { sidebarStyles } from './Sidebar.styles';
import {
  selectSidebarIsOpen,
  toggleSidebar,
} from '../../store/slices/uiSlice';

interface NavItem {
  id: string;
  title: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const navItems: NavItem[] = [
  { id: 'home', title: 'Dashboard', path: '/', icon: Home },
  { id: 'documents', title: 'My Directories', path: '/documents', icon: FileText },
  { id: 'rules-manager', title: 'Rules Manager', path: '/rules', icon: Sparkles },
  { id: 'profile', title: 'Profile', path: '/profile', icon: User },
  { id: 'settings', title: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar = ({ className }: ISidebar) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  
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

      {/* Nav items */}
      <div className="flex flex-col flex-1">
        <div className={cn(sidebarStyles.itemsList, 'pt-2')}>
          {navItems.map((item) => {
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
    </aside>
    </>
  );
};