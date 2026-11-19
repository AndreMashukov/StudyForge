import type { ISlideImageExportProgress } from '../../../utils/slideDeckImageExport';

export interface ISlideDeckDownload {
  isDownloading: boolean;
  progress: ISlideImageExportProgress | null;
  hasAnyImage: boolean;
  canDownloadCurrent: boolean;
  handleDownloadAll: () => void;
  handleDownloadCurrent: () => void;
}
