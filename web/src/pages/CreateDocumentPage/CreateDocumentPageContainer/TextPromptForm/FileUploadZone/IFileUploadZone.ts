/**
 * FileUploadZone Props Interface
 */

export interface IFileUploadZoneProps {
  onFilesSelected: (files: FileList) => void;
  canAttachMore: boolean;
  maxFiles: number;
  disabled?: boolean;
}

