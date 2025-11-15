import { IRuleCard } from './IRuleCard';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../components/ui/DropdownMenu';
import { MoreVertical, Edit, Trash2, Star, FolderOpen } from 'lucide-react';
import { cn } from '../../../../lib/utils';

const ruleColorClasses: Record<string, string> = {
  red: 'bg-red-500/10 text-red-500 border-red-500/20',
  orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  green: 'bg-green-500/10 text-green-500 border-green-500/20',
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  pink: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  gray: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const applicabilityLabels: Record<string, string> = {
  scraping: 'Scraping',
  upload: 'Upload',
  prompt: 'Prompt',
  quiz: 'Quiz',
  followup: 'Followup',
};

export const RuleCard = ({ rule, onEdit, onDelete, viewMode }: IRuleCard) => {
  const handleEdit = () => {
    onEdit(rule);
  };

  const handleDelete = () => {
    // eslint-disable-next-line no-restricted-globals
    if (confirm(`Are you sure you want to delete "${rule.name}"?`)) {
      onDelete(rule.id);
    }
  };

  const truncatedContent = rule.content.length > 150 
    ? `${rule.content.substring(0, 150)}...` 
    : rule.content;

  if (viewMode === 'list') {
    return (
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn(
                    'w-3 h-3 rounded-full border',
                    ruleColorClasses[rule.color]
                  )}
                />
                <h3 className="font-semibold text-foreground truncate">
                  {rule.name}
                </h3>
                {rule.isDefault && (
                  <Star size={14} className="text-yellow-500 flex-shrink-0" />
                )}
              </div>

              {/* Description */}
              {rule.description && (
                <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                  {rule.description}
                </p>
              )}

              {/* Tags and Applicability */}
              <div className="flex flex-wrap items-center gap-2">
                {rule.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                <div className="flex gap-1">
                  {rule.applicableTo.map((app) => (
                    <Badge
                      key={app}
                      variant="outline"
                      className="text-xs"
                    >
                      {applicabilityLabels[app]}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Directory count */}
              {rule.directoryIds.length > 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <FolderOpen size={12} />
                  <span>{rule.directoryIds.length} directories</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit size={14} className="mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive"
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid view
  return (
    <Card className="hover:border-primary/50 transition-colors h-full flex flex-col">
      <CardContent className="p-4 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={cn(
                'w-3 h-3 rounded-full border flex-shrink-0',
                ruleColorClasses[rule.color]
              )}
            />
            <h3 className="font-semibold text-foreground truncate">
              {rule.name}
            </h3>
            {rule.isDefault && (
              <Star size={14} className="text-yellow-500 flex-shrink-0" />
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="flex-shrink-0 -mt-1">
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>
                <Edit size={14} className="mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {rule.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {rule.description}
          </p>
        )}

        {/* Content preview */}
        <div className="text-xs text-muted-foreground mb-3 flex-1 line-clamp-3">
          {truncatedContent}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {rule.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {rule.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{rule.tags.length - 3}
            </Badge>
          )}
        </div>

        {/* Applicability badges */}
        <div className="flex flex-wrap gap-1 mb-3">
          {rule.applicableTo.map((app) => (
            <Badge
              key={app}
              variant="outline"
              className="text-xs"
            >
              {applicabilityLabels[app]}
            </Badge>
          ))}
        </div>

        {/* Directory count */}
        {rule.directoryIds.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
            <FolderOpen size={12} />
            <span>{rule.directoryIds.length} directories</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
