import React from 'react';
import { FileText, MessageSquare, Settings, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';

import type { DirectoryTab } from '../../utils/directoryUrl';

export type PanelType = DirectoryTab;

interface SidebarButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  panel: PanelType;
  activePanel: PanelType;
  onPanelChange: (panel: PanelType) => void;
  count?: number;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({
  icon: Icon,
  label,
  panel,
  activePanel,
  onPanelChange,
  count,
}) => {
  const isActive = activePanel === panel;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onPanelChange(panel)}
      className={cn(
        'flex flex-col items-center justify-center gap-1 w-full py-2 px-1 rounded-md transition-colors h-auto',
        isActive
          ? 'text-[#8B5CF6] bg-[#8B5CF6]/10'
          : 'text-[#9CA3AF] hover:text-foreground hover:bg-muted/50'
      )}
      aria-label={count === undefined ? label : `${label} (${count})`}
      aria-pressed={isActive}
    >
      <span className="relative">
        <Icon size={20} />
        {count ? (
          <span className="absolute -right-3 -top-2 min-w-4 rounded-full bg-muted px-1 text-center text-[9px] font-semibold leading-4 text-foreground">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </span>
      <span className="text-[10px] leading-tight font-medium">{label}</span>
    </Button>
  );
};

interface DirectoryIconSidebarProps {
  activePanel: PanelType;
  onPanelChange: (panel: PanelType) => void;
  /** Item counts shown on the content entries (documents, artifacts, chats). */
  counts?: Partial<Record<PanelType, number>>;
}

const CONTENT_ITEMS: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; panel: PanelType }[] = [
  { icon: FileText, label: 'Documents', panel: 'sources' },
  { icon: Sparkles, label: 'Artifacts', panel: 'artifacts' },
  { icon: MessageSquare, label: 'Chats', panel: 'chats' },
];

const SETTINGS_ITEMS: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; panel: PanelType }[] = [
  { icon: Settings, label: 'Prompts', panel: 'rules' },
];

export const DirectoryIconSidebar: React.FC<DirectoryIconSidebarProps> = ({
  activePanel,
  onPanelChange,
  counts,
}) => {
  return (
    <nav
      className="w-[60px] shrink-0 flex flex-col items-center py-4 border-r border-border bg-transparent"
      aria-label="Directory content"
    >
      <div className="flex flex-col gap-1 w-full px-2">
        {CONTENT_ITEMS.map((item) => (
          <SidebarButton
            key={item.panel}
            icon={item.icon}
            label={item.label}
            panel={item.panel}
            activePanel={activePanel}
            onPanelChange={onPanelChange}
            count={counts?.[item.panel]}
          />
        ))}
      </div>

      <div className="w-8 h-px bg-border my-3" />

      <div className="flex flex-col gap-1 w-full px-2">
        {SETTINGS_ITEMS.map((item) => (
          <SidebarButton
            key={item.panel}
            icon={item.icon}
            label={item.label}
            panel={item.panel}
            activePanel={activePanel}
            onPanelChange={onPanelChange}
          />
        ))}
      </div>
    </nav>
  );
};
