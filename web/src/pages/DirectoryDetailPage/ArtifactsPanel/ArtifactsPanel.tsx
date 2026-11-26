import React, { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { AlertTriangle } from 'lucide-react';
import { ArtifactSummary, sortArtifactsForDisplay } from '@shared-types';
import { Button } from '../../../components/ui/Button';
import type { CreateArtifactModalType } from '../../../components/CreateArtifactModal';
import { selectPendingGenerations } from '../../../store/slices/artifactGenerationSlice';
import { ArtifactRow, ArtifactRowGenerating } from '../ArtifactRow';
import { selectOptimisticGeneratingPlaceholders } from '../hooks/useOptimisticGeneratingRow';
import { useBulkArtifactPanel } from '../hooks/useBulkArtifactPanel';
import { useArtifactPrefetch } from './useArtifactPrefetch';
import {
  ARTIFACT_TYPE_CONFIGS,
  buildArtifactLink,
  getArtifactTypeConfig,
} from './artifactTypeConfig';
import type { ArtifactToDelete } from '../DeleteArtifactDialog';

export interface IArtifactsPanelProps {
  /** Every artifact in the directory, any types. */
  artifacts: ArtifactSummary[];
  directoryId: string;
  /** True when at least one type hit the per-type load cap. */
  mayBeTruncated?: boolean;
  perTypeLimit: number;
  onDeleteArtifact: (artifact: ArtifactToDelete) => void;
  ruleNamesMap?: Map<string, string>;
  onCreate: (type: CreateArtifactModalType) => void;
}

/**
 * Directory Artifacts tab, shaped like a NotebookLM Studio panel: creation
 * tiles on top, then every artifact in one list, newest first (no manual
 * reorder). Generating placeholders sit at the top.
 */
export const ArtifactsPanel: React.FC<IArtifactsPanelProps> = ({
  artifacts,
  directoryId,
  mayBeTruncated = false,
  perTypeLimit,
  onDeleteArtifact,
  ruleNamesMap,
  onCreate,
}) => {
  const sorted = useMemo(() => sortArtifactsForDisplay(artifacts), [artifacts]);
  const pendingGenerations = useSelector(selectPendingGenerations);
  const placeholders = useMemo(
    () =>
      ARTIFACT_TYPE_CONFIGS.flatMap((config) =>
        selectOptimisticGeneratingPlaceholders(
          pendingGenerations,
          directoryId,
          config.createType,
          artifacts.filter((artifact) => artifact.type === config.type),
        ).map((placeholder) => ({ ...placeholder, label: config.label })),
      ),
    [artifacts, directoryId, pendingGenerations],
  );
  const prefetch = useArtifactPrefetch();
  const bulk = useBulkArtifactPanel({ artifacts: sorted, entityLabel: 'artifacts' });
  const visibleCount = sorted.length + placeholders.length;

  const renderArtifact = useCallback(
    (artifact: ArtifactSummary) => {
      const config = getArtifactTypeConfig(artifact.type);
      return (
        <ArtifactRow
          icon={config.icon}
          title={artifact.title}
          typeLabel={config.label}
          createdAt={artifact.createdAt}
          linkTo={buildArtifactLink(artifact.type, artifact.id, directoryId)}
          onDelete={() =>
            onDeleteArtifact({
              id: artifact.id,
              title: artifact.title,
              type: artifact.type,
            })
          }
          deleteAriaLabel={`Delete ${artifact.title}`}
          appliedRuleNames={artifact.appliedRuleIds?.map(
            (id) => ruleNamesMap?.get(id) ?? 'Unknown prompt',
          )}
          completedAt={artifact.completedAt}
          generationModel={artifact.generationModel}
          generationStatus={artifact.generationStatus}
          generationError={artifact.generationError}
          documentColor={artifact.documentColor}
          documentColors={artifact.documentColors}
          onLinkHover={() => prefetch(artifact.type, artifact.id)}
          selected={bulk.isSelected(artifact.id)}
          onSelectChange={() => bulk.toggle(artifact.id)}
        />
      );
    },
    [bulk, directoryId, onDeleteArtifact, prefetch, ruleNamesMap],
  );

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Create an artifact"
      >
        {ARTIFACT_TYPE_CONFIGS.map((config) => {
          const Icon = config.icon;
          return (
            <Button
              key={config.type}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full px-3 text-xs"
              onClick={() => onCreate(config.createType)}
              aria-label={`Create ${config.tileLabel.toLowerCase()}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="font-medium">{config.tileLabel}</span>
            </Button>
          );
        })}
      </div>

      <div className="min-h-10">
        {bulk.selectedIds.length > 0 ? (
          bulk.toolbar
        ) : (
          <h2 className="flex min-h-10 items-center text-lg font-semibold">
            Artifacts ({visibleCount})
          </h2>
        )}
      </div>

      {mayBeTruncated ? (
        <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm text-primary">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            Showing the newest {perTypeLimit} of each type. More may exist.
          </span>
        </div>
      ) : null}

      {visibleCount === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No artifacts in this directory yet. Pick a type above to create one.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {placeholders.map((placeholder) => (
            <ArtifactRowGenerating key={placeholder.id} title={placeholder.title} />
          ))}
          {sorted.map((artifact) => (
            <React.Fragment key={`${artifact.type}:${artifact.id}`}>
              {renderArtifact(artifact)}
            </React.Fragment>
          ))}
        </div>
      )}
      {bulk.dialogs}
    </div>
  );
};
