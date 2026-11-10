/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SortableDirectoryList } from './SortableDirectoryList';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../../store/api/Directory/DirectoryApi', () => ({
  useReorderDirectoryItemsMutation: () => [vi.fn()],
}));

function renderList() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <SortableDirectoryList
        items={[{ id: 'doc-1' }]}
        directoryId="dir-1"
        itemType="document"
        renderItem={() => (
          <input aria-label="Edit name" defaultValue="QAFunctionsp86" />
        )}
      />,
    );
  });
  return { container, root };
}

function pressKey(element: HTMLElement, code: string, key: string) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code,
    key,
  });
  act(() => {
    element.dispatchEvent(event);
  });
  return event;
}

function rowElement(container: HTMLElement): HTMLElement {
  const row = container.querySelector('[aria-roledescription="sortable"]');
  if (!(row instanceof HTMLElement)) {
    throw new Error('Missing sortable source row');
  }
  return row;
}

describe('SortableDirectoryList keyboard drag', () => {
  let root: Root | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.innerHTML = '';
    root = undefined;
  });

  it('lets Space and Enter type in a name field instead of dragging the row', () => {
    const view = renderList();
    root = view.root;
    const input = view.container.querySelector('input');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Missing name field');
    }

    const space = pressKey(input, 'Space', ' ');
    const enter = pressKey(input, 'Enter', 'Enter');

    expect(space.defaultPrevented).toBe(false);
    expect(enter.defaultPrevented).toBe(false);
    expect(rowElement(view.container).getAttribute('aria-pressed')).toBeNull();
  });

  it('still starts a keyboard drag when Space is pressed on the row', () => {
    const view = renderList();
    root = view.root;
    const row = rowElement(view.container);

    const space = pressKey(row, 'Space', ' ');

    expect(space.defaultPrevented).toBe(true);
    expect(row.getAttribute('aria-pressed')).toBe('true');
  });
});
