import { DirectoryChatArtifactContext } from '@shared-types';

export interface IDirectoryChatPanel {
  directoryId: string;
  sourceCount?: number;
  className?: string;
  compact?: boolean;
  /** When true, renders a collapsed chip by default; user can expand to full panel. */
  collapsible?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  seedMessage?: string;
  seedKey?: string;
  artifactContext?: DirectoryChatArtifactContext;
  autoSendSeed?: boolean;
}
