import { useEffect } from 'react';
import { ISlideDeckPageHandlers } from '../../types/ISlideDeckPageHandlers';

interface IUseSlideDeckPageEffectsParams {
  slidesLength: number;
  handlers: ISlideDeckPageHandlers;
}

export const useSlideDeckPageEffects = ({
  slidesLength,
  handlers,
}: IUseSlideDeckPageEffectsParams) => {
  const { currentSlide, handleClampSlide } = handlers;

  useEffect(() => {
    if (slidesLength > 0 && currentSlide >= slidesLength) {
      handleClampSlide(slidesLength - 1);
    }
  }, [slidesLength, currentSlide, handleClampSlide]);
};
