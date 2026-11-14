import { useEffect } from 'react';
import { useAppDispatch } from '../../../../hooks/redux';
import { setReportingDate } from '../../../../store/slices/homePageSlice';
import { formatUtcIsoDate } from '../../../../utils/dateUtils';

export const useHomePageEffects = () => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const handleReportingDay = () =>
      dispatch(setReportingDate(formatUtcIsoDate()));
    handleReportingDay();
    const interval = window.setInterval(handleReportingDay, 60_000);
    document.addEventListener('visibilitychange', handleReportingDay);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleReportingDay);
    };
  }, [dispatch]);
};
