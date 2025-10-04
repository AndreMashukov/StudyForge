/**
 * SourceTabs Component
 * Tab navigation for switching between Upload Files and Library Documents
 */

import React from 'react';
import { Upload, BookOpen } from 'lucide-react';
import { ISourceTabs, SourceTabType } from './ISourceTabs';
import { sourceTabsStyles } from './SourceTabs.styles';
import { cn } from '../../../../../lib/utils';

export const SourceTabs = ({
  activeTab,
  onTabChange,
  uploadCount,
  libraryCount,
  disabled = false,
}: ISourceTabs) => {
  const handleTabClick = (tab: SourceTabType) => {
    if (!disabled) {
      onTabChange(tab);
    }
  };

  return (
    <div className={sourceTabsStyles.container}>
      <div className={sourceTabsStyles.tabsList} role="tablist">
        {/* Upload Files Tab */}
        <button
          role="tab"
          aria-selected={activeTab === 'upload'}
          aria-controls="upload-panel"
          id="upload-tab"
          className={cn(
            sourceTabsStyles.tab,
            activeTab === 'upload' 
              ? sourceTabsStyles.tabActive 
              : sourceTabsStyles.tabInactive
          )}
          onClick={() => handleTabClick('upload')}
          disabled={disabled}
          type="button"
        >
          <Upload className={sourceTabsStyles.icon} />
          <span>Upload Files</span>
          {uploadCount > 0 && (
            <span 
              className={cn(
                sourceTabsStyles.count,
                activeTab === 'upload' && sourceTabsStyles.countActive
              )}
              aria-label={`${uploadCount} uploaded file${uploadCount !== 1 ? 's' : ''}`}
            >
              {uploadCount}
            </span>
          )}
        </button>

        {/* Library Documents Tab */}
        <button
          role="tab"
          aria-selected={activeTab === 'library'}
          aria-controls="library-panel"
          id="library-tab"
          className={cn(
            sourceTabsStyles.tab,
            activeTab === 'library' 
              ? sourceTabsStyles.tabActive 
              : sourceTabsStyles.tabInactive
          )}
          onClick={() => handleTabClick('library')}
          disabled={disabled}
          type="button"
        >
          <BookOpen className={sourceTabsStyles.icon} />
          <span>Library</span>
          {libraryCount > 0 && (
            <span 
              className={cn(
                sourceTabsStyles.count,
                activeTab === 'library' && sourceTabsStyles.countActive
              )}
              aria-label={`${libraryCount} library document${libraryCount !== 1 ? 's' : ''}`}
            >
              {libraryCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

