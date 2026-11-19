import { useCallback, useMemo, useState } from 'react';
import type { Slide, SlideDeck } from '@shared-types';
import { useToast } from '../../../../components/Toast';
import { fetchSlideImageBlob } from '../../../../services/slideImageStorage';
import { downloadBlob } from '../../../../utils/downloadUtils';
import {
  describeSlideImageExport,
  exportSingleSlideImage,
  exportSlideDeckImages,
  ISlideImageExportProgress,
} from '../../../../utils/slideDeckImageExport';
import { ISlideDeckDownload } from '../../types/ISlideDeckDownload';

interface IUseSlideDeckDownloadHandlersParams {
  slideDeck: SlideDeck | undefined;
  currentSlide: number;
}

const EMPTY_SLIDES: Slide[] = [];

export const useSlideDeckDownloadHandlers = ({
  slideDeck,
  currentSlide,
}: IUseSlideDeckDownloadHandlersParams): ISlideDeckDownload => {
  const { showToast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<ISlideImageExportProgress | null>(null);

  const slides = slideDeck?.slides ?? EMPTY_SLIDES;
  const hasAnyImage = useMemo(
    () => slides.some((slide) => Boolean(slide.imageStoragePath)),
    [slides]
  );
  const activeSlide: Slide | undefined = slides[currentSlide];
  const canDownloadCurrent = Boolean(activeSlide?.imageStoragePath);

  const runDownloadAll = useCallback(async () => {
    if (!slideDeck || isDownloading) return;
    setIsDownloading(true);
    setProgress(null);
    try {
      const result = await exportSlideDeckImages(slideDeck, {
        fetchBlob: fetchSlideImageBlob,
        onProgress: setProgress,
      });
      if (result.blob) {
        downloadBlob(result.blob, result.fileName);
      }
      const summary = describeSlideImageExport(result);
      showToast(summary.message, summary.variant);
    } catch {
      showToast("Couldn't prepare the download. Please try again.", 'error');
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  }, [slideDeck, isDownloading, showToast]);

  const runDownloadCurrent = useCallback(async () => {
    if (!activeSlide || isDownloading) return;
    setIsDownloading(true);
    try {
      const file = await exportSingleSlideImage(
        activeSlide,
        currentSlide,
        slides.length,
        fetchSlideImageBlob
      );
      if (file) {
        downloadBlob(file.blob, file.fileName);
      } else {
        showToast('This slide has no image to download.', 'info');
      }
    } catch {
      showToast("Couldn't download this slide's image. Please try again.", 'error');
    } finally {
      setIsDownloading(false);
    }
  }, [activeSlide, currentSlide, slides.length, isDownloading, showToast]);

  const handleDownloadAll = useCallback(() => {
    void runDownloadAll();
  }, [runDownloadAll]);

  const handleDownloadCurrent = useCallback(() => {
    void runDownloadCurrent();
  }, [runDownloadCurrent]);

  return {
    isDownloading,
    progress,
    hasAnyImage,
    canDownloadCurrent,
    handleDownloadAll,
    handleDownloadCurrent,
  };
};
