export interface IBreadcrumbNav {
  directoryId?: string | null;
  onNavigate: (directoryId: string | null) => void;
  className?: string;
}
