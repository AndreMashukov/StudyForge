import React, { useState, useRef } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Label } from '../../../../components/ui/Label';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { IFileUploadFormProps } from './IFileUploadForm';
import { fileUploadFormStyles } from './FileUploadForm.styles';
import { cn } from '../../../../lib/utils';

export const FileUploadForm = ({ isLoading, onSubmit }: IFileUploadFormProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 100 * 1024; // 100KB in bytes

  const validateFile = (file: File): string | null => {
    // Check file type
    if (file.type !== 'text/markdown' && !file.name.endsWith('.md')) {
      return 'Please select a markdown (.md) file';
    }

    // Check file size
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
    
    // Auto-fill title from filename if not already set
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
    });
  };

  const formatFileSize = (bytes: number) => {
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const canSubmit = selectedFile && !fileError;

  return (
    <form onSubmit={handleSubmit} className={fileUploadFormStyles.container}>
      {/* File Upload Area */}
      <div className={fileUploadFormStyles.formGroup}>
        <Label className={fileUploadFormStyles.label}>
          Markdown File *
        </Label>
        
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
          <Upload size={48} className={fileUploadFormStyles.uploadIcon} />
          <p className="font-medium mb-2">
            Drop your markdown file here, or click to browse
          </p>
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

        {/* File Error */}
        {fileError && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle size={16} />
            {fileError}
          </div>
        )}

        {/* Selected File Info */}
        {selectedFile && !fileError && (
          <div className={fileUploadFormStyles.fileInfo}>
            <div className="flex items-center gap-2">
              <FileText size={16} />
              <div className="flex-1">
                <p className={fileUploadFormStyles.fileName}>{selectedFile.name}</p>
                <p className={fileUploadFormStyles.fileSize}>
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
          </div>
        )}

        <p className={fileUploadFormStyles.helpText}>
          Upload a markdown file to create a document. The file will be stored as-is.
        </p>
      </div>

      {/* Title Input */}
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
          Custom title for your document. If empty, we'll use the filename.
        </p>
      </div>

      <Button
        type="submit"
        disabled={!canSubmit || isLoading}
        className={fileUploadFormStyles.submitButton}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
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