/**
 * AttachedFileItem Component
 * Displays individual attached file with status and remove button
 */

import React from 'react';
import { FileText, Loader2, AlertCircle, X, BookOpen } from 'lucide-react';
import { IAttachedFileItemProps } from './IAttachedFileItem';
import { attachedFileItemStyles } from './AttachedFileItem.styles';
import { cn } from '../../../../../../lib/utils';
import { formatFileSize, formatTokenCount } from '../../../../../../utils/fileUploadUtils';

export const AttachedFileItem = ({ file, onRemove }: IAttachedFileItemProps) => {
  const isLibraryDocument = file.source === 'library';
  
  const getStatusIcon = () => {
    const iconClass = attachedFileItemStyles.icon;
    
    if (isLibraryDocument) {
      // Library document icons (purple)
      switch (file.status) {
        case 'ready':
          return <BookOpen className={cn(iconClass, 'text-purple-500')} />;
        case 'reading':
          return <Loader2 className={cn(iconClass, 'text-purple-500 animate-spin')} />;
        case 'error':
          return <AlertCircle className={cn(iconClass, attachedFileItemStyles.iconError)} />;
        default:
          return <BookOpen className={iconClass} />;
      }
    } else {
      // Uploaded file icons (green)
      switch (file.status) {
        case 'ready':
          return <FileText className={cn(iconClass, attachedFileItemStyles.iconReady)} />;
        case 'reading':
          return <Loader2 className={cn(iconClass, attachedFileItemStyles.iconReading)} />;
        case 'error':
          return <AlertCircle className={cn(iconClass, attachedFileItemStyles.iconError)} />;
        default:
          return <FileText className={iconClass} />;
      }
    }
  };

  return (
    <div className={attachedFileItemStyles.container}>
      <div className={attachedFileItemStyles.fileInfo}>
        {getStatusIcon()}
        
        <div className={attachedFileItemStyles.fileDetails}>
          <p className={attachedFileItemStyles.fileName} title={file.filename}>
            {file.filename}
          </p>
          
          {file.status === 'ready' && (
            <div className={attachedFileItemStyles.fileMeta}>
              <span className={attachedFileItemStyles.fileSize}>
                {formatFileSize(file.size)}
              </span>
              <span className={attachedFileItemStyles.separator}>•</span>
              <span className={attachedFileItemStyles.fileTokens}>
                ~{formatTokenCount(file.estimatedTokens)} tokens
              </span>
            </div>
          )}
          
          {file.status === 'reading' && (
            <p className={attachedFileItemStyles.fileMeta}>
              Reading file...
            </p>
          )}
          
          {file.status === 'error' && file.error && (
            <p className={attachedFileItemStyles.errorText}>
              {file.error}
            </p>
          )}
        </div>
      </div>
      
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        className={attachedFileItemStyles.removeButton}
        aria-label={`Remove ${file.filename}`}
        title="Remove file"
      >
        <X className={attachedFileItemStyles.removeIcon} />
      </button>
    </div>
  );
};

