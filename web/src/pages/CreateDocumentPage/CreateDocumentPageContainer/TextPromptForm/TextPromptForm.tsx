import React, { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Label } from '../../../../components/ui/Label';
import { Sparkles, Loader2 } from 'lucide-react';
import { ITextPromptFormProps } from './ITextPromptForm';
import { textPromptFormStyles } from './TextPromptForm.styles';
import { cn } from '../../../../lib/utils';
import { FileUploadZone } from './FileUploadZone';
import { AttachedFilesList } from './AttachedFilesList';
import { SourceTabs, SourceTabType } from './SourceTabs';
import { DocumentSelector } from './DocumentSelector';
import { CompactRuleSelector } from '../../../../components/CompactRuleSelector';
import { FILE_UPLOAD_CONSTRAINTS } from '../../../../types/fileUpload';
import { RuleApplicability } from '@shared-types';

const MAX_CHARACTERS = 10000;
const MIN_CHARACTERS = 10;

export const TextPromptForm = ({ 
  isLoading, 
  progress = 0, 
  onSubmit,
  attachedFiles,
  onFilesSelected,
  onFileRemove,
  canAttachMore,
  totalTokens,
  contextSizeError,
  userDocuments,
  selectedDocumentIds,
  onDocumentToggle,
  isLoadingDocuments,
  directoryId,
  selectedRuleIds,
  onRuleIdsChange,
}: ITextPromptFormProps) => {
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<SourceTabType>('upload');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    onSubmit({
      prompt: prompt.trim(),
      ruleIds: selectedRuleIds,
    });
  };

  const characterCount = prompt.length;
  const isOverLimit = characterCount > MAX_CHARACTERS;
  const isUnderMinimum = characterCount > 0 && characterCount < MIN_CHARACTERS;
  
  // Context size validation
  const isContextOverLimit = totalTokens > FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_TOKENS;
  
  const canSubmit = characterCount >= MIN_CHARACTERS && 
                    characterCount <= MAX_CHARACTERS && 
                    !isLoading && 
                    !isContextOverLimit;

  // Calculate counts for tab badges
  const uploadCount = attachedFiles.filter(f => f.source === 'upload').length;
  const libraryCount = attachedFiles.filter(f => f.source === 'library').length;

  return (
    <form onSubmit={handleSubmit} className={textPromptFormStyles.container}>
      {/* Source Tabs */}
      <SourceTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        uploadCount={uploadCount}
        libraryCount={libraryCount}
        disabled={isLoading}
      />

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'upload' ? (
          <FileUploadZone
            onFilesSelected={onFilesSelected}
            canAttachMore={canAttachMore}
            maxFiles={FILE_UPLOAD_CONSTRAINTS.MAX_FILES}
            disabled={isLoading}
          />
        ) : (
          <DocumentSelector
            documents={userDocuments}
            selectedDocumentIds={selectedDocumentIds}
            onDocumentToggle={onDocumentToggle}
            canSelectMore={canAttachMore}
            isLoading={isLoadingDocuments}
            disabled={isLoading}
          />
        )}
      </div>

      {/* Attached Files List - Always Visible */}
      <AttachedFilesList
        files={attachedFiles}
        onRemoveFile={onFileRemove}
        totalTokens={totalTokens}
        maxTokens={FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_TOKENS}
        contextSizeError={contextSizeError}
      />

      {/* Prompt Input */}
      <div className={textPromptFormStyles.formGroup}>
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt" className={textPromptFormStyles.label}>
            What would you like to learn about? *
          </Label>
          <span 
            className={cn(
              isOverLimit || isUnderMinimum 
                ? textPromptFormStyles.characterCounterError 
                : textPromptFormStyles.characterCounter
            )}
          >
            {characterCount} / {MAX_CHARACTERS}
          </span>
        </div>
        <textarea
          id="prompt"
          placeholder={
            attachedFiles.length > 0
              ? `Example: "Summarize the key concepts from the attached documents"\n\nDescribe what you want to learn. The AI will use your attached ${uploadCount > 0 && libraryCount > 0 ? 'files and documents' : uploadCount > 0 ? 'files' : 'documents'} as context.`
              : `Example: "Explain DynamoDB provisioned capacity"\n\nDescribe what you want to learn about. Be specific for better results.`
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={cn(
            textPromptFormStyles.textarea,
            "px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            (isOverLimit || isUnderMinimum) && "border-destructive focus-visible:ring-destructive"
          )}
          disabled={isLoading}
          rows={5}
        />
        {isOverLimit && (
          <p className={textPromptFormStyles.characterCounterError}>
            Prompt cannot exceed {MAX_CHARACTERS} characters
          </p>
        )}
        {isUnderMinimum && (
          <p className={textPromptFormStyles.characterCounterError}>
            Prompt must be at least {MIN_CHARACTERS} characters
          </p>
        )}
        {isContextOverLimit && (
          <p className={textPromptFormStyles.characterCounterError}>
            Context size exceeds limit. Please remove some files before submitting.
          </p>
        )}
        {!isOverLimit && !isUnderMinimum && !isContextOverLimit && (
          <p className={textPromptFormStyles.helpText}>
            {attachedFiles.length > 0 ? (
              <>
                The AI will use your {uploadCount} uploaded file{uploadCount !== 1 ? 's' : ''} 
                {uploadCount > 0 && libraryCount > 0 ? ' and ' : ''}
                {libraryCount > 0 && `${libraryCount} library document${libraryCount !== 1 ? 's' : ''}`} 
                {' '}as context to generate a comprehensive, detailed document.
              </>
            ) : (
              <>
                Describe your topic clearly. The AI will generate a comprehensive document with tables, diagrams, and detailed explanations.
              </>
            )}
          </p>
        )}
      </div>

      {/* Rule Selection */}
      {directoryId && (
        <div className={textPromptFormStyles.formGroup}>
          <CompactRuleSelector
            directoryId={directoryId}
            operation={RuleApplicability.PROMPT}
            selectedRuleIds={selectedRuleIds}
            onSelectionChange={onRuleIdsChange}
            label="Content Generation Rules"
          />
        </div>
      )}

      {isLoading && progress > 0 && (
        <div className={textPromptFormStyles.progressContainer}>
          <div className={textPromptFormStyles.progressBar}>
            <div 
              className={textPromptFormStyles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={textPromptFormStyles.progressText}>
            Generating your document... This may take 10-30 seconds
          </p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        className={textPromptFormStyles.submitButton}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Generating Document...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Generate Document
          </>
        )}
      </Button>
    </form>
  );
};

