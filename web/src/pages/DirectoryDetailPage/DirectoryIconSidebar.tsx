import React from 'react';
import { FileText, Brain, Layers, Presentation, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';

export type PanelType = 'sources' | 'quizzes' | 'cards' | 'slides' | 'rules';

interface SidebarButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  panel: PanelType;
  activePanel: PanelType;
  onPanelChange: (panel: PanelType) => void;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({
  icon: Icon,
  label,
  panel,
  activePanel,
  onPanelChange,
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
      aria-label={label}
      aria-pressed={isActive}
    >
      <Icon size={20} />
      <span className="text-[10px] leading-tight font-medium">{label}</span>
    </Button>
  );
};

interface DirectoryIconSidebarProps {
  activePanel: PanelType;
  onPanelChange: (panel: PanelType) => void;
}

const CONTENT_ITEMS: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; panel: PanelType }[] = [
  { icon: FileText, label: 'Sources', panel: 'sources' },
  { icon: Brain, label: 'Quizzes', panel: 'quizzes' },
  { icon: Layers, label: 'Cards', panel: 'cards' },
  { icon: Presentation, label: 'Slides', panel: 'slides' },
];

const SETTINGS_ITEMS: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; panel: PanelType }[] = [
  { icon: Settings, label: 'Rules', panel: 'rules' },
];

export const DirectoryIconSidebar: React.FC<DirectoryIconSidebarProps> = ({
  activePanel,
  onPanelChange,
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
