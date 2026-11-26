import React from 'react';
import { Link } from 'react-router-dom';
import { CopyPlus, Settings2 } from 'lucide-react';
import type { IAgentPromptMenuItem } from '@shared-types';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/utils';
import type { IAgentPromptSlashMenu } from './hooks/useAgentPromptSlashMenu';

export const AGENT_PROMPTS_MANAGE_PATH = '/rules?type=agent';

interface IAgentPromptMenuRow {
  item: IAgentPromptMenuItem;
  index: number;
  menu: IAgentPromptSlashMenu;
}

const AgentPromptMenuRow: React.FC<IAgentPromptMenuRow> = ({
  item,
  index,
  menu,
}) => {
  const active = index === menu.activeIndex;
  return (
    <li
      id={`agent-prompt-option-${item.source}-${item.id}`}
      role="option"
      aria-selected={active}
      className={cn(
        'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5',
        active ? 'bg-muted' : 'hover:bg-muted/60',
      )}
      onMouseEnter={() => menu.setActiveIndex(index)}
      onMouseDown={(event) => {
        // Keep focus in the composer.
        event.preventDefault();
        menu.handlePick(item);
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          /{item.name}
        </p>
        {item.description ? (
          <p className="truncate text-xs text-muted-foreground">
            {item.description}
          </p>
        ) : null}
      </div>
      {item.source === 'blueprint' ? (
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
          aria-label={`Save a copy of ${item.name}`}
          disabled={menu.savingCopyId === item.id}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void menu.handleSaveCopy(item);
          }}
        >
          {menu.savingCopyId === item.id ? (
            <Spinner size="xs" />
          ) : (
            <CopyPlus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Save a copy
        </button>
      ) : null}
    </li>
  );
};

/** The "/" menu above the agent composer (ADR 017). */
export const AgentPromptMenu: React.FC<{ menu: IAgentPromptSlashMenu }> = ({
  menu,
}) => {
  const hasItems = menu.own.length + menu.suggested.length > 0;
  return (
    <div
      className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
      role="dialog"
      aria-label="Saved prompts"
    >
      <div className="max-h-72 overflow-y-auto p-1">
        {menu.isLoading && !hasItems ? (
          <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
            <Spinner size="xs" />
            Loading prompts...
          </div>
        ) : !hasItems ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            {menu.query
              ? `No prompts match "/${menu.query}".`
              : 'No prompts yet. Ask the assistant to save one, or create one in Prompts.'}
          </p>
        ) : (
          <ul role="listbox" aria-label="Saved prompts">
            {menu.own.length > 0 ? (
              <li
                role="presentation"
                className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Your prompts
              </li>
            ) : null}
            {menu.own.map((item, index) => (
              <AgentPromptMenuRow
                key={`rule-${item.id}`}
                item={item}
                index={index}
                menu={menu}
              />
            ))}
            {menu.suggested.length > 0 ? (
              <li
                role="presentation"
                className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Suggested
              </li>
            ) : null}
            {menu.suggested.map((item, index) => (
              <AgentPromptMenuRow
                key={`blueprint-${item.id}`}
                item={item}
                index={menu.own.length + index}
                menu={menu}
              />
            ))}
          </ul>
        )}
      </div>
      <Link
        to={AGENT_PROMPTS_MANAGE_PATH}
        className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={menu.handleDismiss}
      >
        <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
        Manage prompts
      </Link>
    </div>
  );
};
