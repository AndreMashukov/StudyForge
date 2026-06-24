export interface IMermaidDiagram {
  code: string;
  className?: string;
  /** When true (default), enables drag-pan, wheel/pinch zoom, and zoom controls. */
  enablePanZoom?: boolean;
}
