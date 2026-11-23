import React from 'react';
import { ArrowRight, BookOpen, FileText, ListChecks, Sparkles } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import type { ISubjectPicker } from './ISubjectPicker';

const WHAT_YOU_GET = [
  { icon: BookOpen, label: 'A course folder for your subject' },
  { icon: FileText, label: 'Two study documents written for beginners' },
  { icon: ListChecks, label: 'A quiz to check what you learned' },
] as const;

export const SubjectPicker: React.FC<ISubjectPicker> = ({
  subject,
  suggestions,
  isStarting,
  isSkipping,
  error,
  onSubjectChange,
  onStart,
  onSkip,
}) => {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onStart();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-6 sm:py-12">
      <div className="space-y-3 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles size={14} aria-hidden="true" />
          Your first course is free
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          What do you want to study?
        </h1>
        <p className="text-muted-foreground">
          Name a subject and StudyForge builds you a starter course in a few
          minutes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" aria-label="Choose a subject">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={subject}
            onChange={(event) => onSubjectChange(event.target.value)}
            placeholder="For example: Spanish for travel, SQL joins, the French Revolution"
            aria-label="Subject to study"
            maxLength={200}
            autoFocus
            disabled={isStarting}
            className="h-11 flex-1"
          />
          <Button type="submit" className="h-11" disabled={isStarting}>
            {isStarting ? (
              <Spinner size="xs" className="mr-2" />
            ) : (
              <ArrowRight size={16} className="mr-2" aria-hidden="true" />
            )}
            Build my course
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={isStarting}
              onClick={() => onStart(suggestion)}
              className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>

      <ul className="grid gap-3 sm:grid-cols-3">
        {WHAT_YOU_GET.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3 text-sm text-muted-foreground"
          >
            <Icon size={18} className="shrink-0 text-primary" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>

      <div className="text-center">
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          disabled={isSkipping || isStarting}
          className="text-muted-foreground"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
};
