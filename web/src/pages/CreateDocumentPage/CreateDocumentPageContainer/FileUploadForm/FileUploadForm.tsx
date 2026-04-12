import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Label } from '../../../../components/ui/Label';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Spinner } from '../../../../components/ui/Spinner';
import { RuleSelector } from '../../../../components/RuleSelector';
import { RuleApplicability } from '@shared-types';
import {
  selectDirectoryId,
  selectUploadRules,
  setUploadRules
} from '../../../../store/slices/createDocumentPageSlice';
import { IFileUploadFormProps } from './IFileUploadForm';
import { fileUploadFormStyles } from './FileUploadForm.styles';
import { cn } from '../../../../lib/utils';
import type { RootState } from '../../../../store';

export const FileUploadForm = ({ isLoading, onSubmit }: IFileUploadFormProps) => {
  const dispatch = useDispatch();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redux selectors
  const directoryId = useSelector((state: RootState) => selectDirectoryId(state));
  const selectedRuleIds = useSelector((state: RootState) => selectUploadRules(state));

  const MAX_FILE_SIZE = 100 * 1024; // 100KB in bytes

  const handleRuleSelectionChange = (ruleIds: string[]) => {
    dispatch(setUploadRules(ruleIds));
  };

  const validateFile = (file: File): string | null => {
    if (file.type !== 'text/markdown' && !file.name.endsWith('.md')) {
      return 'Please select a markdown (.md) file';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / 1024}KB`;
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
      return;
    }
    setFileError(null);
    setSelectedFile(file);
    if (!title.trim()) {
      const fileName = file.name.replace(/\.md$/, '');
      setTitle(fileName);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    onSubmit({
      file: selectedFile,
      title: title.trim() || undefined,
      ruleIds: selectedRuleIds.length > 0 ? selectedRuleIds : undefined,
    });
  };

  const formatFileSize = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
  const canSubmit = selectedFile && !fileError;

  return (
    <form onSubmit={handleSubmit} className={fileUploadFormStyles.container}>
      {/* File Upload Area */}
      <div className={fileUploadFormStyles.formGroup}>
        <Label className={fileUploadFormStyles.label}>Markdown File *</Label>
        <div
          className={cn(
            fileUploadFormStyles.uploadArea,
            dragActive && fileUploadFormStyles.uploadAreaActive
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={36} className={fileUploadFormStyles.uploadIcon} />
          <p className="font-medium mb-1">Drop your markdown file here, or click to browse</p>
          <p className={fileUploadFormStyles.uploadText}>
            Supports .md files up to {MAX_FILE_SIZE / 1024}KB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isLoading}
          />
        </div>

        {fileError && (
          <div className="flex items-center gap-2 text-destructive text-sm mt-2">
            <AlertCircle size={16} />
            {fileError}
          </div>
        )}

        {selectedFile && !fileError && (
          <div className={fileUploadFormStyles.fileInfo}>
            <div className="flex items-center gap-2">
              <FileText size={16} />
              <div className="flex-1">
                <p className={fileUploadFormStyles.fileName}>{selectedFile.name}</p>
                <p className={fileUploadFormStyles.fileSize}>{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
          </div>
        )}

        <p className={fileUploadFormStyles.helpText}>
          Upload a markdown file to create a document.
        </p>
      </div>

      {/* Title */}
      <div className={fileUploadFormStyles.formGroup}>
        <Label htmlFor="title" className={fileUploadFormStyles.label}>
          Document Title (optional)
        </Label>
        <Input
          id="title"
          type="text"
          placeholder="Leave empty to use filename"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fileUploadFormStyles.input}
          disabled={isLoading}
        />
        <p className={fileUploadFormStyles.helpText}>
          Custom title for your document.
        </p>
      </div>

      {/* Rules — stacked */}
      {directoryId && (
        <div className="mb-4">
          <RuleSelector
            directoryId={directoryId}
            operation={RuleApplicability.UPLOAD}
            selectedRuleIds={selectedRuleIds}
            onSelectionChange={handleRuleSelectionChange}
            compact={true}
          />
        </div>
      )}
      
      {!directoryId && (
        <div className="border rounded-lg p-3 bg-muted/30 mb-4">
          <p className="text-xs text-muted-foreground text-center">
            📁 Select a directory to load applicable rules
          </p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!canSubmit || isLoading}
        className={fileUploadFormStyles.submitButton}
      >
        {isLoading ? (
          <>
            <Spinner size="xs" />
            Uploading File...
          </>
        ) : (
          <>
            <Upload size={16} />
            Create Document from File
          </>
        )}
      </Button>
    </form>
  );
};
