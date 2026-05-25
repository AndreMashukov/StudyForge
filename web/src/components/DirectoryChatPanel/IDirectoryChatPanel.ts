import { DirectoryChatArtifactContext } from '@shared-types';

export interface IDirectoryChatPanel {
  directoryId: string;
  sourceCount?: number;
  className?: string;
  compact?: boolean;
  seedMessage?: string;
  seedKey?: string;
  artifactContext?: DirectoryChatArtifactContext;
  autoSendSeed?: boolean;
}
