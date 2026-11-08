import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DocumentScratchPadBox } from './DocumentScratchPadBox';

const pad = {
  sectionIndex: 0,
  question: 'How do clouds form?',
  answer: 'Water vapor cools and condenses.',
};

function renderPad(
  onEvaluate: (sectionIndex: number, userAnswer: string) => Promise<{
    score: number;
    hint?: string;
  }>,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <DocumentScratchPadBox pad={pad} onEvaluate={onEvaluate} />,
    );
  });
  return { container, root };
}

function typeAnswer(container: HTMLElement, value: string) {
  const textarea = container.querySelector('textarea');
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error('Missing answer textarea');
  }
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('DocumentScratchPadBox grading feedback', () => {
  let root: Root | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.innerHTML = '';
    root = undefined;
  });

  it('does not show a score for a draft edited while grading is pending', async () => {
    let finish: (result: { score: number }) => void = () => undefined;
    const pending = new Promise<{ score: number }>((resolve) => {
      finish = resolve;
    });
    const view = renderPad(() => pending);
    root = view.root;

    act(() => {
      const typeButton = [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Type',
      );
      typeButton?.click();
    });
    act(() => {
      typeAnswer(view.container, 'Clouds form in the sky.');
    });
    act(() => {
      const check = [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Check',
      );
      check?.click();
    });
    act(() => {
      typeAnswer(view.container, 'Clouds are made entirely of solid granite.');
    });

    await act(async () => {
      finish({ score: 10 });
      await pending;
    });

    expect(view.container.textContent).toContain(
      'Clouds are made entirely of solid granite.',
    );
    expect(view.container.textContent).not.toContain('Score:');
  });

  it('clears a score when the graded draft is edited', async () => {
    const view = renderPad(async () => ({ score: 10 }));
    root = view.root;

    act(() => {
      const typeButton = [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Type',
      );
      typeButton?.click();
    });
    act(() => {
      typeAnswer(view.container, 'Clouds form in the sky.');
    });
    await act(async () => {
      const check = [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Check',
      );
      check?.click();
      await Promise.resolve();
    });

    expect(view.container.textContent).toContain('Score:');
    expect(view.container.textContent).toContain('10');

    act(() => {
      typeAnswer(view.container, 'A different unsent draft');
    });

    expect(view.container.textContent).toContain('A different unsent draft');
    expect(view.container.textContent).not.toContain('Score:');
  });
});
