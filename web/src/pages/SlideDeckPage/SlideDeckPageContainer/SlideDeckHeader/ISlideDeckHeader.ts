import { ISlideDeckDownload } from '../../types/ISlideDeckDownload';

export interface ISlideDeckHeader {
  title: string;
  currentIndex: number;
  total: number;
  isFullscreen: boolean;
  download: ISlideDeckDownload;
  onNavigateBack: () => void;
  onToggleFullscreen: () => void;
}
