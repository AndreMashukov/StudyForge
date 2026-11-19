import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ISlideDeckPageHandlers } from '../../types/ISlideDeckPageHandlers';
import { buildDirectoryPathWithOptionalName } from '../../../../utils/directoryUrl';
import { parseSlideParam, SLIDE_SEARCH_PARAM } from '../../utils/slideParam';

interface IUseSlideDeckPageHandlersParams {
  directoryIdFromData?: string | null;
  slidesLength: number;
}

export const useSlideDeckPageHandlers = ({
  directoryIdFromData,
  slidesLength,
}: IUseSlideDeckPageHandlersParams): ISlideDeckPageHandlers => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawSlideParam = searchParams.get(SLIDE_SEARCH_PARAM);
  const currentSlide = parseSlideParam(rawSlideParam, slidesLength);
  const lastIndex = Math.max(slidesLength - 1, 0);

  const resolvedDirectoryId = useMemo(() => {
    const fromData = directoryIdFromData?.trim();
    const fromQuery = searchParams.get('directoryId')?.trim();
    return fromData || fromQuery || null;
  }, [directoryIdFromData, searchParams]);

  const handleNavigateBack = useCallback(() => {
    if (resolvedDirectoryId) {
      navigate(buildDirectoryPathWithOptionalName(resolvedDirectoryId, undefined, 'slides'));
    } else {
      navigate('/');
    }
  }, [navigate, resolvedDirectoryId]);

  // `replace` keeps slide changes out of history so Back leaves the slide deck in one step.
  const handleNormalizeSlideParam = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(SLIDE_SEARCH_PARAM, value);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleSlideChange = useCallback(
    (index: number) => {
      const clamped = Math.min(Math.max(index, 0), lastIndex);
      handleNormalizeSlideParam(String(clamped + 1));
    },
    [lastIndex, handleNormalizeSlideParam]
  );

  const handlePrevSlide = useCallback(
    () => handleSlideChange(currentSlide - 1),
    [handleSlideChange, currentSlide]
  );

  const handleNextSlide = useCallback(
    () => handleSlideChange(currentSlide + 1),
    [handleSlideChange, currentSlide]
  );

  const handleFirstSlide = useCallback(() => handleSlideChange(0), [handleSlideChange]);

  const handleLastSlide = useCallback(
    () => handleSlideChange(lastIndex),
    [handleSlideChange, lastIndex]
  );

  return {
    currentSlide,
    rawSlideParam,
    handleNavigateBack,
    handleSlideChange,
    handlePrevSlide,
    handleNextSlide,
    handleFirstSlide,
    handleLastSlide,
    handleNormalizeSlideParam,
  };
};
