import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { cn } from '../../../../lib/utils';
import { setSelectedSource, selectSelectedSource } from '../../../../store/slices/createDocumentPageSlice';
import { SourceType } from '../../types/ISourceTypes';
import { sourceListPanelStyles } from './SourceListPanel.styles';
import type { RootState } from '../../../../store';

const sources = [
  {
    id: 'textPrompt' as SourceType,
    icon: '✨',
    title: 'AI Prompt',
    description: 'Generate from description',
    status: 'active' as const,
  },
  {
    id: 'website' as SourceType,
    icon: '🌐',
    title: 'Website URL',
    description: 'Scrape web content',
    status: 'active' as const,
  },
  {
    id: 'file' as SourceType,
    icon: '📄',
    title: 'File Upload',
    description: 'Upload MD file',
    status: 'active' as const,
  },
  {
    id: 'videoUrl' as SourceType,
    icon: '🎥',
    title: 'Video URL',
    description: 'Extract from video',
    status: 'coming-soon' as const,
  },
];

export const SourceListPanel = () => {
  const dispatch = useDispatch();
  const selectedSource = useSelector((state: RootState) => selectSelectedSource(state));

  const handleSourceSelect = (sourceType: SourceType, status: string) => {
    if (status !== 'active') return;
    dispatch(setSelectedSource(sourceType));
  };

  return (
    <div className={sourceListPanelStyles.container}>
      <h3 className={sourceListPanelStyles.header}>Source Type</h3>

      {sources.map((source) => {
        const isActive = selectedSource === source.id;
        const isDisabled = source.status !== 'active';

        return (
          <div
            key={source.id}
            className={cn(
              sourceListPanelStyles.sourceItem,
              isActive && sourceListPanelStyles.sourceItemActive,
              isDisabled && sourceListPanelStyles.sourceItemDisabled,
            )}
            onClick={() => handleSourceSelect(source.id, source.status)}
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            aria-pressed={isActive}
            aria-disabled={isDisabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSourceSelect(source.id, source.status);
              }
            }}
          >
            <div className={cn(
              sourceListPanelStyles.sourceIcon,
              isActive && sourceListPanelStyles.sourceIconActive,
            )}>
              {source.icon}
            </div>
            <div className={sourceListPanelStyles.sourceInfo}>
              <div className={sourceListPanelStyles.sourceName}>{source.title}</div>
              {isDisabled ? (
                <span className={sourceListPanelStyles.soonBadge}>Coming Soon</span>
              ) : (
                <div className={sourceListPanelStyles.sourceDesc}>{source.description}</div>
              )}
            </div>
          </div>
        );
      })}

      <div className={sourceListPanelStyles.tipsSection}>
        <h3 className={sourceListPanelStyles.tipsTitle}>Quick Tips</h3>
        <div className={sourceListPanelStyles.tipsContent}>
          <p>💡 Be specific in your prompt for better results.</p>
          <p>📎 Attach reference files for context-aware generation.</p>
          <p>🎯 Use rules to customize output format.</p>
        </div>
      </div>
    </div>
  );
};
