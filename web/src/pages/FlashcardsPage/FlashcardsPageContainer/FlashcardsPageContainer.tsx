import React from 'react';
import { Page } from '../../../components/Page';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useFlashcardsPageContext } from '../context/hooks/useFlashcardsPageContext';
import { formatDateWithOptions } from '../../../utils/dateUtils';
import { Layers, FileText, Trash2 } from 'lucide-react';
import type { FlashcardSet } from '@shared-types';

export const FlashcardsPageContainer = () => {
  const { api, handlers } = useFlashcardsPageContext();
  const { flashcardSets, isLoading, isFetching, error } = api;

  if (isLoading || isFetching) {
    return (
      <Page showSidebar={true}>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
          <span className="ml-3 text-muted-foreground">
            Loading flashcard sets...
          </span>
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page showSidebar={true}>
        <Card className="m-4 border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive mb-4">
              Error loading flashcard sets. Please try again later.
            </p>
            {import.meta.env.DEV && (
              <pre className="bg-muted p-2 rounded text-xs mt-2 overflow-auto max-h-32">
                {JSON.stringify(error, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </Page>
    );
  }

  if (!flashcardSets || flashcardSets.length === 0) {
    return (
      <Page showSidebar={true}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">My Flashcards</h1>
          <div className="text-center py-12 text-muted-foreground">
            <Layers size={48} className="mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              No Flashcard Sets Yet
            </h3>
            <p>Create flashcards from a document to start studying.</p>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page showSidebar={true}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">My Flashcards</h1>
        <div className="space-y-4">
          {flashcardSets.map((set: Partial<FlashcardSet>) => (
            <Card key={set.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{set.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="flex items-center gap-2">
                      <FileText size={14} />
                      Source: {set.documentTitle}
                    </p>
                    <p>Created: {formatDateWithOptions(set.createdAt)}</p>
                    <p>{set.flashcards?.length ?? 0} cards</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        set.id && handlers.handleDeleteFlashcardSet(set.id)
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                    <Button
                      onClick={() =>
                        set.id && handlers.handleViewFlashcardSet(set.id)
                      }
                    >
                      Study
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Page>
  );
};
