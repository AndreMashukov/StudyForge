import { Home, ChevronRight } from "lucide-react";
import { IBreadcrumbNav } from "./IBreadcrumbNav";
import { breadcrumbNavStyles, getBreadcrumbClassName } from "./BreadcrumbNav.styles";
import {
  useGetDirectoryAncestorsQuery,
  useGetDirectoryQuery,
} from "../../store/api/Directory/DirectoryApi";
import { cn } from "../../lib/utils";

export const BreadcrumbNav = ({ directoryId, onNavigate, className }: IBreadcrumbNav) => {
  const { data: ancestorsData, isLoading: isLoadingAncestors } =
    useGetDirectoryAncestorsQuery(directoryId || "", { skip: !directoryId });
  const { data: currentDirectory, isLoading: isLoadingDirectory } =
    useGetDirectoryQuery(directoryId || "", { skip: !directoryId });

  const isLoading = isLoadingAncestors || (!!directoryId && isLoadingDirectory);

  // Loading state
  if (isLoading) {
    return (
      <nav className={cn(breadcrumbNavStyles.container, className)}>
        <div className={breadcrumbNavStyles.skeleton} style={{ width: "100px" }} />
        <ChevronRight size={16} className={breadcrumbNavStyles.separator} />
        <div className={breadcrumbNavStyles.skeleton} style={{ width: "120px" }} />
        <ChevronRight size={16} className={breadcrumbNavStyles.separator} />
        <div className={breadcrumbNavStyles.skeleton} style={{ width: "80px" }} />
      </nav>
    );
  }

  // Build breadcrumb path: ancestors + current directory (so full path is shown)
  const ancestors = ancestorsData?.ancestors || [];
  const path =
    directoryId && currentDirectory
      ? [...ancestors, currentDirectory]
      : ancestors;

  return (
    <nav className={cn(breadcrumbNavStyles.container, className)}>
      {/* Home/Root */}
      <button
        onClick={() => onNavigate(null)}
        className={breadcrumbNavStyles.homeButton}
        aria-label="Navigate to all documents"
      >
        <Home size={16} />
        <span>All Documents</span>
      </button>

      {/* Directory path */}
      {path.map((dir, index) => {
        const isLast = index === path.length - 1;
        return (
          <div key={dir.id} className="flex items-center gap-2">
            <ChevronRight size={16} className={breadcrumbNavStyles.separator} />
            <button
              onClick={() => !isLast && onNavigate(dir.id)}
              className={getBreadcrumbClassName(isLast)}
              aria-label={`Navigate to ${dir.name}`}
              aria-current={isLast ? "page" : undefined}
              disabled={isLast}
            >
              {dir.name}
            </button>
          </div>
        );
      })}
    </nav>
  );
};
