import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { cn } from '../../lib/utils';
import { selectSidebarIsOpen } from '../../store/slices/uiSlice';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { ICreateArtifactModalProps } from './ICreateArtifactModal';
import { getCreateArtifactModalConfig } from './createArtifactModalConfig';
import { createArtifactFormSchema, CreateArtifactFormSchema } from './createArtifactModalSchemas';
import { CreateArtifactSourcePicker } from './CreateArtifactSourcePicker';
import { CreateArtifactRulesSection } from './CreateArtifactRulesSection';
import { useCreateArtifactModalDocuments } from './useCreateArtifactModalDocuments';
import { useCreateArtifactModalSubmit } from './useCreateArtifactModalSubmit';

/** Matches TopAppBar `h-12` and Sidebar `top-12`. */
const APP_BAR_HEIGHT_PX = 48;
/** Matches Page / Sidebar expanded & collapsed widths. */
const SIDEBAR_EXPANDED_PX = 220;
const SIDEBAR_COLLAPSED_PX = 64;
const PAGE_WIDE_GAP_PX = 16;

const EMPTY_FORM_VALUES: CreateArtifactFormSchema = {
  documentIds: [],
  name: '',
  additionalPrompt: '',
  ruleIds: [],
  followupRuleIds: [],
  descriptionRuleIds: [],
};

function resolveInitialDocumentIds(
  documents: { id: string }[],
  preselectedDocumentIds?: string[],
): string[] {
  if (preselectedDocumentIds?.length) {
    const validIds = preselectedDocumentIds.filter((id) =>
      documents.some((document) => document.id === id),
    );
    if (validIds.length > 0) {
      return validIds.slice(0, 5);
    }
  }

  if (documents.length === 1) {
    return [documents[0].id];
  }

  return [];
}

export const CreateArtifactModal: React.FC<ICreateArtifactModalProps> = ({
  open,
  state,
  onClose,
}) => {
  const sidebarIsOpen = useSelector(selectSidebarIsOpen);
  const { isAppFullscreen } = useAppFullscreen();
  const [isMobile, setIsMobile] = useState(false);
  // Mount rules after the form reset so CompactRuleSelector can apply always-apply defaults
  // without getting cleared by a later reset.
  const [isRulesReady, setIsRulesReady] = useState(false);
  const formInitKeyRef = useRef<string | null>(null);

  const artifactType = state?.artifactType;
  const directoryId = state?.directoryId ?? null;
  const preselectedDocumentIds = state?.preselectedDocumentIds;

  const config = artifactType ? getCreateArtifactModalConfig(artifactType) : null;

  const documentsApi = useCreateArtifactModalDocuments(open ? directoryId : null);
  const { documents, isLoading: isLoadingDocuments } = documentsApi;

  const form = useForm<CreateArtifactFormSchema>({
    resolver: zodResolver(createArtifactFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  const {
    register,
    watch,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = form;

  const watchedDocumentIds = watch('documentIds') ?? [];
  const watchedName = watch('name') ?? '';
  const watchedRuleIds = watch('ruleIds') ?? [];
  const watchedFollowupRuleIds = watch('followupRuleIds') ?? [];
  const watchedDescriptionRuleIds = watch('descriptionRuleIds') ?? [];

  const { submit } = useCreateArtifactModalSubmit({
    artifactType: artifactType ?? 'quizzes',
    directoryId: directoryId ?? '',
    documents,
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!open) {
      formInitKeyRef.current = null;
      setIsRulesReady(false);
      return;
    }

    if (!artifactType || !directoryId || isLoadingDocuments) {
      return;
    }

    const initKey = [
      artifactType,
      directoryId,
      (preselectedDocumentIds ?? []).join(','),
    ].join(':');

    if (formInitKeyRef.current === initKey) {
      return;
    }

    formInitKeyRef.current = initKey;
    reset({
      ...EMPTY_FORM_VALUES,
      documentIds: resolveInitialDocumentIds(documents, preselectedDocumentIds),
    });
    setIsRulesReady(true);
  }, [
    open,
    artifactType,
    directoryId,
    preselectedDocumentIds,
    documents,
    isLoadingDocuments,
    reset,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const pageWideStyle = useMemo(() => {
    const sidebarWidth = sidebarIsOpen ? SIDEBAR_EXPANDED_PX : SIDEBAR_COLLAPSED_PX;
    const contentLeft = !isMobile && !isAppFullscreen ? sidebarWidth : 0;
    const contentTop = isAppFullscreen ? 0 : APP_BAR_HEIGHT_PX;
    return {
      top: contentTop + PAGE_WIDE_GAP_PX,
      left: contentLeft + PAGE_WIDE_GAP_PX,
      right: PAGE_WIDE_GAP_PX,
      bottom: PAGE_WIDE_GAP_PX,
    };
  }, [isAppFullscreen, isMobile, sidebarIsOpen]);

  const handleDocumentSelectionChange = useCallback(
    (documentIds: string[]) => {
      setValue('documentIds', documentIds, { shouldValidate: true });
    },
    [setValue],
  );

  const onSubmit = useCallback(
    (formData: CreateArtifactFormSchema) => {
      const started = submit(formData);
      if (started) {
        onClose();
      }
    },
    [onClose, submit],
  );

  if (!open || !state || !config || !directoryId || !artifactType) {
    return null;
  }

  const primaryDocument = documents.find((document) => document.id === watchedDocumentIds[0]);
  const docCount = watchedDocumentIds.length;
  const generateLabel =
    docCount > 1 ? config.generateLabels.plural(docCount) : config.generateLabels.single;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      <section
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-background/95 shadow-2xl backdrop-blur',
        )}
        style={pageWideStyle}
        role="dialog"
        aria-modal="true"
        aria-label={config.title}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {config.icon}
              <h2 className="truncate text-base font-semibold">{config.title}</h2>
            </div>
            <CreateArtifactSourcePicker
              documents={documents}
              selectedDocumentIds={watchedDocumentIds}
              onSelectionChange={handleDocumentSelectionChange}
              isLoading={isLoadingDocuments}
              disabled={isLoadingDocuments}
              className="mt-1"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            aria-label="Close create artifact modal"
          >
            <X size={16} />
          </Button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {errors.documentIds ? (
              <p className="text-sm text-destructive">{errors.documentIds.message}</p>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="artifact-name">
                  {config.nameFieldLabel}{' '}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <span className="text-xs text-muted-foreground">
                  {watchedName.length}/100 characters
                </span>
              </div>
              <Input
                {...register('name')}
                id="artifact-name"
                type="text"
                placeholder="Leave empty for auto-generated name"
                maxLength={100}
              />
              {errors.name ? (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              ) : null}
              {docCount > 0 && !watchedName.trim() && config.defaultNameFn && primaryDocument ? (
                <p className="text-sm text-muted-foreground">
                  Default name: &quot;{config.defaultNameFn(primaryDocument.title)}&quot;
                </p>
              ) : null}
            </div>

            <Textarea
              {...register('additionalPrompt')}
              id="additionalPrompt"
              label="Additional instructions (optional)"
              placeholder={config.additionalPromptPlaceholder}
              showCharCount
              maxLength={20000}
              helperText={config.additionalPromptHelperText}
              rows={4}
            />
            {errors.additionalPrompt ? (
              <p className="text-sm text-destructive">{errors.additionalPrompt.message}</p>
            ) : null}

            {isRulesReady ? (
              <CreateArtifactRulesSection
                directoryId={directoryId}
                ruleApplicability={config.ruleApplicability}
                followupRuleApplicability={config.followupRuleApplicability}
                descriptionRuleApplicability={config.descriptionRuleApplicability}
                ruleIds={watchedRuleIds}
                followupRuleIds={watchedFollowupRuleIds}
                descriptionRuleIds={watchedDescriptionRuleIds}
                onRuleIdsChange={(ruleIds) => setValue('ruleIds', ruleIds)}
                onFollowupRuleIdsChange={(followupRuleIds) =>
                  setValue('followupRuleIds', followupRuleIds)
                }
                onDescriptionRuleIdsChange={(descriptionRuleIds) =>
                  setValue('descriptionRuleIds', descriptionRuleIds)
                }
              />
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border p-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={docCount === 0}>
              {generateLabel}
            </Button>
          </div>
        </form>
      </section>
    </>
  );
};
