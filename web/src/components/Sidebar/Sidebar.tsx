import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronsLeft, 
  ChevronsRight, 
  ChevronUp, 
  ChevronDown, 
  Home, 
  BookOpen, 
  Settings, 
  User,
  FileText,
  BarChart3,
  FolderOpen,
  Plus,
  Brain
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { ISidebar, SidebarSection } from './ISidebar';
import { sidebarStyles } from './Sidebar.styles';
import {
  selectSidebarIsOpen,
  selectSidebarOpenSections,
  selectSidebarActiveSection,
  toggleSidebar,
  toggleSidebarSection,
  setSidebarActiveSection,
} from '../../store/slices/uiSlice';

// Define sidebar menu structure for the Code Insights AI app
const sidebarSections: SidebarSection[] = [
  {
    id: 'main',
    title: 'Main',
    icon: Home,
    items: [
      {
        id: 'home',
        title: 'Dashboard',
        path: '/',
        icon: Home,
      },
    ],
  },
  {
    id: 'content',
    title: 'Content',
    icon: FolderOpen,
    items: [
      {
        id: 'documents',
        title: 'Documents Library',
        path: '/documents',
        icon: FileText,
      },
      {
        id: 'create-document',
        title: 'Create Document',
        path: '/documents/create',
        icon: Plus,
      },
    ],
  },
  {
    id: 'quizzes',
    title: 'Quizzes',
    icon: Brain,
    items: [
      {
        id: 'my-quizzes',
        title: 'My Quizzes',
        path: '/quizzes',
        icon: BookOpen,
      },
      {
        id: 'quiz-results',
        title: 'Results',
        path: '/quizzes/results',
        icon: BarChart3,
      },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    icon: User,
    items: [
      {
        id: 'profile',
        title: 'Profile',
        path: '/profile',
        icon: User,
      },
      {
        id: 'settings',
        title: 'Settings',
        path: '/settings',
        icon: Settings,
      },
    ],
  },
];

export const Sidebar = ({ className }: ISidebar) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isOpen = useSelector(selectSidebarIsOpen);
  const openSections = useSelector(selectSidebarOpenSections);
  const activeSection = useSelector(selectSidebarActiveSection);

  // Initialize open sections on mount - only when expanded
  React.useEffect(() => {
    if (openSections.length === 0 && isOpen) {
      // Open all sections by default when expanded
      sidebarSections.forEach(section => {
        dispatch(toggleSidebarSection(section.id));
      });
    }
  }, [dispatch, openSections.length, isOpen]);

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const handleToggleSection = (sectionId: string) => {
    // Only allow section toggling when sidebar is expanded
    if (isOpen) {
      dispatch(toggleSidebarSection(sectionId));
      dispatch(setSidebarActiveSection(sectionId === activeSection ? null : sectionId));
    }
  };

  const handleNavigateToItem = (path: string, sectionId: string) => {
    dispatch(setSidebarActiveSection(sectionId));
    navigate(path);
  };

  const isSectionOpen = (sectionId: string) => openSections.includes(sectionId);
  const isItemActive = (path: string) => location.pathname === path;

  return (
    <aside
      className={cn(
        sidebarStyles.container,
        isOpen ? sidebarStyles.expanded : sidebarStyles.collapsed,
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

      {/* Sidebar sections */}
      <div className="flex flex-col flex-1">
        {sidebarSections.map((section) => {
          const IconComponent = section.icon;
          const sectionIsOpen = isSectionOpen(section.id);
          const isActive = activeSection === section.id;

          if (!isOpen) {
            // Collapsed state - preserve exact same structure, hide only text
            return (
              <div key={section.id} className={sidebarStyles.section}>
                {/* Section Header */}
                <div
                  className={cn(
                    sidebarStyles.sectionHeader,
                    sidebarStyles.collapsedSectionHeader
                  )}
                  onClick={() => handleToggleSection(section.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleToggleSection(section.id);
                    }
                  }}
                  aria-expanded={sectionIsOpen}
                  aria-controls={`section-${section.id}`}
                >
                  <div className="flex items-center gap-2 flex-1 justify-center relative group">
                    <div
                      className={cn(
                        sidebarStyles.sectionIcon,
                        isActive && sidebarStyles.sectionIconActive
                      )}
                    >
                      <IconComponent size={16} />
                    </div>
                    {/* Tooltip for collapsed state */}
                    <div className={sidebarStyles.collapsedTooltip}>
                      {section.title}
                    </div>
                  </div>
                  <div className={sidebarStyles.collapseIcon}>
                    {sectionIsOpen ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </div>
                </div>

                {/* Section Content - preserve structure */}
                <div
                  id={`section-${section.id}`}
                  className={cn(
                    sidebarStyles.sectionContent,
                    sectionIsOpen
                      ? sidebarStyles.sectionContentOpen
                      : sidebarStyles.sectionContentClosed
                  )}
                >
                  <div className={sidebarStyles.itemsList}>
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      const itemIsActive = isItemActive(item.path);

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            sidebarStyles.item,
                            itemIsActive && sidebarStyles.itemActive,
                            "relative group justify-center"
                          )}
                          onClick={() => handleNavigateToItem(item.path, section.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              handleNavigateToItem(item.path, section.id);
                            }
                          }}
                        >
                          {ItemIcon && (
                            <ItemIcon className={sidebarStyles.itemIcon} size={16} />
                          )}
                          {/* Tooltip for collapsed state */}
                          <div className={sidebarStyles.collapsedTooltip}>
                            {item.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          // Expanded state - show full sections with items
          return (
            <div key={section.id} className={sidebarStyles.section}>
              {/* Section Header */}
              <div
                className={sidebarStyles.sectionHeader}
                onClick={() => handleToggleSection(section.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleToggleSection(section.id);
                  }
                }}
                aria-expanded={sectionIsOpen}
                aria-controls={`section-${section.id}`}
              >
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={cn(
                      sidebarStyles.sectionIcon,
                      isActive && sidebarStyles.sectionIconActive
                    )}
                  >
                    <IconComponent size={16} />
                  </div>
                  <span className={sidebarStyles.sectionTitle}>
                    {section.title}
                  </span>
                </div>
                <div className={sidebarStyles.collapseIcon}>
                  {sectionIsOpen ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </div>
              </div>

              {/* Section Content */}
              <div
                id={`section-${section.id}`}
                className={cn(
                  sidebarStyles.sectionContent,
                  sectionIsOpen
                    ? sidebarStyles.sectionContentOpen
                    : sidebarStyles.sectionContentClosed
                )}
              >
                <div className={sidebarStyles.itemsList}>
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    const itemIsActive = isItemActive(item.path);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          sidebarStyles.item,
                          itemIsActive && sidebarStyles.itemActive
                        )}
                        onClick={() => handleNavigateToItem(item.path, section.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleNavigateToItem(item.path, section.id);
                          }
                        }}
                      >
                        {ItemIcon && (
                          <ItemIcon className={sidebarStyles.itemIcon} size={16} />
                        )}
                        <span className={sidebarStyles.itemText}>
                          {item.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};