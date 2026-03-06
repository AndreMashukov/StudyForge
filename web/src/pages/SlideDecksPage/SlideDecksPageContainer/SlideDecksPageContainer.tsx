import React from 'react';
import { useSlideDecksPageContext } from '../context/hooks/useSlideDecksPageContext';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Presentation, Trash2, Eye } from 'lucide-react';
import { formatDateWithOptions } from '../../../utils/dateUtils';

export const SlideDecksPageContainer: React.FC = () => {
  const { slideDecksApi, handlers } = useSlideDecksPageContext();
  const { slideDecks, isLoading, error } = slideDecksApi;

  if (isLoading) {
    return (
      <Page showSidebar={true}>
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </Page>
    );
  }

  return (
    <Page showSidebar={true}>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Slide Decks</h1>
        </div>

        {error ? (
          <Card className="border-destructive">
            <CardContent className="p-8 text-center">
              <p className="text-destructive">Failed to load slide decks. Please try again.</p>
            </CardContent>
          </Card>
        ) : slideDecks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Presentation className="mx-auto mb-4 text-muted-foreground" size={48} />
              <p className="text-muted-foreground">No slide decks yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Generate a slide deck from any document to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {slideDecks.map((deck) => (
              <Card key={deck.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Presentation size={18} />
                      {deck.title}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deck.id && handlers.handleView(deck.id)}
                      >
                        <Eye size={16} className="mr-1" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deck.id && handlers.handleDelete(deck.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>From: {deck.documentTitle}</span>
                    <span>{deck.slides?.length || 0} slides</span>
                    {deck.createdAt && (
                      <span>{formatDateWithOptions(deck.createdAt, 'MMM d, yyyy')}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
};
