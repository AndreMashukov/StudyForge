'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  platformAgentKnowledgeDocumentFormSchema,
  type ICreatePlatformAgentKnowledgeDocumentRequest,
} from '@shared-types';
import {
  isAdminUnauthorizedResponse,
  redirectToAdminLogin,
} from '@admin/auth/client-login-redirect';
import { Button } from '@admin/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@admin/components/ui/Card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@admin/components/ui/Form';
import { Input } from '@admin/components/ui/Input';
import {
  deletePlatformAgentKnowledgeDocument,
  publishPlatformAgentKnowledgeDocument,
  savePlatformAgentKnowledgeDocument,
} from '@admin/mutations/platform-agent-knowledge';

export interface IAgentKnowledgeFormProps {
  docId?: string;
  defaultValues: ICreatePlatformAgentKnowledgeDocumentRequest;
  status?: 'draft' | 'published';
  indexingStatus?: 'idle' | 'indexing' | 'indexed' | 'failed';
  indexingError?: string;
}

export function AgentKnowledgeForm({
  docId,
  defaultValues,
  status = 'draft',
  indexingStatus,
  indexingError,
}: IAgentKnowledgeFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<ICreatePlatformAgentKnowledgeDocumentRequest>({
    resolver: zodResolver(platformAgentKnowledgeDocumentFormSchema),
    defaultValues,
  });

  const handleSave = form.handleSubmit(async (values) => {
    setIsSaving(true);
    setNotice(null);

    try {
      const payload = {
        title: values.title.trim(),
        bodyMarkdown: values.bodyMarkdown.trim(),
        tags: values.tags?.map((tag) => tag.trim()).filter(Boolean),
      };

      const { response, payload: result } = await savePlatformAgentKnowledgeDocument(
        docId,
        payload,
      );

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to save knowledge document.');
        return;
      }

      if (!docId && result.document?.id) {
        router.push(`/agent-knowledge/${result.document.id}`);
      } else {
        router.refresh();
      }
      setNotice('Draft saved.');
    } catch {
      setNotice('Failed to save knowledge document.');
    } finally {
      setIsSaving(false);
    }
  });

  const handlePublish = async () => {
    if (!docId) {
      setNotice('Save the draft before publishing.');
      return;
    }

    setIsPublishing(true);
    setNotice(null);

    try {
      const { response, payload: result } =
        await publishPlatformAgentKnowledgeDocument(docId);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to publish knowledge document.');
        return;
      }

      setNotice('Published. Indexing for the workspace agent will finish shortly.');
      router.refresh();
    } catch {
      setNotice('Failed to publish knowledge document.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!docId) {
      return;
    }

    const confirmed = window.confirm(
      'Delete this knowledge document and remove its indexed chunks?',
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setNotice(null);

    try {
      const { response, payload: result } =
        await deletePlatformAgentKnowledgeDocument(docId);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to delete knowledge document.');
        return;
      }

      router.push('/agent-knowledge');
      router.refresh();
    } catch {
      setNotice('Failed to delete knowledge document.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{docId ? 'Edit knowledge document' : 'Create knowledge document'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'published' ? (
          <p className="text-sm text-muted-foreground">
            Published documents are retrieved by the workspace agent. Saving edits keeps the draft content; publish again to reindex.
          </p>
        ) : null}
        {indexingStatus === 'failed' && indexingError ? (
          <p className="text-sm text-destructive">Last indexing error: {indexingError}</p>
        ) : null}

        <Form {...form}>
          <form className="space-y-4" onSubmit={handleSave}>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bodyMarkdown"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Markdown body</FormLabel>
                  <FormControl>
                    <textarea
                      rows={18}
                      className="flex min-h-[320px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (comma-separated)</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value?.join(', ') ?? ''}
                      onChange={(event) => {
                        const tags = event.target.value
                          .split(',')
                          .map((tag) => tag.trim())
                          .filter(Boolean);
                        field.onChange(tags.length > 0 ? tags : undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSaving || isPublishing || isDeleting}>
                {isSaving ? 'Saving…' : 'Save draft'}
              </Button>
              {docId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving || isPublishing || isDeleting}
                  onClick={handlePublish}
                >
                  {isPublishing ? 'Publishing…' : 'Publish and reindex'}
                </Button>
              ) : null}
              {docId ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isSaving || isPublishing || isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </Button>
              ) : null}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
