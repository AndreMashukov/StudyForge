export interface IBreadcrumbNav {
  directoryId?: string | null;
  onNavigate: (directory: { id: string; name: string } | null) => void;
  className?: string;
  /** When true the last breadcrumb stays clickable (useful on pages that are *inside* a directory, e.g. the document viewer). */
  lastItemClickable?: boolean;
}
