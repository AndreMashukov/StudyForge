import { DirectoryChatArtifactContext } from '@shared-types';

export interface IDirectoryChatPanel {
  directoryId: string;
  sourceCount?: number;
  className?: string;
  compact?: boolean;
  /** When true, renders a collapsed trigger by default; user can expand to full panel. */
  collapsible?: boolean;
  /** Collapsed trigger layout. Defaults to `chip`. */
  collapsedVariant?: 'chip' | 'bar';
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** When true (default), shows a header toggle for page-wide expansion. */
  expandable?: boolean;
  /** Header and collapsed trigger label. Defaults to `Chat`. */
  title?: string;
  /** Message input placeholder when chat is available. */
  placeholder?: string;
  /** When set, selects these documents as chat sources after metadata loads. */
  focusedDocumentIds?: string[];
  seedMessage?: string;
  seedKey?: string;
  artifactContext?: DirectoryChatArtifactContext;
  autoSendSeed?: boolean;
}
