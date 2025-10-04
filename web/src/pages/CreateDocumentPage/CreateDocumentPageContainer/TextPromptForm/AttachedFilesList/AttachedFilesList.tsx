/**
 * AttachedFilesList Component
 * Displays list of attached files with context size meter
 */

import React from 'react';
import { IAttachedFilesListProps } from './IAttachedFilesList';
import { AttachedFileItem } from './AttachedFileItem';
import { attachedFilesListStyles } from './AttachedFilesList.styles';
import { cn } from '../../../../../lib/utils';
import { calculateContextPercentage, formatTokenCount } from '../../../../../utils/fileUploadUtils';

export const AttachedFilesList = ({
  files,
  onRemoveFile,
  totalTokens,
  maxTokens,
  contextSizeError,
}: IAttachedFilesListProps) => {
  if (files.length === 0) return null;

  const percentage = calculateContextPercentage(totalTokens);
  const isWarning = percentage >= 75 && percentage < 100;
  const isError = percentage >= 100;

  const getProgressFillClass = () => {
    if (isError) return attachedFilesListStyles.progressFillError;
    if (isWarning) return attachedFilesListStyles.progressFillWarning;
    return attachedFilesListStyles.progressFillNormal;
  };

  const getValueClass = () => {
    if (isError) return attachedFilesListStyles.contextMeterValueError;
    if (isWarning) return attachedFilesListStyles.contextMeterValueWarning;
    return attachedFilesListStyles.contextMeterValue;
  };

  return (
    <div className={attachedFilesListStyles.container}>
      <div className={attachedFilesListStyles.filesContainer}>
        {files.map((file) => (
          <AttachedFileItem
            key={file.id}
            file={file}
            onRemove={onRemoveFile}
          />
        ))}
      </div>

      {/* Context Size Meter */}
      <div className={attachedFilesListStyles.contextMeter}>
        <div className={attachedFilesListStyles.contextMeterHeader}>
          <span className={attachedFilesListStyles.contextMeterTitle}>
            Context Size
          </span>
          <span className={getValueClass()}>
            {formatTokenCount(totalTokens)} / {formatTokenCount(maxTokens)} tokens ({percentage.toFixed(0)}%)
          </span>
        </div>

        <div className={attachedFilesListStyles.progressBar}>
          <div
            className={cn(
              attachedFilesListStyles.progressFill,
              getProgressFillClass()
            )}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>

        {contextSizeError && (
          <p className={attachedFilesListStyles.errorText}>
            {contextSizeError}
          </p>
        )}

        {isWarning && !isError && (
          <p className={attachedFilesListStyles.helpText}>
            Context size is getting large. Consider removing some files.
          </p>
        )}

        {!isWarning && !isError && (
          <p className={attachedFilesListStyles.helpText}>
            {files.length} {files.length === 1 ? 'file' : 'files'} attached. Files will be used as context for document generation.
          </p>
        )}
      </div>
    </div>
  );
};

