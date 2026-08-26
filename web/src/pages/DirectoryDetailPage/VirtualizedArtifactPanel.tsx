import React, { useCallback } from 'react';
import { AlertTriangle, LucideIcon } from 'lucide-react';
import { ArtifactSummary, ArtifactSummaryType } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { SortableDirectoryList } from './SortableDirectoryList';
import { ArtifactRow, ArtifactRowGenerating } from './ArtifactRow';
import { useOptimisticGeneratingRow } from './hooks/useOptimisticGeneratingRow';
import { useBulkArtifactPanel } from './hooks/useBulkArtifactPanel';
import { ArtifactPanelType } from '../../store/slices/artifactGenerationSlice';

interface IVirtualizedArtifactPanelProps<TType extends ArtifactSummaryType> {
  artifacts: ArtifactSummary[];
  directoryId: string;
  panelType: ArtifactPanelType;
  title: string;
  createLabel: string;
  onCreate: () => void;
  emptyMessage: string;
  entityLabel: string;
  artifactType: TType;
  icon: LucideIcon;
  buildLinkTo: (artifactId: string) => string;
  onDeleteArtifact: (artifact: {
    id: string;
    title: string;
    type: TType;
  }) => void;
  onPrefetch?: (artifactId: string) => void;
  ruleNamesMap?: Map<string, string>;
  mayBeTruncated?: boolean;
}

export const VirtualizedArtifactPanel = <TType extends ArtifactSummaryType>({
  artifacts,
  directoryId,
  panelType,
  title,
  createLabel,
  onCreate,
  emptyMessage,
  entityLabel,
  artifactType,
  icon,
  buildLinkTo,
  onDeleteArtifact,
  onPrefetch,
  ruleNamesMap,
  mayBeTruncated = false,
}: IVirtualizedArtifactPanelProps<TType>): React.JSX.Element => {
  const { placeholders } = useOptimisticGeneratingRow(directoryId, panelType);
  const visibleCount = artifacts.length + placeholders.length;
  const bulk = useBulkArtifactPanel({
    artifacts,
    artifactType,
    entityLabel,
  });

  const renderArtifact = useCallback(
    (artifact: ArtifactSummary) => (
      <ArtifactRow
        icon={icon}
        title={artifact.title}
        createdAt={artifact.createdAt}
        linkTo={buildLinkTo(artifact.id)}
        onDelete={() =>
          onDeleteArtifact({
            id: artifact.id,
            title: artifact.title,
            type: artifactType,
          })
        }
        deleteAriaLabel={`Delete ${artifact.title}`}
        appliedRuleNames={artifact.appliedRuleIds?.map(
          (id) => ruleNamesMap?.get(id) ?? 'Unknown rule',
        )}
        completedAt={artifact.completedAt}
        generationModel={artifact.generationModel}
        generationStatus={artifact.generationStatus}
        generationError={artifact.generationError}
        documentColor={artifact.documentColor}
        documentColors={artifact.documentColors}
        onLinkHover={onPrefetch ? () => onPrefetch(artifact.id) : undefined}
        selected={bulk.isSelected(artifact.id)}
        onSelectChange={() => bulk.toggle(artifact.id)}
      />
    ),
    [
      artifactType,
      buildLinkTo,
      bulk,
      icon,
      onDeleteArtifact,
      onPrefetch,
      ruleNamesMap,
    ],
  );

  return (
    <div className="space-y-4">
      <div className="min-h-10">
        {bulk.selectedIds.length > 0 ? (
          bulk.toolbar
        ) : (
          <div className="flex min-h-10 items-center justify-between gap-2">
            <h2 className="truncate text-lg font-semibold">
              {title} ({visibleCount})
            </h2>
            <Button size="sm" type="button" onClick={onCreate}>
              {createLabel}
            </Button>
          </div>
        )}
      </div>
      {mayBeTruncated ? (
        <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm text-primary">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            Showing first {artifacts.length} {entityLabel} — more may exist.
          </span>
        </div>
      ) : null}
      {artifacts.length === 0 && placeholders.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <SortableDirectoryList
          items={artifacts}
          directoryId={directoryId}
          itemType={artifactType}
          gap={8}
          leadingContent={
            placeholders.length > 0 ? (
              <>
                {placeholders.map((placeholder) => (
                  <ArtifactRowGenerating
                    key={placeholder.id}
                    title={placeholder.title}
                  />
                ))}
              </>
            ) : null
          }
          renderItem={renderArtifact}
        />
      )}
      {bulk.dialogs}
    </div>
  );
};
