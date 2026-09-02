'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  RuleApplicability,
  RuleColor,
  ruleBlueprintFormSchema,
  type ICreateRuleBlueprintRequest,
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
  archiveRuleBlueprint,
  deleteRuleBlueprint,
  publishRuleBlueprint,
  saveRuleBlueprint,
} from '@admin/mutations/rule-blueprints';

const APPLICABILITY_OPTIONS = Object.values(RuleApplicability);
const COLOR_OPTIONS = Object.values(RuleColor);

export interface IRuleBlueprintFormProps {
  blueprintId?: string;
  defaultValues: ICreateRuleBlueprintRequest;
  status?: 'draft' | 'published' | 'archived';
  version?: number;
}

export function RuleBlueprintForm({
  blueprintId,
  defaultValues,
  status = 'draft',
  version = 1,
}: IRuleBlueprintFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<ICreateRuleBlueprintRequest>({
    resolver: zodResolver(ruleBlueprintFormSchema),
    defaultValues,
  });

  const handleSave = form.handleSubmit(async (values) => {
    setIsSaving(true);
    setNotice(null);

    try {
      const payload: ICreateRuleBlueprintRequest = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        content: values.content.trim(),
        color: values.color,
        tags: values.tags.map((tag) => tag.trim()).filter(Boolean),
        applicableTo: values.applicableTo,
      };

      const { response, payload: result } = await saveRuleBlueprint(
        blueprintId,
        payload,
      );

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to save rule blueprint.');
        return;
      }

      if (!blueprintId && result.blueprint?.id) {
        router.push(`/rule-blueprints/${result.blueprint.id}`);
      } else {
        router.refresh();
      }
      setNotice('Blueprint saved.');
    } catch {
      setNotice('Failed to save rule blueprint.');
    } finally {
      setIsSaving(false);
    }
  });

  const handlePublish = async () => {
    if (!blueprintId) {
      setNotice('Save the draft before publishing.');
      return;
    }

    setIsPublishing(true);
    setNotice(null);

    try {
      const { response, payload: result } =
        await publishRuleBlueprint(blueprintId);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to publish rule blueprint.');
        return;
      }

      setNotice('Published. The workspace agent can now use this blueprint.');
      router.refresh();
    } catch {
      setNotice('Failed to publish rule blueprint.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleArchive = async () => {
    if (!blueprintId) {
      return;
    }

    setIsArchiving(true);
    setNotice(null);

    try {
      const { response, payload: result } =
        await archiveRuleBlueprint(blueprintId);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to archive rule blueprint.');
        return;
      }

      setNotice('Blueprint archived.');
      router.refresh();
    } catch {
      setNotice('Failed to archive rule blueprint.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!blueprintId) {
      return;
    }

    const confirmed = window.confirm('Delete this rule blueprint permanently?');
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setNotice(null);

    try {
      const { response, payload: result } =
        await deleteRuleBlueprint(blueprintId);

      if (isAdminUnauthorizedResponse(response)) {
        redirectToAdminLogin(router, pathname);
        return;
      }

      if (!response.ok || !result.success) {
        setNotice(result.message ?? 'Failed to delete rule blueprint.');
        return;
      }

      router.push('/rule-blueprints');
      router.refresh();
    } catch {
      setNotice('Failed to delete rule blueprint.');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedApplicability = form.watch('applicableTo') ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {blueprintId ? 'Edit rule blueprint' : 'Create rule blueprint'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Status: {status} (version {version}). Published blueprints are the canonical templates the workspace agent uses when creating rules.
        </p>

        <Form {...form}>
          <form className="space-y-4" onSubmit={handleSave}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule content (markdown)</FormLabel>
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
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={field.value}
                      onChange={field.onChange}
                    >
                      {COLOR_OPTIONS.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
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
                        field.onChange(tags);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="applicableTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applicable to</FormLabel>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {APPLICABILITY_OPTIONS.map((option) => {
                      const checked = selectedApplicability.includes(option);
                      return (
                        <label
                          key={option}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              if (event.target.checked) {
                                field.onChange([...selectedApplicability, option]);
                                return;
                              }
                              field.onChange(
                                selectedApplicability.filter(
                                  (value) => value !== option,
                                ),
                              );
                            }}
                          />
                          {option}
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={isSaving || isPublishing || isArchiving || isDeleting}
              >
                {isSaving ? 'Saving…' : 'Save draft'}
              </Button>
              {blueprintId && status !== 'published' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving || isPublishing || isArchiving || isDeleting}
                  onClick={handlePublish}
                >
                  {isPublishing ? 'Publishing…' : 'Publish'}
                </Button>
              ) : null}
              {blueprintId && status === 'published' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving || isPublishing || isArchiving || isDeleting}
                  onClick={handleArchive}
                >
                  {isArchiving ? 'Archiving…' : 'Archive'}
                </Button>
              ) : null}
              {blueprintId ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isSaving || isPublishing || isArchiving || isDeleting}
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
