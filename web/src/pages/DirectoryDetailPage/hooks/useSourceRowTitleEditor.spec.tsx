/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSourceRowTitleEditor } from './useSourceRowTitleEditor';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { updateDocument } = vi.hoisted(() => ({
  updateDocument: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
}));

vi.mock('../../../store/api/Documents/documentsApi', () => ({
  useUpdateDocumentMutation: () => [updateDocument, { isLoading: false }],
}));

function TitleEditorHarness({
  title,
  onParentKeyDown,
}: {
  title: string;
  onParentKeyDown?: () => void;
}) {
  const editor = useSourceRowTitleEditor({
    documentId: 'doc-1',
    documentTitle: title,
  });

  return (
    <div onKeyDown={onParentKeyDown}>
      <button type="button" onClick={editor.startEditingTitle}>
        Edit
      </button>
      {editor.isEditingTitle ? (
        <input
          aria-label="Edit name"
          value={editor.draftTitle}
          onChange={(event) =>
            editor.handleDraftTitleChange(event.target.value)
          }
          onBlur={editor.handleTitleBlur}
          onKeyDown={editor.handleTitleKeyDown}
        />
      ) : (
        <span>{title}</span>
      )}
    </div>
  );
}

function renderEditor(title: string, onParentKeyDown?: () => void) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <TitleEditorHarness title={title} onParentKeyDown={onParentKeyDown} />,
    );
  });
  return { container, root };
}

function startEditing(container: HTMLElement) {
  const editButton = container.querySelector('button');
  if (!(editButton instanceof HTMLButtonElement)) {
    throw new Error('Missing edit button');
  }
  act(() => {
    editButton.click();
  });
}

function nameInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Missing name field');
  }
  return input;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!setter) {
    throw new Error('Missing input value setter');
  }

  const tracker: unknown = Reflect.get(input, '_valueTracker');
  if (
    typeof tracker === 'object' &&
    tracker !== null &&
    'setValue' in tracker &&
    typeof tracker.setValue === 'function'
  ) {
    tracker.setValue('');
  }

  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('useSourceRowTitleEditor', () => {
  let root: Root | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.innerHTML = '';
    root = undefined;
    updateDocument.mockClear();
  });

  it('saves an internal space and leaves an unchanged spaced name alone', async () => {
    const unchanged = renderEditor('Generated Document');
    root = unchanged.root;
    startEditing(unchanged.container);
    const original = nameInput(unchanged.container);
    expect(original.value).toBe('Generated Document');
    await act(async () => {
      original.focus();
      original.blur();
    });
    expect(updateDocument).not.toHaveBeenCalled();

    act(() => {
      root?.unmount();
    });
    document.body.innerHTML = '';

    const edited = renderEditor('QAFunctionsp86');
    root = edited.root;
    startEditing(edited.container);
    const input = nameInput(edited.container);
    act(() => {
      setInputValue(input, 'QAFunctions p86');
    });
    await act(async () => {
      input.focus();
      input.blur();
    });

    expect(updateDocument).toHaveBeenCalledWith({
      documentId: 'doc-1',
      title: 'QAFunctions p86',
    });
  });

  it('does not let Space leave the name field', () => {
    let parentSawKey = false;
    const view = renderEditor('QAFunctionsp86', () => {
      parentSawKey = true;
    });
    root = view.root;

    startEditing(view.container);
    const input = nameInput(view.container);
    const space = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'Space',
      key: ' ',
    });
    act(() => {
      input.dispatchEvent(space);
    });

    expect(space.defaultPrevented).toBe(false);
    expect(parentSawKey).toBe(false);
  });
});
