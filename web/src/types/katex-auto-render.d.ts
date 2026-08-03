declare module 'katex/dist/contrib/auto-render.mjs' {
  import type { KatexOptions } from 'katex';

  interface AutoRenderOptions extends KatexOptions {
    delimiters?: Array<{ left: string; right: string; display: boolean }>;
    throwOnError?: boolean;
  }

  export default function renderMathInElement(element: HTMLElement, options?: AutoRenderOptions): void;
}
