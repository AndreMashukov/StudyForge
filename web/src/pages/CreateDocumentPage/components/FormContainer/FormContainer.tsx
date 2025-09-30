import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectSelectedSource, selectIsFormVisible } from '../../../../store/slices/createDocumentPageSlice';
import { formContainerStyles } from './FormContainer.styles';
import { cn } from '../../../../lib/utils';
import type { RootState } from '../../../../store';

interface IFormContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const FormContainer = ({ children, className }: IFormContainerProps) => {
  const selectedSource = useSelector((state: RootState) => selectSelectedSource(state));
  const isFormVisible = useSelector((state: RootState) => selectIsFormVisible(state));
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isFormVisible && selectedSource) {
      // Start showing the container
      setShouldRender(true);
      // Trigger animation after a brief delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setIsAnimating(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      // Start exit animation
      setIsAnimating(false);
      // Hide container after animation completes
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isFormVisible, selectedSource]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={cn(
        formContainerStyles.container,
        isAnimating && formContainerStyles.visible,
        !isAnimating && formContainerStyles.hidden,
        className
      )}
    >
      <div className={formContainerStyles.content}>
        {children}
      </div>
    </div>
  );
};
