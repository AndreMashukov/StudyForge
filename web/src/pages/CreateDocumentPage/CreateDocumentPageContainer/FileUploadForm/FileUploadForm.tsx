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
import { DOCUMENT_UPLOAD_CONSTRAINTS } from '../../../../types/documentUpload';
import {
  formatDocumentFileSize,
  getDocumentUploadTypeLabel,
  stripDocumentUploadExtension,
  validateDocumentUploadFile,
} from '../../../../utils/documentUploadUtils';
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

  const handleRuleSelectionChange = (ruleIds: string[]) => {
    dispatch(setUploadRules(ruleIds));
  };

  const validateFile = (file: File): string | null => {
    const result = validateDocumentUploadFile(file);
    return result.error;
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
      const fileName = stripDocumentUploadExtension(file.name);
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

  const canSubmit = selectedFile && !fileError;

  return (
    <form onSubmit={handleSubmit} className={fileUploadFormStyles.container}>
      {/* File Upload Area */}
      <div className={fileUploadFormStyles.formGroup}>
        <Label className={fileUploadFormStyles.label}>Document File *</Label>
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
          <p className="font-medium mb-1">Drop your document here, or click to browse</p>
          <p className={fileUploadFormStyles.uploadText}>
            PDF, DOCX, TXT, MD, CSV, PPTX, EPUB up to {formatDocumentFileSize(DOCUMENT_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE)}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={DOCUMENT_UPLOAD_CONSTRAINTS.ACCEPT}
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
                <p className={fileUploadFormStyles.fileSize}>
                  {getDocumentUploadTypeLabel(selectedFile.name)} document - {formatDocumentFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
          </div>
        )}

        <p className={fileUploadFormStyles.helpText}>
          Upload a document to create a study guide.
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
            <span role="img" aria-label="Folder">📁</span> Select a directory to load applicable rules
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
