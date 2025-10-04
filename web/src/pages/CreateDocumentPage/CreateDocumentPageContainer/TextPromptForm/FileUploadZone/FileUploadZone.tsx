/**
 * FileUploadZone Component
 * Drag & drop zone and file input for uploading reference documents
 */

import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { IFileUploadZoneProps } from './IFileUploadZone';
import { fileUploadZoneStyles } from './FileUploadZone.styles';
import { cn } from '../../../../../lib/utils';
import { FILE_UPLOAD_CONSTRAINTS } from '../../../../../types/fileUpload';

export const FileUploadZone = ({ 
  onFilesSelected, 
  canAttachMore, 
  maxFiles,
  disabled = false 
}: IFileUploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && canAttachMore) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || !canAttachMore) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleClick = () => {
    if (!disabled && canAttachMore && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const isDisabled = disabled || !canAttachMore;

  return (
    <div
      className={cn(
        fileUploadZoneStyles.container,
        isDragging 
          ? fileUploadZoneStyles.containerDragging 
          : isDisabled 
            ? fileUploadZoneStyles.containerDisabled 
            : fileUploadZoneStyles.containerIdle
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label="Upload files"
      aria-disabled={isDisabled}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={FILE_UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.join(',')}
        onChange={handleFileInputChange}
        className={fileUploadZoneStyles.input}
        disabled={isDisabled}
      />
      
      <div className={fileUploadZoneStyles.inner}>
        <Upload className={fileUploadZoneStyles.icon} />
        
        <div>
          <p className={fileUploadZoneStyles.title}>
            {isDisabled 
              ? `Maximum ${maxFiles} files reached` 
              : 'Drop files here or click to browse'}
          </p>
          {!isDisabled && (
            <>
              <p className={fileUploadZoneStyles.description}>
                .txt and .md files only, up to 5MB each
              </p>
              <p className={fileUploadZoneStyles.helpText}>
                Add reference documents to provide context for the AI
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

