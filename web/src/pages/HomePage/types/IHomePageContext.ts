import type { useFetchHomePageData } from '../context/hooks/api/useFetchHomePageData';

export interface IHomePageHandlers {
  handleTimeframeChange: (value: string) => void;
  handleGenerationGroupingChange: (value: string) => void;
}

export interface IHomePageContext {
  api: ReturnType<typeof useFetchHomePageData>;
  handlers: IHomePageHandlers;
}
